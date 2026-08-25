// Cliente da API v3 do Bling (https://developer.bling.com.br/bling-api).
// Autenticacao OAuth2: o app e' cadastrado uma vez em developer.bling.com.br/aplicativos,
// o que gera client_id/client_secret. O usuario autoriza o app (fluxo "authorization code")
// uma unica vez, o que gera um refresh_token de longa duracao - e' esse refresh_token que
// fica guardado em BLING_REFRESH_TOKEN e usado aqui pra pedir novos access_token (que expiram
// rapido, tipicamente 6h) sem precisar o usuario logar de novo.
//
// Passo a passo de como gerar o primeiro refresh_token esta' em PROXIMOS_PASSOS.md.

import * as fs from "fs";
import * as path from "path";

const BLING_HOST = "https://api.bling.com.br/Api/v3";
const BLING_OAUTH_TOKEN_URL = "https://api.bling.com.br/Api/v3/oauth/token";

type BlingTokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
};

let cachedAccessToken: { token: string; expiraEm: number } | null = null;

// O Bling invalida o refresh_token antigo e devolve um NOVO a cada troca (rotacao de refresh
// token) - usar o valor antigo de novo depois disso da' "Invalid refresh token". Quando rodando
// localmente (scripts/sync-bling.ts via tsx), a gente atualiza o .env.local sozinho pra nao
// depender de copiar/colar toda vez. Em producao na Vercel isso nao persiste entre chamadas
// (sistema de arquivos efemero/somente leitura) - por isso o uso do Bling la' fica limitado
// a testes pontuais; o fluxo principal e' rodar o sync localmente.
function atualizarRefreshTokenLocal(novoToken: string) {
  try {
    const caminho = path.join(process.cwd(), ".env.local");
    if (!fs.existsSync(caminho)) return;
    const conteudo = fs.readFileSync(caminho, "utf-8");
    const jaTem = /^BLING_REFRESH_TOKEN=.*$/m.test(conteudo);
    const atualizado = jaTem
      ? conteudo.replace(/^BLING_REFRESH_TOKEN=.*$/m, `BLING_REFRESH_TOKEN=${novoToken}`)
      : `${conteudo.trimEnd()}\nBLING_REFRESH_TOKEN=${novoToken}\n`;
    fs.writeFileSync(caminho, atualizado);
    console.log("[bling] .env.local atualizado automaticamente com o novo refresh_token.");
  } catch {
    // sistema de arquivos somente leitura (ex: Vercel em producao) - inofensivo, so' ignora
  }
}

async function obterAccessToken(): Promise<string> {
  if (cachedAccessToken && cachedAccessToken.expiraEm > Date.now()) {
    return cachedAccessToken.token;
  }

  const clientId = process.env.BLING_CLIENT_ID;
  const clientSecret = process.env.BLING_CLIENT_SECRET;
  const refreshToken = process.env.BLING_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      "Credenciais do Bling ausentes. Configure BLING_CLIENT_ID, BLING_CLIENT_SECRET e BLING_REFRESH_TOKEN no .env."
    );
  }

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const resposta = await fetch(BLING_OAUTH_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basicAuth}`
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken
    })
  });

  if (!resposta.ok) {
    const texto = await resposta.text();
    throw new Error(`Falha ao renovar token do Bling (${resposta.status}): ${texto}`);
  }

  const dados = (await resposta.json()) as BlingTokenResponse;
  cachedAccessToken = {
    token: dados.access_token,
    // renova um pouco antes de expirar de verdade, pra nao correr risco de token vencido
    expiraEm: Date.now() + (dados.expires_in - 60) * 1000
  };

  if (dados.refresh_token && dados.refresh_token !== refreshToken) {
    process.env.BLING_REFRESH_TOKEN = dados.refresh_token; // vale pro resto desse processo
    atualizarRefreshTokenLocal(dados.refresh_token);
    console.warn(
      `[bling] refresh_token foi rotacionado. Novo valor: ${dados.refresh_token} (na Vercel, atualize BLING_REFRESH_TOKEN manualmente com esse valor se for usar o app la').`
    );
  }

  return cachedAccessToken.token;
}

async function blingFetch<T>(caminho: string, init?: RequestInit): Promise<T> {
  const token = await obterAccessToken();
  const resposta = await fetch(`${BLING_HOST}${caminho}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    }
  });

  if (!resposta.ok) {
    const texto = await resposta.text();
    throw new Error(`Bling API erro ${resposta.status} em ${caminho}: ${texto}`);
  }

  return resposta.json() as Promise<T>;
}

// GET /Api/v3/produtos - lista de produtos cadastrados no Bling.
export async function listarProdutosBling(pagina = 1) {
  return blingFetch<{ data: unknown[] }>(`/produtos?pagina=${pagina}&limite=100`);
}

// GET /Api/v3/estoques/saldos - saldo de estoque por produto/deposito.
export async function listarSaldosEstoqueBling(idsProdutos: number[]) {
  const query = idsProdutos.map((id) => `idsProdutos[]=${id}`).join("&");
  return blingFetch<{ data: unknown[] }>(`/estoques/saldos?${query}`);
}

// GET /Api/v3/produtos/{id} - detalhe completo de UM produto. Usado so' pra diagnostico
// (ver diagnostico-marca abaixo): o endpoint de LISTA (/produtos) nao devolve o campo de
// marca, entao aqui a gente confirma se o detalhe traz esse campo antes de montar o
// mapeamento definitivo em scripts/sync-bling.ts.
export async function buscarProdutoDetalheBling(id: number) {
  return blingFetch<{ data: unknown }>(`/produtos/${id}`);
}

// POST /Api/v3/pedidos/vendas - cria um pedido de venda no Bling a partir de um pedido
// aprovado no site. O mapeamento exato de campos (deposito, categoria, forma de pagamento,
// numeracao) depende de como a conta Bling da MOZZ esta configurada hoje - o formato abaixo
// e' o esqueleto padrao da API; precisa validar com uma venda de teste antes de ir pra producao.
export type ItemPedidoBling = {
  produtoId: number;
  quantidade: number;
  valor: number;
};

// Endereco de entrega (ver EnderecoCheckout em lib/mercadopago.ts) - adicionado em 25/08/2026
// depois de descobrir, numa venda de teste real, que o checkout nunca coletava isso (so' CPF/
// nome/CEP-pra-frete). Manda o endereco em DOIS lugares do payload porque a documentacao da
// API v3 do Bling nao deixa 100% claro qual delas vira a etiqueta de envio de verdade:
// "contato.endereco" (endereco cadastral do cliente) e "transporte.etiqueta" (endereco
// especifico de entrega desse pedido). IMPORTANTE: confirmar contra um pedido real criado no
// Bling (a propria venda teste de hoje serve pra isso) e remover o que sobrar redundante.
export type EnderecoPedidoBling = {
  cep: string;
  rua: string;
  numero: string;
  complemento?: string;
  bairro: string;
  cidade: string;
  uf: string;
};

export async function criarPedidoVendaBling(params: {
  numeroPedidoLoja: string;
  cliente: { nome: string; cpf: string; email: string; telefone?: string };
  endereco: EnderecoPedidoBling;
  itens: ItemPedidoBling[];
  totalFrete: number;
}) {
  const end = params.endereco;
  return blingFetch<{ data: unknown }>("/pedidos/vendas", {
    method: "POST",
    body: JSON.stringify({
      numeroLoja: params.numeroPedidoLoja,
      contato: {
        nome: params.cliente.nome,
        numeroDocumento: params.cliente.cpf,
        email: params.cliente.email,
        telefone: params.cliente.telefone,
        endereco: {
          endereco: end.rua,
          numero: end.numero,
          complemento: end.complemento ?? "",
          bairro: end.bairro,
          cep: end.cep,
          municipio: end.cidade,
          uf: end.uf,
          pais: "Brasil"
        }
      },
      itens: params.itens.map((item) => ({
        produto: { id: item.produtoId },
        quantidade: item.quantidade,
        valor: item.valor
      })),
      transporte: {
        frete: params.totalFrete,
        etiqueta: {
          nome: params.cliente.nome,
          endereco: end.rua,
          numero: end.numero,
          complemento: end.complemento ?? "",
          municipio: end.cidade,
          uf: end.uf,
          cep: end.cep,
          bairro: end.bairro,
          nomePais: "Brasil"
        }
      }
    })
  });
}

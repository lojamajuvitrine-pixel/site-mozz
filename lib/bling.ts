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
import { createClient } from "@supabase/supabase-js";

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

// Fonte compartilhada do refresh_token entre os DOIS processos que usam o Bling: o webhook do
// Mercado Pago (roda na Vercel, sempre que um pagamento e' aprovado) e o sync automatico de
// estoque (roda no GitHub Actions, a cada 5min em horario comercial). Como o Bling ROTACIONA o
// refresh_token a cada uso (o antigo vira invalido na hora), esses dois processos brigavam pelo
// mesmo valor estatico guardado em dois lugares diferentes (variavel de ambiente da Vercel vs
// secret do GitHub) - qualquer um dos dois que usasse primeiro invalidava a copia do outro,
// causando "Invalid refresh token" aleatoriamente (foi o que quebrou o pedido de venda da
// primeira compra real, em 25/08/2026). A tabela bling_oauth_token no Supabase agora e' a UNICA
// fonte de verdade: os dois processos leem de la' antes de renovar e escrevem de volta depois -
// a variavel de ambiente BLING_REFRESH_TOKEN vira so' uma semente inicial/fallback pro caso do
// Supabase estar fora do ar. Ainda existe uma janela pequena de corrida se os dois renovarem ao
// mesmo tempo exato, mas o webhook do Mercado Pago se auto-recupera nesse caso (devolve 500,
// o Mercado Pago tenta de novo minutos depois, e a essa altura o token no Supabase ja' esta'
// atualizado).
function obterClienteSupabaseServico() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !chave) return null;
  return createClient(url, chave);
}

async function lerRefreshTokenCompartilhado(): Promise<string | null> {
  const supabase = obterClienteSupabaseServico();
  if (!supabase) return null;
  try {
    const { data } = await supabase.from("bling_oauth_token").select("refresh_token").eq("id", 1).maybeSingle();
    return data?.refresh_token ?? null;
  } catch {
    return null; // Supabase fora do ar/tabela ainda nao existe - cai pro fallback da env var
  }
}

async function salvarRefreshTokenCompartilhado(novoToken: string) {
  const supabase = obterClienteSupabaseServico();
  if (!supabase) return;
  try {
    await supabase
      .from("bling_oauth_token")
      .upsert({ id: 1, refresh_token: novoToken, atualizado_em: new Date().toISOString() });
  } catch (erro) {
    console.warn("[bling] falha ao salvar refresh_token compartilhado no Supabase:", erro);
  }
}

async function obterAccessToken(): Promise<string> {
  if (cachedAccessToken && cachedAccessToken.expiraEm > Date.now()) {
    return cachedAccessToken.token;
  }

  const clientId = process.env.BLING_CLIENT_ID;
  const clientSecret = process.env.BLING_CLIENT_SECRET;
  // Supabase primeiro (fonte compartilhada e sempre mais recente) - so' cai pra variavel de
  // ambiente se o Supabase nao estiver configurado ou a tabela ainda nao tiver linha nenhuma.
  const refreshToken = (await lerRefreshTokenCompartilhado()) ?? process.env.BLING_REFRESH_TOKEN;

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
    atualizarRefreshTokenLocal(dados.refresh_token); // conveniencia so' quando roda localmente
    await salvarRefreshTokenCompartilhado(dados.refresh_token); // fonte de verdade pros dois processos
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

// Busca um contato existente no Bling pelo CPF (query "pesquisa" da API de listagem) e,
// se nao encontrar, cria um novo via POST /contatos. Descoberto em 25/08/2026, contra a
// primeira venda real: o POST /pedidos/vendas exige "contato.id" (referencia a um contato
// JA CADASTRADO no Bling) - so' mandar nome/cpf/email inline (sem id) da' os erros
// "Id do contato da venda e' obrigatorio" e "O cliente nao foi preenchido", mesmo com todos
// os outros dados presentes. O endereco do CLIENTE (cadastro) vai aqui, no contato; o endereco
// de ENTREGA desse pedido especifico continua em transporte.etiqueta (podem ser diferentes).
async function buscarOuCriarContatoBling(params: {
  nome: string;
  cpf: string;
  email: string;
  telefone?: string;
  endereco: EnderecoPedidoBling;
}): Promise<number> {
  const cpfLimpo = params.cpf.replace(/\D/g, "");

  // BUG encontrado em 25/08/2026, na primeira venda real (pagamento 174612277989): o endpoint
  // GET /contatos?pesquisa={cpf} do Bling e' busca por TEXTO LIVRE, nao busca exata - com
  // cpfLimpo valido (11 digitos de um cliente real, ja' cadastrado no Bling com esse CPF) ele
  // devolveu um contato TOTALMENTE diferente ("Consumo Interno", um cadastro generico de baixa
  // de estoque) como primeiro resultado, que a gente aceitava cegamente. A API v3 do Bling tem
  // um parametro dedicado pra isso - "numeroDocumento" (confirmado no OpenAPI spec oficial,
  // GET /contatos) - que filtra por CPF/CNPJ exato no proprio servidor, entao usamos ele em vez
  // de "pesquisa". Mesmo assim mantemos a conferencia client-side como cinto-de-seguranca, caso
  // o filtro do servidor um dia se comporte como busca parcial tambem.
  if (cpfLimpo) {
    const busca = await blingFetch<{ data: Array<{ id: number; numeroDocumento?: string }> }>(
      `/contatos?numeroDocumento=${encodeURIComponent(cpfLimpo)}&limite=10`
    );
    const encontrado =
      busca.data?.find((c) => (c.numeroDocumento ?? "").replace(/\D/g, "") === cpfLimpo) ?? busca.data?.[0];
    if (encontrado) {
      return encontrado.id;
    }
  }

  const end = params.endereco;
  const criado = await blingFetch<{ data: { id: number } }>("/contatos", {
    method: "POST",
    body: JSON.stringify({
      nome: params.nome,
      tipo: "F",
      numeroDocumento: cpfLimpo,
      email: params.email || undefined,
      celular: params.telefone,
      endereco: {
        geral: {
          endereco: end.rua,
          numero: end.numero,
          complemento: end.complemento ?? "",
          bairro: end.bairro,
          cep: end.cep,
          municipio: end.cidade,
          uf: end.uf
        }
      }
    })
  });
  return criado.data.id;
}

export async function criarPedidoVendaBling(params: {
  numeroPedidoLoja: string;
  cliente: { nome: string; cpf: string; email: string; telefone?: string };
  endereco: EnderecoPedidoBling;
  itens: ItemPedidoBling[];
  totalFrete: number;
}) {
  const end = params.endereco;
  const contatoId = await buscarOuCriarContatoBling({
    nome: params.cliente.nome,
    cpf: params.cliente.cpf,
    email: params.cliente.email,
    telefone: params.cliente.telefone,
    endereco: end
  });

  // "data" (data do pedido) e' obrigatoria - sem ela o Bling nem consegue gerar a(s)
  // parcela(s) financeira(s) padrao automaticamente (erro "data para geracao das parcelas
  // e' invalida"). dataSaida/dataPrevista tambem sao exigidas pelo schema da API; usamos a
  // data de hoje pras tres na falta de um calculo de prazo de envio mais preciso.
  const hoje = new Date().toISOString().slice(0, 10);

  const totalItens = params.itens.reduce((soma, item) => soma + item.quantidade * item.valor, 0);
  const totalPedido = totalItens + params.totalFrete;

  // ID da forma de pagamento "Mercado Pago", cadastrada manualmente no Bling em 25/08/2026
  // (Cadastros > Formas de pagamento; Tipo "Outros", Destino "Conta a receber/pagar", Conta
  // financeira "Mercado Pago - Mercado Livre"). Sem "parcelas" o pedido ficava sem forma de
  // pagamento nenhuma e sem conta a receber gerada.
  const ID_FORMA_PAGAMENTO_MERCADO_PAGO = 10977522;

  // Vendedor padrao pras vendas do site - decisao do Brunno em 25/08/2026: usar sempre a
  // Izabella, ja' que o site nao tem noção de vendedor proprio. A conta Bling tem "Vendedor
  // obrigatorio nos pedidos de vendas" ativado, entao sem isso o POST falha assim que o
  // contato deixa de ser o generico "Consumo Interno".
  const ID_VENDEDOR_PADRAO_SITE = 15596528457;

  return blingFetch<{ data: unknown }>("/pedidos/vendas", {
    method: "POST",
    body: JSON.stringify({
      numeroLoja: params.numeroPedidoLoja,
      data: hoje,
      dataSaida: hoje,
      dataPrevista: hoje,
      contato: {
        id: contatoId,
        nome: params.cliente.nome
      },
      vendedor: { id: ID_VENDEDOR_PADRAO_SITE },
      itens: params.itens.map((item) => ({
        produto: { id: item.produtoId },
        quantidade: item.quantidade,
        valor: item.valor
      })),
      parcelas: [
        {
          dataVencimento: hoje,
          valor: totalPedido,
          formaPagamento: { id: ID_FORMA_PAGAMENTO_MERCADO_PAGO },
          observacoes: "Pago via Mercado Pago"
        }
      ],
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


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
 
// Log leve e permanente (nunca a chave nem o token inteiro, so' os ultimos 6 caracteres, que
// ja trocam a cada uso) - descobriu, em 28/08/2026, que o sync-bling-completo.yml rodava sem
// NEXT_PUBLIC_SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY no ambiente (secret cadastrada no GitHub
// mas nunca referenciada no bloco env: do workflow) e caia silenciosamente no fallback antigo
// da env var BLING_REFRESH_TOKEN sem ninguem perceber. Vale manter pra pegar isso na hora, em
// vez de descobrir depois de varias falhas.
async function lerRefreshTokenCompartilhado(): Promise<string | null> {
  const supabase = obterClienteSupabaseServico();
  if (!supabase) {
    console.warn("[bling] Supabase nao configurado nesse ambiente (falta NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY) - usando o fallback da env var BLING_REFRESH_TOKEN.");
    return null;
  }
  try {
    const { data, error } = await supabase.from("bling_oauth_token").select("refresh_token").eq("id", 1).maybeSingle();
    if (error) {
      console.warn(`[bling] Supabase respondeu com erro ao ler o token: ${error.message} (code: ${error.code ?? "?"})`);
      return null;
    }
    if (!data?.refresh_token) {
      console.warn("[bling] Supabase respondeu OK mas sem nenhuma linha/refresh_token (tabela vazia?) - usando o fallback da env var.");
      return null;
    }
    return data.refresh_token;
  } catch (erro) {
    console.warn("[bling] Excecao ao tentar ler o Supabase (rede/config?):", erro);
    return null; // Supabase fora do ar/tabela ainda nao existe - cai pro fallback da env var
  }
}
 
// Tenta salvar ate' 3x (com um pequeno intervalo) antes de desistir. Esse valor e' o ULTIMO
// refresh_token valido que a gente tem - se essa gravacao falhar silenciosamente (like antes),
// o Bling ja' invalidou o token antigo mas ninguem mais tem o novo em lugar nenhum, e a unica
// saida vira uma reautorizacao manual (foi exatamente isso que aconteceu em 28/08/2026). Um
// blip transitorio do Supabase nao pode custar isso.
async function salvarRefreshTokenCompartilhado(novoToken: string) {
  const supabase = obterClienteSupabaseServico();
  if (!supabase) return;
 
  const tentativas = 3;
  for (let tentativa = 1; tentativa <= tentativas; tentativa++) {
    try {
      const { error } = await supabase
        .from("bling_oauth_token")
        .upsert({ id: 1, refresh_token: novoToken, atualizado_em: new Date().toISOString() });
      if (!error) return; // sucesso
      throw error;
    } catch (erro) {
      if (tentativa === tentativas) {
        // esgotou as tentativas - loga ALTO (nao so' warn) porque a partir daqui o token novo
        // so' existe na memoria desse processo, e some quando ele terminar.
        console.error(
          `[bling] FALHA ao salvar refresh_token compartilhado no Supabase apos ${tentativas} tentativas - ` +
            `o token novo pode se perder. Erro:`,
          erro
        );
        return;
      }
      console.warn(`[bling] tentativa ${tentativa}/${tentativas} de salvar refresh_token falhou, tentando de novo:`, erro);
      await aguardar(500 * tentativa);
    }
  }
}
 
function aguardar(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
 
// Troca um refresh_token pelos tokens novos. Isolado numa funcao a parte pra poder ser chamado
// de novo (com um refresh_token diferente) no retry de corrida logo abaixo, sem duplicar a
// chamada HTTP. Guarda o status HTTP no erro pra quem chama saber se vale tentar de novo.
async function trocarRefreshTokenPorTokens(refreshToken: string): Promise<BlingTokenResponse> {
  const clientId = process.env.BLING_CLIENT_ID;
  const clientSecret = process.env.BLING_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Credenciais do Bling ausentes. Configure BLING_CLIENT_ID e BLING_CLIENT_SECRET no .env.");
  }
 
  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
 
  const resposta = await fetch(BLING_OAUTH_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basicAuth}`,
      "enable-jwt": "1"
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken
    })
  });
 
  if (!resposta.ok) {
    const texto = await resposta.text();
    const erro = new Error(`Falha ao renovar token do Bling (${resposta.status}): ${texto}`) as Error & {
      status?: number;
    };
    erro.status = resposta.status;
    throw erro;
  }
 
  return (await resposta.json()) as BlingTokenResponse;
}
 
async function obterAccessToken(): Promise<string> {
  if (cachedAccessToken && cachedAccessToken.expiraEm > Date.now()) {
    return cachedAccessToken.token;
  }
 
  // Supabase primeiro (fonte compartilhada e sempre mais recente) - so' cai pra variavel de
  // ambiente se o Supabase nao estiver configurado ou a tabela ainda nao tiver linha nenhuma.
  const doSupabase = await lerRefreshTokenCompartilhado();
  const refreshTokenInicial = doSupabase ?? process.env.BLING_REFRESH_TOKEN;
  if (!refreshTokenInicial) {
    throw new Error("Credenciais do Bling ausentes. Nenhum refresh_token disponivel (Supabase nem BLING_REFRESH_TOKEN).");
  }
  if (!doSupabase) {
    console.warn("[bling] Usando o fallback da env var BLING_REFRESH_TOKEN, nao o Supabase - ver aviso acima.");
  }
 
  let refreshTokenUsado = refreshTokenInicial;
  let dados: BlingTokenResponse;
  try {
    dados = await trocarRefreshTokenPorTokens(refreshTokenUsado);
  } catch (erroOriginal) {
    // 400 (invalid_grant) nesse ponto costuma ser CORRIDA, nao token morto de verdade: outro
    // processo (webhook do Mercado Pago, o sync de 5 em 5 min, uma execucao manual) rotacionou
    // esse MESMO refresh_token um instante antes (o Bling so' aceita cada refresh_token UMA vez
    // - ver comentario grande acima de lerRefreshTokenCompartilhado). Em vez de falhar na hora,
    // espera um pouco (tempo do outro processo terminar de salvar o token novo no Supabase) e
    // busca de novo - se mudou, tenta com o valor atualizado antes de desistir de verdade.
    const status = (erroOriginal as { status?: number })?.status;
    if (status !== 400) throw erroOriginal;
 
    await aguardar(2500);
    const refreshTokenAtualizado = await lerRefreshTokenCompartilhado();
    if (!refreshTokenAtualizado || refreshTokenAtualizado === refreshTokenUsado) {
      throw erroOriginal; // Supabase nao mudou - nao era corrida, o token esta' morto mesmo
    }
 
    refreshTokenUsado = refreshTokenAtualizado;
    dados = await trocarRefreshTokenPorTokens(refreshTokenUsado); // se falhar aqui, propaga normalmente
  }
 
  cachedAccessToken = {
    token: dados.access_token,
    // renova um pouco antes de expirar de verdade, pra nao correr risco de token vencido
    expiraEm: Date.now() + (dados.expires_in - 60) * 1000
  };
 
  if (dados.refresh_token && dados.refresh_token !== refreshTokenUsado) {
    process.env.BLING_REFRESH_TOKEN = dados.refresh_token; // vale pro resto desse processo
    atualizarRefreshTokenLocal(dados.refresh_token); // conveniencia so' quando roda localmente
    await salvarRefreshTokenCompartilhado(dados.refresh_token); // fonte de verdade pros processos
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
  "enable-jwt": "1",
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

// GET /Api/v3/situacoes/modulos/{idModuloSistema} - lista as situacoes (status) configuradas
// pra um modulo do Bling (cada conta pode ter os ids das situacoes diferentes, mesmo com os
// mesmos NOMES padrao - "Em aberto", "Em andamento" etc - por isso nao da' pra so' hardcodar
// um numero sem confirmar contra a conta de verdade). So' usado uma vez, via a rota de
// diagnostico temporaria (app/api/bling/diagnostico-situacoes), pra descobrir o id de "Em
// andamento" no modulo de Pedido de Venda - depois disso o id vira uma constante fixa em
// criarPedidoVendaBling, igual ID_FORMA_PAGAMENTO_MERCADO_PAGO e ID_VENDEDOR_PADRAO_SITE.
export async function listarSituacoesModuloBling(idModuloSistema: number) {
  return blingFetch<{ data: Array<{ id: number; nome?: string; idHerdado?: string }> }>(
    `/situacoes/modulos/${idModuloSistema}`
  );
}

// GET /Api/v3/pedidos/vendas - lista os pedidos de venda mais recentes, com o campo "situacao"
// de cada um (id + nome/descricao). Tentativa 1 (varrer /situacoes/modulos/1..20) nao achou
// nada - ou o id do modulo "Pedido de Venda" e' um numero fora dessa faixa, ou a permissao do
// app nao cobre esse endpoint. Caminho mais confiavel: o Brunno muda manualmente UM pedido de
// teste pra "Em andamento" direto na tela do Bling, e a gente le' o id de volta aqui, no proprio
// pedido - sem precisar acertar o id do modulo. So' devolve o JSON cru (sem filtrar campos) pra
// nao arriscar errar o nome exato do campo "situacao" tambem.
export async function listarPedidosVendaBling(pagina = 1) {
  return blingFetch<{ data: unknown[] }>(`/pedidos/vendas?pagina=${pagina}&limite=50`);
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
  const end = params.endereco;
  const corpoContato = {
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
  };

  if (cpfLimpo) {
    const busca = await blingFetch<{ data: Array<{ id: number; numeroDocumento?: string }> }>(
      `/contatos?numeroDocumento=${encodeURIComponent(cpfLimpo)}&limite=10`
    );
    const encontrado =
      busca.data?.find((c) => (c.numeroDocumento ?? "").replace(/\D/g, "") === cpfLimpo) ?? busca.data?.[0];
    if (encontrado) {
      // Achado um contato ja' cadastrado com esse CPF - ATUALIZA com os dados de agora (PUT,
      // corpo completo) em vez de so' devolver o id como estava antes. Bug encontrado em
      // 31/08/2026, numa venda de teste real: o Bling acusou "pendencias cadastrais" (Numero/
      // Bairro/CEP/Cidade/UF do Cliente ausentes) numa compra que, do lado do site, mandou
      // esses dados certinho - o contato da cliente ja' existia no Bling de uma compra
      // ANTERIOR (de antes do checkout coletar endereco completo, ou criado so' com nome/CPF),
      // e como so' devolviamos o id sem nunca atualizar o cadastro, o endereco antigo (vazio)
      // ficava pra sempre, mesmo em compras novas com tudo preenchido. Se o PUT falhar (ex:
      // Bling fora do ar), so' loga e segue com o id encontrado - melhor criar o pedido com o
      // cadastro desatualizado (mesmo problema de antes) do que travar a venda inteira por
      // isso, ja' que a pendencia so' bloqueia a emissao da nota fiscal, nao a venda em si.
      try {
        await blingFetch(`/contatos/${encontrado.id}`, {
          method: "PUT",
          body: JSON.stringify(corpoContato)
        });
      } catch (erro) {
        console.warn(
          `Bling: falha ao atualizar cadastro do contato ${encontrado.id} (CPF ${cpfLimpo}) - seguindo com o cadastro antigo:`,
          erro instanceof Error ? erro.message : erro
        );
      }
      return encontrado.id;
    }
  }

  const criado = await blingFetch<{ data: { id: number } }>("/contatos", {
    method: "POST",
    body: JSON.stringify(corpoContato)
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

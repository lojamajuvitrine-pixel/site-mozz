// Compra e geracao automatica de etiqueta de envio no Melhor Envio, depois que um pagamento e'
// aprovado - pedido do Brunno em 31/08/2026 (sem sandbox, direto na conta de producao). Fluxo:
// carrinho (POST /me/cart) -> checkout, que paga com o saldo da carteira (POST
// /me/shipment/checkout) -> geracao da etiqueta, que avisa a transportadora (POST
// /me/shipment/generate) -> o codigo de rastreio fica disponivel (consultado via
// /me/shipment/tracking, mas na pratica o webhook em app/api/melhorenvio/webhook avisa sozinho
// quando muda). Documentacao: docs.melhorenvio.com.br - varias partes dela sao incompletas
// (confirmado em 31/08/2026: paginas de referencia nao documentam o formato exato de erro de
// saldo insuficiente, nem se o codigo de rastreio fica disponivel na hora do generate ou so'
// depois - por isso todo lugar abaixo que depende disso trata com cuidado/defensivamente).
//
// Diferente do calculo de frete em lib/frete.ts (que usa um token simples, MELHOR_ENVIO_TOKEN,
// so' com permissao de cotacao) - essas chamadas aqui exigem um token OAuth com permissoes de
// carrinho/checkout/geracao/rastreio, obtido pelo fluxo em app/api/melhorenvio/callback e
// renovado automaticamente aqui (mesmo raciocinio de renovacao do lib/bling.ts: access_token
// dura ~30 dias, refresh_token ~45 dias, e e' ROTACIONADO a cada renovacao - por isso o
// Supabase e' a fonte unica de verdade do refresh_token atual, nunca uma variavel de ambiente
// estatica).
import { createClient } from "@supabase/supabase-js";
import { hostMelhorEnvio, pesoParaQuantidade, PACOTE_PADRAO, ehRetirada } from "@/lib/frete";
import { SITE_URL } from "@/lib/site";
import type { EnderecoCheckout } from "@/lib/mercadopago";

// Igual bling_oauth_token (lib/bling.ts): esse token e' um segredo do SISTEMA, nao um dado
// por cliente - acesso so' pela service role key (nunca pelo cliente anonimo/RLS), porque
// precisa poder LER e ESCREVER sem depender de nenhuma politica publica.
function obterClienteSupabaseServico() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !chave) return null;
  return createClient(url, chave);
}

const USER_AGENT = "MOZZ Ecommerce (loja.majuvitrine@gmail.com)";

function headersPadrao(accessToken: string) {
  return {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
    Accept: "application/json",
    "User-Agent": USER_AGENT
  };
}

type LinhaToken = { access_token: string; refresh_token: string; expira_em: string };

async function lerTokenSalvo(): Promise<LinhaToken | null> {
  const supabase = obterClienteSupabaseServico();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("melhor_envio_oauth_token")
    .select("access_token, refresh_token, expira_em")
    .eq("id", 1)
    .maybeSingle();
  if (error || !data) return null;
  return data as LinhaToken;
}

async function salvarToken(accessToken: string, refreshToken: string, expiraEmSegundos: number): Promise<void> {
  const supabase = obterClienteSupabaseServico();
  if (!supabase) throw new Error("Supabase (service role) nao configurado - nao da pra salvar o token do Melhor Envio");
  // Expira 5min antes do valor real informado, de proposito - margem de seguranca pra nunca
  // usar um token que expira NO MEIO de uma chamada (mesma folga de outras integracoes deste
  // projeto, ver renovacao do Bling em lib/bling.ts).
  const expiraEm = new Date(Date.now() + (expiraEmSegundos - 300) * 1000).toISOString();
  await supabase.from("melhor_envio_oauth_token").upsert({
    id: 1,
    access_token: accessToken,
    refresh_token: refreshToken,
    expira_em: expiraEm,
    atualizado_em: new Date().toISOString()
  });
}

async function renovarToken(refreshToken: string): Promise<LinhaToken> {
  const clientId = process.env.MELHOR_ENVIO_CLIENT_ID;
  const clientSecret = process.env.MELHOR_ENVIO_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("MELHOR_ENVIO_CLIENT_ID e/ou MELHOR_ENVIO_CLIENT_SECRET ausentes no .env");
  }

  const resposta = await fetch(`${hostMelhorEnvio("auth")}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", "User-Agent": USER_AGENT },
    body: JSON.stringify({
      grant_type: "refresh_token",
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken
    })
  });

  if (!resposta.ok) {
    const texto = await resposta.text();
    throw new Error(`Falha ao renovar token do Melhor Envio (${resposta.status}): ${texto}`);
  }

  const dados = (await resposta.json()) as { access_token: string; refresh_token: string; expires_in: number };
  await salvarToken(dados.access_token, dados.refresh_token, dados.expires_in);
  return { access_token: dados.access_token, refresh_token: dados.refresh_token, expira_em: new Date().toISOString() };
}

// Devolve um access_token valido, renovando sozinho quando necessario - todo o resto deste
// arquivo chama isso antes de qualquer requisicao, nunca guarda o token numa variavel solta.
async function obterAccessToken(): Promise<string> {
  const salvo = await lerTokenSalvo();
  if (!salvo) {
    throw new Error(
      "Melhor Envio ainda nao autorizado - falta completar o fluxo em /api/melhorenvio/callback."
    );
  }
  if (new Date(salvo.expira_em).getTime() > Date.now()) {
    return salvo.access_token;
  }
  const renovado = await renovarToken(salvo.refresh_token);
  return renovado.access_token;
}

export type ItemPedidoParaEnvio = { nome: string; quantidade: number; valor: number };

export type ResultadoEtiqueta = {
  melhorEnvioId: string;
  transportadora: string;
  servico: string;
  codigoRastreio: string | null;
  linkRastreio: string | null;
};

// Nome/documento/contato de quem ENVIA (a MOZZ) - exigido pelo Melhor Envio em toda etiqueta,
// igual apareceria numa etiqueta comprada na mao. Vem de variavel de ambiente (nunca
// hardcoded no codigo) - configuravel na Vercel, mesmo padrao de MELHOR_ENVIO_CEP_ORIGEM.
//
// IMPORTANTE (descoberto testando em producao em 31/08/2026): o campo "document" do Melhor
// Envio exige especificamente um CPF, mesmo pra remetente pessoa juridica - o CNPJ vai so' no
// campo separado "company_document". Por isso sao DUAS variaveis de documento aqui: o CPF do
// responsavel pela empresa (MELHOR_ENVIO_REMETENTE_CPF_RESPONSAVEL) e o CNPJ da MOZZ
// (MELHOR_ENVIO_REMETENTE_DOCUMENTO, ja existia antes desse ajuste).
function remetente() {
  const cnpj = process.env.MELHOR_ENVIO_REMETENTE_DOCUMENTO;
  const cpfResponsavel = process.env.MELHOR_ENVIO_REMETENTE_CPF_RESPONSAVEL;
  const email = process.env.MELHOR_ENVIO_REMETENTE_EMAIL;
  const cepOrigem = process.env.MELHOR_ENVIO_CEP_ORIGEM;
  if (!cnpj || !cpfResponsavel || !email || !cepOrigem) {
    throw new Error(
      "Dados do remetente ausentes no .env (MELHOR_ENVIO_REMETENTE_DOCUMENTO, MELHOR_ENVIO_REMETENTE_CPF_RESPONSAVEL, MELHOR_ENVIO_REMETENTE_EMAIL, MELHOR_ENVIO_CEP_ORIGEM)"
    );
  }
  return {
    name: "MOZZ",
    document: cpfResponsavel.replace(/\D/g, ""),
    company_document: cnpj.replace(/\D/g, ""),
    phone: "42988351888",
    email,
    address: "Avenida Coronel Rogério Borba",
    number: "480",
    district: "Centro",
    city: "Reserva",
    state_abbr: "PR",
    country_id: "BR",
    postal_code: cepOrigem.replace(/\D/g, "")
  };
}

function destinatario(nome: string, cpfLimpo: string, endereco: EnderecoCheckout) {
  return {
    name: nome,
    document: cpfLimpo,
    phone: "00000000000",
    address: endereco.rua,
    complement: endereco.complemento ?? "",
    number: endereco.numero,
    district: endereco.bairro,
    city: endereco.cidade,
    state_abbr: endereco.uf,
    country_id: "BR",
    postal_code: endereco.cep.replace(/\D/g, "")
  };
}

// Passo 1: adiciona o frete escolhido (ja revalidado em lib/mercadopago.ts) no carrinho do
// Melhor Envio - NAO cobra nada ainda, so' cria a "ordem" pendente. E' esse passo que da' pra
// testar em producao sem gastar saldo (ver conversa com o Brunno em 31/08/2026). Exportada
// (so' essa, nao pagarCarrinho/gerarEtiqueta) pra rota de teste em
// app/api/melhorenvio/teste/route.ts poder chamar so' o passo seguro - apagar essa rota depois
// que o teste passar nao exige desfazer esse export, ele so' fica sem nenhum outro chamador.
export async function adicionarAoCarrinho(params: {
  servicoId: number;
  nomeCliente: string;
  cpfLimpo: string;
  endereco: EnderecoCheckout;
  itens: ItemPedidoParaEnvio[];
  numeroPedidoLoja: string;
}): Promise<{ orderId: string }> {
  const accessToken = await obterAccessToken();
  const quantidadeItens = params.itens.reduce((soma, item) => soma + item.quantidade, 0);
  const valorTotalItens = params.itens.reduce((soma, item) => soma + item.valor * item.quantidade, 0);

  const resposta = await fetch(`${hostMelhorEnvio()}/me/cart`, {
    method: "POST",
    headers: headersPadrao(accessToken),
    body: JSON.stringify({
      service: params.servicoId,
      from: remetente(),
      to: destinatario(params.nomeCliente, params.cpfLimpo, params.endereco),
      products: params.itens.map((item, indice) => ({
        name: item.nome,
        quantity: item.quantidade,
        unitary_value: item.valor,
        _id: `${params.numeroPedidoLoja}-${indice}`
      })),
      volumes: [
        {
          height: PACOTE_PADRAO.height,
          width: PACOTE_PADRAO.width,
          length: PACOTE_PADRAO.length,
          weight: pesoParaQuantidade(quantidadeItens)
        }
      ],
      options: {
        insurance_value: valorTotalItens,
        receipt: false,
        own_hand: false,
        reverse: false,
        non_commercial: false,
        platform: "MOZZ",
        tags: [{ tag: params.numeroPedidoLoja }]
      }
    })
  });

  if (!resposta.ok) {
    const texto = await resposta.text();
    throw new Error(`Erro ao adicionar frete ao carrinho do Melhor Envio (${resposta.status}): ${texto}`);
  }
  const dados = (await resposta.json()) as { id: string };
  return { orderId: dados.id };
}

// Passo 2: paga o item do carrinho com o saldo da carteira. E' AQUI que sai dinheiro de
// verdade - se o saldo for insuficiente, a resposta nao vem 2xx (formato exato do erro nao e'
// documentado oficialmente - ver comentario no topo do arquivo) e o chamador trata como falha
// normal (ver processarEtiquetaSeNecessario no webhook do Mercado Pago).
async function pagarCarrinho(orderId: string): Promise<void> {
  const accessToken = await obterAccessToken();
  const resposta = await fetch(`${hostMelhorEnvio()}/me/shipment/checkout`, {
    method: "POST",
    headers: headersPadrao(accessToken),
    body: JSON.stringify({ orders: [orderId] })
  });
  if (!resposta.ok) {
    const texto = await resposta.text();
    throw new Error(`Erro ao pagar etiqueta no Melhor Envio (${resposta.status}): ${texto}`);
  }
}

// Passo 3: gera a etiqueta de verdade (avisa a transportadora) - so' pode ser chamado DEPOIS
// do checkout ter sido pago.
async function gerarEtiqueta(orderId: string): Promise<void> {
  const accessToken = await obterAccessToken();
  const resposta = await fetch(`${hostMelhorEnvio()}/me/shipment/generate`, {
    method: "POST",
    headers: headersPadrao(accessToken),
    body: JSON.stringify({ orders: [orderId] })
  });
  if (!resposta.ok) {
    const texto = await resposta.text();
    throw new Error(`Erro ao gerar etiqueta no Melhor Envio (${resposta.status}): ${texto}`);
  }
}

// Consulta o status/rastreio atual de uma etiqueta ja gerada - usado logo apos gerarEtiqueta
// pra ja' tentar salvar o codigo de rastreio se ele vier disponivel na hora. Quem mantem isso
// atualizado de verdade dali em diante e' o webhook (app/api/melhorenvio/webhook), nao uma
// consulta repetida daqui.
async function consultarRastreio(orderId: string): Promise<{ codigoRastreio: string | null; linkRastreio: string | null }> {
  const accessToken = await obterAccessToken();
  const resposta = await fetch(`${hostMelhorEnvio()}/me/shipment/tracking`, {
    method: "POST",
    headers: headersPadrao(accessToken),
    body: JSON.stringify({ orders: [orderId] })
  });
  if (!resposta.ok) return { codigoRastreio: null, linkRastreio: null };
  const dados = (await resposta.json()) as Record<string, { tracking?: string } | undefined>;
  const codigo = dados[orderId]?.tracking ?? null;
  return {
    codigoRastreio: codigo,
    linkRastreio: codigo ? `https://www.melhorrastreio.com.br/rastreio/${codigo}` : null
  };
}

// Funcao principal, chamada pelo webhook do Mercado Pago depois que o pagamento e' aprovado e
// o pedido ja foi criado no Bling - faz os 3 passos em sequencia. Se qualquer passo falhar, a
// excecao sobe pra quem chamou tratar (marcar falha_etiqueta e seguir com o pedido normal, ver
// app/api/mercadopago/webhook/route.ts) - nunca deixa o pedido inteiro travar por causa disso.
export async function comprarEGerarEtiqueta(params: {
  servicoId: number;
  transportadora: string;
  servico: string;
  nomeCliente: string;
  cpfLimpo: string;
  endereco: EnderecoCheckout;
  itens: ItemPedidoParaEnvio[];
  numeroPedidoLoja: string;
}): Promise<ResultadoEtiqueta> {
  const { orderId } = await adicionarAoCarrinho(params);
  await pagarCarrinho(orderId);
  await gerarEtiqueta(orderId);
  const rastreio = await consultarRastreio(orderId);
  return {
    melhorEnvioId: orderId,
    transportadora: params.transportadora,
    servico: params.servico,
    codigoRastreio: rastreio.codigoRastreio,
    linkRastreio: rastreio.linkRastreio
  };
}

export { ehRetirada };
export const CALLBACK_URL = `${SITE_URL}/api/melhorenvio/callback`;

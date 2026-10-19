// Integracao com o Mercado Pago via Checkout Pro (Preferences API).
// Fluxo: o carrinho vira uma "preferencia" criada aqui no servidor -> o comprador e'
// redirecionado pro ambiente do Mercado Pago (init_point) -> ele paga -> o Mercado Pago
// chama nosso webhook (app/api/mercadopago/webhook) pra avisar o status real do pagamento.
// Documentacao: mercadopago.com.br/developers/pt/docs/checkout-pro/overview
//
// Desde 16/10/2026 tambem existe o pagamento DENTRO do site (Checkout Transparente): Pix com QR
// Code na propria pagina e cartao pelo Card Payment Brick (ver criarPagamentoPix /
// criarPagamentoCartao abaixo e app/api/mercadopago/pagar). Os dois caminhos usam a MESMA
// montagem/validacao do pedido (prepararPedido) e o MESMO metadata (pedido_json/cupom) - por
// isso o webhook continua igual pros dois: ele so' busca o pagamento e le o metadata.

import { MercadoPagoConfig, Payment, Preference } from "mercadopago";
import { randomUUID } from "crypto";
import type { Produto } from "@/lib/produtos";
import { resolverProdutoIdBling, buscarProduto, coresDoProduto, tamanhosDisponiveisDoColor } from "@/lib/produtos";
import { validarCupom } from "@/lib/cupom";
import { validarCpf } from "@/lib/cpf";
import { calcularFrete, cepDeReserva, ehEntregaExpressa, ehRetirada, FRETE_ENTREGA_EXPRESSA } from "@/lib/frete";
import { calcularDescontoPix, calcularParcelamento, MAX_PARCELAS_SEM_JUROS } from "@/lib/formato";
import { buscarConfiguracaoLoja } from "@/lib/configLoja";
import { buscarSaldoCredito, calcularCreditoAplicavel } from "@/lib/creditos";

// Erro "esperado" (o pedido em si nao pode seguir por um motivo que o cliente precisa saber -
// endereco incompleto, tamanho sem estoque, etc.) - diferente de um erro tecnico inesperado
// (Mercado Pago fora do ar, bug). A rota da API (app/api/mercadopago/criar-preferencia) usa
// isso pra decidir se mostra a mensagem real pro cliente ou uma generica (ver comentario la').
export class ErroValidacaoPedido extends Error {}

function obterCliente() {
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error("MERCADOPAGO_ACCESS_TOKEN ausente no .env");
  }
  return new MercadoPagoConfig({ accessToken });
}

export type ItemCarrinho = { produto: Produto; cor: string; tamanho: string; quantidade: number };

export type FreteEscolhido = { servico: string; transportadora: string; preco: number; servicoId?: number };

export type EnderecoCheckout = {
  cep: string;
  rua: string;
  numero: string;
  complemento?: string;
  bairro: string;
  cidade: string;
  uf: string;
};

export type ClienteCheckout = {
  nomeCompleto: string;
  cpf: string;
  // E-mail e telefone sao OBRIGATORIOS desde 31/08/2026 (pedido do Brunno) - antes o site
  // dependia do e-mail que o Mercado Pago devolvia depois do pagamento, que pode vir mascarado
  // ("XXXXXXXXXXX", visto em producao) e nunca era usado pra nada de verdade. Validado tanto
  // aqui no servidor (ver criarPreferenciaPagamento abaixo) quanto no formulario do carrinho.
  email: string;
  telefone: string;
  endereco: EnderecoCheckout;
};

// Formato compacto guardado no metadata da preferencia (volta intacto no payload do
// pagamento quando o Mercado Pago chama o webhook - ver app/api/mercadopago/webhook) - assim
// o webhook nao depende de nenhum banco novo nem de tentar re-interpretar o titulo dos itens:
// os ids Bling ja vem resolvidos daqui (ver resolverProdutoIdBling), na hora da compra.
export type PedidoMetadata = {
  itens: { id: number; nome: string; qtd: number; valor: number }[];
  frete: number;
  nome: string;
  cpf: string;
  // Obrigatorios desde 31/08/2026 - ver comentario em ClienteCheckout acima.
  email: string;
  telefone: string;
  endereco: EnderecoCheckout;
  // Credito de loja (cashback) efetivamente aplicado nesse pedido, ja' revalidado no servidor
  // (ver calcularCreditoAplicavel abaixo) - o webhook usa esse valor pra consumir o credito
  // (lib/creditos.ts -> usarCredito) so' depois do pagamento aprovado de verdade.
  creditoAplicado: number;
  // Desconto de 10% do Pix efetivamente aplicado (0 quando o pagamento nao e' Pix, ou quando o
  // cupom deu desconto maior e por isso valeu o cupom) - so' informativo, o valor dos itens
  // acima ja' vem com o desconto.
  descontoPix?: number;
  // Dados do envio - o webhook usa isso pra salvar o pedido (lib/creditos.ts nao, isso e'
  // novo) e, quando nao for retirada, comprar a etiqueta automaticamente no Melhor Envio (ver
  // lib/melhorEnvio.ts). servicoId undefined quando e' retirada na loja.
  envio: { transportadora: string; servico: string; servicoId?: number } | null;
  quantidadeItens: number;
};

// Nunca confia no preco de frete que veio do carrinho (o mesmo raciocinio do preco dos
// produtos acima - alguem poderia adulterar a chamada da API direto, fora do site normal, e
// mandar frete a R$0 pra qualquer transportadora) - pedido do Brunno em 29/08/2026, junto com
// retirada na loja e frete gratis a partir de um valor.
async function revalidarFrete(
  freteEscolhido: FreteEscolhido | undefined,
  subtotalComDesconto: number,
  cepDestino: string,
  quantidadeItens: number
): Promise<FreteEscolhido | undefined> {
  if (!freteEscolhido) return undefined;

  // Retirada na loja e' sempre gratis - nao depende de cotacao nenhuma de transportadora.
  if (ehRetirada(freteEscolhido)) {
    return { servico: freteEscolhido.servico, transportadora: freteEscolhido.transportadora, preco: 0 };
  }

  // Entrega expressa em Reserva: gratis, feita pela equipe da Mozz, so' pra CEP de Reserva.
  // Revalidado aqui porque o carrinho pode ser adulterado (CEP de outra cidade com frete 0).
  if (ehEntregaExpressa(freteEscolhido)) {
    if (!cepDeReserva(cepDestino)) {
      throw new ErroValidacaoPedido(
        "A entrega expressa vale só para CEPs de Reserva - calcule o frete de novo e escolha outra opção"
      );
    }
    return {
      servico: FRETE_ENTREGA_EXPRESSA.servico,
      transportadora: FRETE_ENTREGA_EXPRESSA.transportadora,
      preco: 0
    };
  }

  // Frete pago de verdade - cota de novo no Melhor Envio com o CEP de entrega e usa o preco
  // que ELE devolve agora pra essa transportadora/servico, nunca o numero que veio do
  // carrinho. Se a opcao escolhida nao aparecer mais (cotacao mudou, servico saiu do ar), pede
  // pro cliente calcular de novo em vez de aceitar um preco nao verificado. Precisa disso
  // AQUI (mesmo quando o frete vai sair gratis pelo valor minimo abaixo) pra conseguir o
  // servicoId real - e' ele que a compra da etiqueta usa depois (ver lib/melhorEnvio.ts),
  // nao o nome do servico.
  const opcoesReais = await calcularFrete(cepDestino, quantidadeItens);
  const opcaoReal = opcoesReais.find(
    (o) => o.transportadora === freteEscolhido.transportadora && o.servico === freteEscolhido.servico
  );
  if (!opcaoReal) {
    throw new ErroValidacaoPedido(
      "A opção de frete escolhida não está mais disponível - calcule o frete de novo antes de continuar"
    );
  }

  // Frete gratis a partir de um valor minimo (configuravel em /admin/produtos, ver
  // lib/configLoja.ts) - se o carrinho bateu o valor, cobra zero independente do que o Melhor
  // Envio cotou pra essa transportadora (mas mantem servicoId real pra compra da etiqueta).
  const configuracaoLoja = await buscarConfiguracaoLoja();
  if (configuracaoLoja.freteGratisAcimaDe !== null && subtotalComDesconto >= configuracaoLoja.freteGratisAcimaDe) {
    return {
      servico: opcaoReal.servico,
      transportadora: opcaoReal.transportadora,
      preco: 0,
      servicoId: opcaoReal.servicoId
    };
  }

  return {
    servico: opcaoReal.servico,
    transportadora: opcaoReal.transportadora,
    preco: opcaoReal.preco,
    servicoId: opcaoReal.servicoId
  };
}

// Valida e monta o pedido (estoque, preco real do catalogo, cupom, frete, credito) - usado
// tanto pelo Checkout Pro (preferencia) quanto pelo pagamento dentro do site (Pix/cartao).
// Nunca confia em preco/frete/desconto que veio do navegador.
async function prepararPedido(
  itens: ItemCarrinho[],
  cliente: ClienteCheckout,
  frete?: FreteEscolhido,
  cupomCodigo?: string,
  creditoSolicitado?: number,
  metodo?: "pix" | "cartao"
) {
  if (!cliente.nomeCompleto.trim() || !validarCpf(cliente.cpf)) {
    throw new ErroValidacaoPedido("Nome completo e CPF válidos são obrigatórios pra finalizar a compra");
  }
  // E-mail e telefone obrigatorios desde 31/08/2026 - ver comentario em ClienteCheckout.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cliente.email.trim())) {
    throw new ErroValidacaoPedido("E-mail válido é obrigatório pra finalizar a compra");
  }
  if (!cliente.telefone.trim()) {
    throw new ErroValidacaoPedido("Telefone é obrigatório pra finalizar a compra");
  }
  const end = cliente.endereco;
  if (!end?.rua?.trim() || !end?.numero?.trim() || !end?.bairro?.trim() || !end?.cidade?.trim() || !end?.uf?.trim()) {
    throw new ErroValidacaoPedido("Endereço de entrega completo é obrigatório pra finalizar a compra");
  }

  // Revalida cada item do carrinho contra o catalogo real (data/produtos.json, atualizado a
  // cada 5min pelo sync-estoque) ANTES de criar a preferencia - nunca confia no que veio do
  // carrinho no navegador. Isso fecha dois problemas de uma vez, os dois levantados pelo
  // Brunno em 29/08/2026: (1) nada impedia comprar um tamanho que zerou o estoque entre a
  // cliente ver a pagina e finalizar a compra; (2) o preco usado era o que veio no corpo do
  // request (item.produto.preco) - alguem adulterando a chamada da API diretamente (fora do
  // site normal) conseguiria mandar qualquer preco. Dai' pra frente so' o preco/nome vindos
  // AGORA do catalogo (produtoReal) sao usados - o que veio do carrinho serve so' pra saber
  // QUAL produto/cor/tamanho/quantidade, nunca o preco.
  const itensValidados = await Promise.all(
    itens.map(async (item) => {
      const produtoReal = await buscarProduto(item.produto.id);
      if (!produtoReal) {
        throw new ErroValidacaoPedido(`"${item.produto.nome}" não está mais disponível`);
      }
      const corReal = coresDoProduto(produtoReal).find((c) => c.cor === item.cor);
      if (!corReal || !tamanhosDisponiveisDoColor(corReal).includes(item.tamanho)) {
        throw new ErroValidacaoPedido(
          `"${produtoReal.nome}" (${item.cor}, tamanho ${item.tamanho}) está sem estoque no momento`
        );
      }
      return { item, produtoReal };
    })
  );

  // O desconto do cupom (se houver) e' revalidado aqui no servidor - nunca confia no valor
  // calculado no carrinho no navegador. A Preference API do Mercado Pago nao aceita um item
  // de "desconto" com preco negativo, entao o jeito e' aplicar o desconto proporcionalmente
  // no preco unitario de cada item (reduz todo mundo pela mesma porcentagem), o que da' no
  // mesmo total final.
  const subtotal = itensValidados.reduce((soma, { item, produtoReal }) => soma + produtoReal.preco * item.quantidade, 0);
  let descontoCupom = 0;
  let codigoCupomAplicado: string | undefined;
  if (cupomCodigo && subtotal > 0) {
    const resultado = await validarCupom(cupomCodigo, subtotal, cliente.cpf);
    if (resultado.valido) {
      descontoCupom = resultado.desconto;
      codigoCupomAplicado = resultado.cupom.codigo;
    }
  }
  // Desconto do Pix (10%, 19/10/2026): NAO soma com cupom - vale o maior dos dois. Se o Pix
  // ganhar, o cupom nao e' aplicado (e por isso nao e' "gasto" no uso unico por CPF).
  let descontoPix = metodo === "pix" ? calcularDescontoPix(subtotal) : 0;
  let descontoAplicado = descontoCupom;
  if (descontoPix > descontoCupom) {
    descontoAplicado = descontoPix;
    codigoCupomAplicado = undefined;
  } else {
    descontoPix = 0;
  }
  const fatorDesconto = subtotal > 0 ? (subtotal - descontoAplicado) / subtotal : 1;
  const subtotalComDesconto = Math.round(subtotal * fatorDesconto * 100) / 100;

  // Revalida o frete (retirada/frete gratis/preco real da transportadora) so' DEPOIS de saber
  // o subtotal com desconto - o valor minimo do frete gratis compara com o subtotal depois do
  // CUPOM (o desconto do Pix nao tira o frete gratis da cliente). Ver revalidarFrete acima e
  // o mesmo calculo em app/carrinho/page.tsx.
  const subtotalAposCupom = Math.round((subtotal - descontoCupom) * 100) / 100;
  const quantidadeTotalItens = itens.reduce((soma, item) => soma + item.quantidade, 0);
  const freteSeguro = await revalidarFrete(frete, subtotalAposCupom, end.cep, quantidadeTotalItens);

  // Credito de loja (cashback) - revalidado aqui no servidor pelos mesmos motivos do cupom
  // acima: nunca confia no valor calculado no carrinho no navegador. O teto de uso (30% do
  // pedido) e' calculado em cima do valor JA com desconto de cupom + frete, a mesma base
  // "incluindo frete" usada pra conceder o cashback (ver lib/creditos.ts).
  const cpfLimpo = cliente.cpf.replace(/\D/g, "");
  const totalAntesCredito = Math.round((subtotalComDesconto + (freteSeguro?.preco ?? 0)) * 100) / 100;
  const saldoCredito = await buscarSaldoCredito(cpfLimpo);
  const creditoAplicado = calcularCreditoAplicavel(saldoCredito, creditoSolicitado ?? 0, totalAntesCredito);
  // Assim como o cupom, a Preference API do Mercado Pago nao aceita item com preco negativo -
  // o credito tambem entra como uma reducao proporcional, dessa vez em cima de TODOS os itens
  // (produtos ja' com o desconto do cupom, e o frete) pra poder cobrir ate' o valor do frete se
  // precisar, nao so' o valor dos produtos.
  const fatorCredito = totalAntesCredito > 0 ? Math.max(0, (totalAntesCredito - creditoAplicado) / totalAntesCredito) : 1;

  const itensPreferencia = itensValidados.map(({ item, produtoReal }) => ({
    id: produtoReal.id,
    title:
      item.cor && item.cor !== "Único"
        ? `${produtoReal.nome} (${item.cor}, ${item.tamanho})`
        : `${produtoReal.nome} (${item.tamanho})`,
    quantity: item.quantidade,
    unit_price: Math.round(produtoReal.preco * fatorDesconto * fatorCredito * 100) / 100,
    currency_id: "BRL",
    // resolvido AGORA (nao no webhook) pra nao depender do catalogo nao ter mudado ate' o
    // pagamento ser confirmado - ver resolverProdutoIdBling em lib/produtos.ts.
    _idBling: resolverProdutoIdBling(produtoReal, item.cor, item.tamanho)
  }));

  // Frete entra como um item a parte (o Mercado Pago nao tem um campo nativo de "frete" na
  // Preference API) - assim ele soma no total cobrado do cliente de verdade, em vez de ficar
  // so' informativo como estava antes (ver components/CalculoFrete.tsx).
  if (freteSeguro && freteSeguro.preco > 0) {
    itensPreferencia.push({
      id: "frete",
      title: `Frete - ${freteSeguro.transportadora} ${freteSeguro.servico}`,
      quantity: 1,
      unit_price: Math.round(freteSeguro.preco * fatorCredito * 100) / 100,
      currency_id: "BRL",
      _idBling: 0
    });
  }

  const pedidoMetadata: PedidoMetadata = {
    itens: itensValidados.map(({ item, produtoReal }, indice) => ({
      id: itensPreferencia[indice]._idBling,
      nome: `${produtoReal.nome} (${item.tamanho})`,
      qtd: item.quantidade,
      valor: itensPreferencia[indice].unit_price
    })),
    // Reflete o frete JA' com a reducao do credito aplicado (fatorCredito) - assim o valor
    // que vai pro Bling (totalFrete do pedido de venda) bate com o que foi realmente cobrado
    // do cliente via Mercado Pago, mesmo raciocinio ja' usado pro preco dos itens acima.
    frete: freteSeguro ? Math.round(freteSeguro.preco * fatorCredito * 100) / 100 : 0,
    nome: cliente.nomeCompleto.trim(),
    cpf: cpfLimpo,
    email: cliente.email.trim(),
    telefone: cliente.telefone.trim(),
    creditoAplicado,
    descontoPix,
    envio: freteSeguro
      ? { transportadora: freteSeguro.transportadora, servico: freteSeguro.servico, servicoId: freteSeguro.servicoId }
      : null,
    quantidadeItens: quantidadeTotalItens,
    endereco: {
      cep: end.cep.replace(/\D/g, ""),
      rua: end.rua.trim(),
      numero: end.numero.trim(),
      complemento: end.complemento?.trim() || undefined,
      bairro: end.bairro.trim(),
      cidade: end.cidade.trim(),
      uf: end.uf.trim().toUpperCase()
    }
  };

  // Valor total cobrado = soma exata dos itens ja' arredondados (o mesmo numero que o
  // Mercado Pago soma na preferencia) - e' esse valor que vai no transaction_amount do Pix/cartao.
  const valorTotal =
    Math.round(itensPreferencia.reduce((soma, item) => soma + item.unit_price * item.quantity, 0) * 100) / 100;

  return { itensPreferencia, pedidoMetadata, codigoCupomAplicado, valorTotal };
}

function metadataPedido(pedido: Awaited<ReturnType<typeof prepararPedido>>) {
  return {
    ...(pedido.codigoCupomAplicado ? { cupom: pedido.codigoCupomAplicado } : {}),
    pedido_json: JSON.stringify(pedido.pedidoMetadata)
  };
}

function urlSite() {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

export async function criarPreferenciaPagamento(
  itens: ItemCarrinho[],
  numeroPedido: string,
  cliente: ClienteCheckout,
  frete?: FreteEscolhido,
  cupomCodigo?: string,
  creditoSolicitado?: number
) {
  const pedido = await prepararPedido(itens, cliente, frete, cupomCodigo, creditoSolicitado);
  const { itensPreferencia, pedidoMetadata } = pedido;
  const preference = new Preference(obterCliente());
  const siteUrl = urlSite();

  const resposta = await preference.create({
    body: {
      external_reference: numeroPedido,
      items: itensPreferencia.map(({ _idBling, ...item }) => item),
      metadata: metadataPedido(pedido),
      payer: {
        name: cliente.nomeCompleto.trim().split(" ")[0],
        email: pedidoMetadata.email,
        identification: { type: "CPF", number: pedidoMetadata.cpf },
        address: {
          zip_code: pedidoMetadata.endereco.cep,
          street_name: pedidoMetadata.endereco.rua,
          street_number: pedidoMetadata.endereco.numero
        }
      },
      back_urls: {
        success: `${siteUrl}/checkout/sucesso`,
        failure: `${siteUrl}/checkout/erro`,
        pending: `${siteUrl}/checkout/pendente`
      },
      auto_return: "approved",
      notification_url: `${siteUrl}/api/mercadopago/webhook`
    }
  });

  return resposta;
}

// ---------------------------------------------------------------------------------------
// Pagamento DENTRO do site (Checkout Transparente) - 16/10/2026
// ---------------------------------------------------------------------------------------

// Quantas parcelas aceitar no cartao - o mesmo teto mostrado no site (MAX_PARCELAS_SEM_JUROS
// em lib/formato.ts). Revalidado aqui porque o numero de parcelas vem do navegador. (Era
// fixo em 3 e recusava qualquer compra em 4x ou mais - corrigido em 19/10/2026 junto com o 10x.)
const MAX_PARCELAS_CARTAO = MAX_PARCELAS_SEM_JUROS;
// Tempo pra pagar o Pix antes do QR Code expirar.
const MINUTOS_EXPIRACAO_PIX = 30;

export type DadosCartao = {
  token: string;
  paymentMethodId: string;
  issuerId?: number | string;
  parcelas: number;
  // documento do TITULAR do cartao (pode nao ser o mesmo CPF da nota fiscal)
  identificacao?: { tipo: string; numero: string };
};

function separarNome(nomeCompleto: string) {
  const partes = nomeCompleto.trim().split(/\s+/);
  return { first_name: partes[0] ?? "", last_name: partes.slice(1).join(" ") || partes[0] || "" };
}

function telefoneSeparado(telefone: string) {
  const d = telefone.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
  return { area_code: d.slice(0, 2), number: d.slice(2) };
}

// Data no formato que o Mercado Pago aceita (yyyy-MM-ddTHH:mm:ss.SSS-03:00), horario de Brasilia.
function dataExpiracao(minutos: number) {
  const brasilia = new Date(Date.now() + minutos * 60_000 - 3 * 3_600_000);
  return brasilia.toISOString().replace("Z", "-03:00");
}

// Corpo comum aos dois metodos: valor, referencia, metadata (o webhook depende disso), dados
// do comprador e "additional_info" - itens/endereco/telefone ajudam o antifraude do Mercado
// Pago a aprovar mais cartoes.
function corpoBasePagamento(
  pedido: Awaited<ReturnType<typeof prepararPedido>>,
  numeroPedido: string,
  cliente: ClienteCheckout
) {
  const { pedidoMetadata, itensPreferencia, valorTotal } = pedido;
  const nome = separarNome(pedidoMetadata.nome);
  return {
    transaction_amount: valorTotal,
    description: `Pedido ${numeroPedido} - MOZZ`,
    external_reference: numeroPedido,
    statement_descriptor: "MOZZ",
    notification_url: `${urlSite()}/api/mercadopago/webhook`,
    metadata: metadataPedido(pedido),
    additional_info: {
      items: itensPreferencia.map(({ _idBling, currency_id, ...item }) => ({
        ...item,
        id: String(item.id),
        category_id: item.id === "frete" ? "shipping" : "fashion"
      })),
      payer: {
        ...nome,
        phone: telefoneSeparado(cliente.telefone),
        address: {
          zip_code: pedidoMetadata.endereco.cep,
          street_name: pedidoMetadata.endereco.rua,
          street_number: pedidoMetadata.endereco.numero
        }
      },
      shipments: {
        receiver_address: {
          zip_code: pedidoMetadata.endereco.cep,
          street_name: pedidoMetadata.endereco.rua,
          street_number: pedidoMetadata.endereco.numero,
          apartment: pedidoMetadata.endereco.complemento,
          city_name: pedidoMetadata.endereco.cidade,
          state_name: pedidoMetadata.endereco.uf
        }
      }
    }
  };
}

// Se o total calculado agora no servidor nao bate com o que a cliente viu na tela (frete
// mudou, preco mudou no sync, cupom expirou), NAO cobra - pede pra ela conferir. Assim nunca
// sai uma cobranca de valor diferente do que estava escrito no botao.
// Tolerancia de R$ 1: o desconto de cupom/credito e' rateado item a item e arredondado em
// centavos, entao o total do servidor pode diferir uns centavos da tela - isso nao e' mudanca
// de verdade. Mudanca de frete/preco/cupom passa disso facil.
function conferirValorEsperado(valorTotal: number, valorEsperado: number | undefined) {
  if (typeof valorEsperado === "number" && Math.abs(valorTotal - valorEsperado) > 1) {
    throw new ErroValidacaoPedido(
      `O total do pedido foi atualizado para ${valorTotal.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL"
      })}. Recarregue a página para conferir antes de pagar.`
    );
  }
}

export async function criarPagamentoPix(
  itens: ItemCarrinho[],
  numeroPedido: string,
  cliente: ClienteCheckout,
  frete?: FreteEscolhido,
  cupomCodigo?: string,
  creditoSolicitado?: number,
  valorEsperado?: number
) {
  const pedido = await prepararPedido(itens, cliente, frete, cupomCodigo, creditoSolicitado, "pix");
  conferirValorEsperado(pedido.valorTotal, valorEsperado);
  const base = corpoBasePagamento(pedido, numeroPedido, cliente);

  const pagamento = await new Payment(obterCliente()).create({
    body: {
      ...base,
      payment_method_id: "pix",
      date_of_expiration: dataExpiracao(MINUTOS_EXPIRACAO_PIX),
      payer: {
        email: pedido.pedidoMetadata.email,
        ...separarNome(pedido.pedidoMetadata.nome),
        identification: { type: "CPF", number: pedido.pedidoMetadata.cpf }
      }
    },
    requestOptions: { idempotencyKey: randomUUID() }
  });

  const dadosPix = pagamento.point_of_interaction?.transaction_data;
  if (!pagamento.id || !dadosPix?.qr_code) {
    throw new Error(`Mercado Pago nao devolveu o QR Code do Pix (status ${pagamento.status})`);
  }
  return {
    pagamentoId: String(pagamento.id),
    status: pagamento.status ?? "pending",
    qrCode: dadosPix.qr_code,
    qrCodeBase64: dadosPix.qr_code_base64 ?? null,
    expiraEm: Date.now() + MINUTOS_EXPIRACAO_PIX * 60_000,
    valorTotal: pedido.valorTotal
  };
}

export async function criarPagamentoCartao(
  itens: ItemCarrinho[],
  numeroPedido: string,
  cliente: ClienteCheckout,
  cartao: DadosCartao,
  frete?: FreteEscolhido,
  cupomCodigo?: string,
  creditoSolicitado?: number,
  valorEsperado?: number,
  sessaoDispositivo?: string
) {
  if (!cartao?.token || !cartao.paymentMethodId) {
    throw new ErroValidacaoPedido("Confira os dados do cartão e tente de novo");
  }
  const parcelas = Math.round(Number(cartao.parcelas) || 1);
  if (parcelas < 1 || parcelas > MAX_PARCELAS_CARTAO) {
    throw new ErroValidacaoPedido(`Parcelamento disponível em até ${MAX_PARCELAS_CARTAO}x`);
  }

  const pedido = await prepararPedido(itens, cliente, frete, cupomCodigo, creditoSolicitado, "cartao");
  conferirValorEsperado(pedido.valorTotal, valorEsperado);
  // Parcela minima de R$ 60: o numero de parcelas tem que caber no valor do pedido (mesma regra
  // do site, calcularParcelamento). Folga de R$ 1 pelo mesmo motivo da tolerancia acima.
  const parcelasPermitidas = calcularParcelamento(pedido.valorTotal + 1)?.parcelas ?? 1;
  if (parcelas > parcelasPermitidas) {
    throw new ErroValidacaoPedido(`Para esse valor, o parcelamento vai até ${parcelasPermitidas}x`);
  }
  const base = corpoBasePagamento(pedido, numeroPedido, cliente);

  const documentoTitular = cartao.identificacao?.numero?.replace(/\D/g, "");
  const pagamento = await new Payment(obterCliente()).create({
    body: {
      ...base,
      token: cartao.token,
      payment_method_id: cartao.paymentMethodId,
      issuer_id: cartao.issuerId ? Number(cartao.issuerId) : undefined,
      installments: parcelas,
      payer: {
        email: pedido.pedidoMetadata.email,
        ...separarNome(pedido.pedidoMetadata.nome),
        identification: documentoTitular
          ? { type: cartao.identificacao?.tipo || "CPF", number: documentoTitular }
          : { type: "CPF", number: pedido.pedidoMetadata.cpf }
      }
    },
    requestOptions: {
      idempotencyKey: randomUUID(),
      ...(sessaoDispositivo ? { meliSessionId: sessaoDispositivo } : {})
    }
  });

  return {
    pagamentoId: String(pagamento.id ?? ""),
    status: pagamento.status ?? "rejected",
    statusDetalhe: pagamento.status_detail ?? "",
    valorTotal: pedido.valorTotal
  };
}

// So' o status (pra tela do Pix saber quando o pagamento caiu) - confere que o pagamento e'
// mesmo desse pedido, pra ninguem consultar pagamento dos outros pelo id.
export async function consultarStatusPagamento(pagamentoId: string, numeroPedido: string) {
  const pagamento = await new Payment(obterCliente()).get({ id: pagamentoId });
  if (pagamento.external_reference !== numeroPedido) return null;
  return pagamento.status ?? null;
}

// Motivo de recusa do cartao em linguagem de gente (os codigos sao do Mercado Pago:
// mercadopago.com.br/developers/pt/docs/checkout-api/response-handling/collection-results)
export function mensagemRecusaCartao(statusDetalhe: string): string {
  const mensagens: Record<string, string> = {
    cc_rejected_bad_filled_card_number: "Confira o número do cartão.",
    cc_rejected_bad_filled_date: "Confira a data de validade do cartão.",
    cc_rejected_bad_filled_security_code: "Confira o código de segurança (CVV).",
    cc_rejected_bad_filled_other: "Confira os dados do cartão.",
    cc_rejected_insufficient_amount: "O cartão não tem limite suficiente. Tente outro cartão ou pague com Pix.",
    cc_rejected_call_for_authorize: "O banco pediu autorização. Ligue para o seu banco liberar a compra e tente de novo.",
    cc_rejected_card_disabled: "O cartão está bloqueado para compras online. Ligue para o seu banco ou use outro cartão.",
    cc_rejected_duplicated_payment: "Já existe um pagamento igual a esse. Se precisar pagar de novo, use outro cartão ou Pix.",
    cc_rejected_high_risk: "O pagamento foi recusado pela análise de segurança. Tente com Pix ou outro cartão.",
    cc_rejected_max_attempts: "Muitas tentativas com esse cartão. Use outro cartão ou pague com Pix.",
    cc_rejected_invalid_installments: "Esse cartão não aceita esse número de parcelas.",
    cc_rejected_blacklist: "Não foi possível processar esse cartão. Tente com Pix ou outro cartão.",
    cc_rejected_card_error: "Não foi possível processar o pagamento. Tente de novo ou use Pix."
  };
  return mensagens[statusDetalhe] ?? "O pagamento não foi aprovado. Tente outro cartão ou pague com Pix.";
}

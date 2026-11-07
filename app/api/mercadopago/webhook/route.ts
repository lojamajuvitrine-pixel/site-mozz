import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { criarPedidoVendaBling, type ItemPedidoBling } from "@/lib/bling";
import type { PedidoMetadata } from "@/lib/mercadopago";
import { CUPONS } from "@/lib/cupons";
import { clientePublico } from "@/lib/supabase/publico";
import { SUPABASE_CONFIGURADO } from "@/lib/supabase/config";
import { usarCredito, concederCashback } from "@/lib/creditos";
import { comprarEGerarEtiqueta } from "@/lib/melhorEnvio";
import { enviarEmailConfirmacaoPedido } from "@/lib/emailPedido";
import { ehEntregaExpressa, ehRetirada } from "@/lib/frete";
import { baixarEstoqueVenda } from "@/lib/estoqueGravacao";
import { enviarCompraGA4 } from "@/lib/ga4";

// O Mercado Pago chama essa rota automaticamente quando o status de um pagamento muda.
// Documentacao: mercadopago.com.br/developers/pt/docs/checkout-pro/additional-content/notifications/webhooks
//
// Fluxo completo:
// 1. Valida a assinatura (header x-signature) usando MERCADOPAGO_WEBHOOK_SECRET - garante que
//    a notificacao realmente veio do Mercado Pago. Desde 21/10/2026, um aviso de PAGAMENTO sem
//    assinatura valida nao e' mais descartado: o Mercado Pago manda o mesmo evento em mais de um
//    formato (o webhook novo assinado, com ?data.id=, e o aviso antigo "IPN", com ?topic=payment&id=,
//    que nao passa nessa validacao), e descartar arriscava perder uma compra paga se o assinado
//    falhasse. Em vez disso o pagamento e' conferido direto na API do Mercado Pago com o token da
//    loja (passo 2), que e' a fonte verdadeira - um aviso falso nao consegue inventar um pagamento
//    aprovado. Avisos que nao sao de pagamento (ex: merchant_order) sao ignorados sem erro.
// 2. Busca o pagamento de verdade (GET /v1/payments/{id}) - nunca confia so' no payload do
//    webhook, que so' avisa "algo mudou", nao traz o status.
// 3. Se aprovado, le o pedido resolvido que a gente mesmo guardou no metadata da preferencia
//    (ver PedidoMetadata em lib/mercadopago.ts - itens ja' com o id BLING certo, cliente,
//    frete) e cria o pedido de venda no Bling.
// 4. Se um cupom de USO UNICO POR CPF (ex: primeira compra) foi usado nesse pedido, registra
//    esse uso agora - so' aqui, com o pagamento ja aprovado de verdade, nunca no momento em
//    que o cliente so' aplicou o cupom no carrinho (carrinho abandonado nao pode "gastar" o
//    cupom - pedido do Brunno em 30/08/2026, ver lib/cupom.ts).
//
// Idempotencia: o Mercado Pago pode chamar esse webhook mais de uma vez pro MESMO pagamento
// (reenvio em caso de timeout, por exemplo). Sem um banco proprio pra marcar "ja processado",
// a defesa aqui e' deixar o Bling recusar numeroLoja duplicado (numeroPedidoLoja = mesmo
// external_reference sempre) e tratar esse erro especifico como sucesso silencioso. Se no
// futuro isso causar pedido duplicado na pratica, o proximo passo e' guardar o pedido numa
// tabela (Supabase) na hora de criar a preferencia e checar o status ali antes de criar de novo.
// O registro de uso do cupom (passo 4) e' idempotente por natureza (ON CONFLICT DO NOTHING na
// funcao registrar_uso_cupom), entao chamar duas vezes pro mesmo pagamento nao causa problema.
function validarAssinatura(request: NextRequest, corpoBruto: string): boolean {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  if (!secret) {
    console.warn("MERCADOPAGO_WEBHOOK_SECRET ausente - pulando validacao de assinatura (INSEGURO)");
    return true; // nao bloqueia em ambiente sem o secret configurado ainda
  }

  const xSignature = request.headers.get("x-signature");
  const xRequestId = request.headers.get("x-request-id");
  const dataId = request.nextUrl.searchParams.get("data.id");
  if (!xSignature || !xRequestId || !dataId) return false;

  const partes = Object.fromEntries(
    xSignature.split(",").map((parte) => {
      const [chave, valor] = parte.split("=");
      return [chave.trim(), valor?.trim()];
    })
  );
  const ts = partes.ts;
  const v1 = partes.v1;
  if (!ts || !v1) return false;

  const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
  const hashCalculado = createHmac("sha256", secret).update(manifest).digest("hex");

  try {
    return timingSafeEqual(Buffer.from(hashCalculado), Buffer.from(v1));
  } catch {
    return false; // tamanhos diferentes = timingSafeEqual lanca erro em vez de devolver false
  }
}

type PagamentoMercadoPago = {
  status: string;
  external_reference?: string;
  metadata?: Record<string, unknown>;
};

// So' registra uso pra cupom marcado usoUnicoPorCpf (ver lib/cupons.ts) - cupom de promocao
// comum nao precisa de nenhum registro, pode ser usado quantas vezes quiser. Nunca lanca erro
// pra fora: se isso falhar, o pior cenario e' alguem conseguir reusar um cupom de primeira
// compra, o que e' bem menos grave que travar um pedido cujo pagamento ja foi aprovado.
async function registrarUsoCupomSeNecessario(codigoCupom: string | undefined, cpf: string): Promise<void> {
  if (!codigoCupom || !SUPABASE_CONFIGURADO) return;
  const cupom = CUPONS.find((c) => c.codigo.toUpperCase() === codigoCupom.toUpperCase());
  if (!cupom?.usoUnicoPorCpf) return;
  try {
    const supabase = clientePublico();
    const { error } = await supabase.rpc("registrar_uso_cupom", {
      p_cupom_codigo: cupom.codigo,
      p_cpf: cpf
    });
    if (error) throw error;
  } catch (erro) {
    console.error(`Webhook Mercado Pago: erro ao registrar uso do cupom ${codigoCupom}:`, erro);
  }
}

// Consome o credito de loja aplicado nesse pedido (se houver) e concede o cashback dessa
// compra - so' chamado depois do pagamento aprovado e do pedido criado no Bling, mesmo
// racional de registrarUsoCupomSeNecessario acima (carrinho abandonado nao "gasta" nem "gera"
// credito). O valor base do cashback e' o que a cliente REALMENTE pagou (itens + frete, ja'
// com qualquer desconto de cupom e credito aplicados - ver PedidoMetadata em
// lib/mercadopago.ts), nunca o subtotal cheio antes de descontos: se fosse sobre o valor cheio,
// aplicar credito reduziria o preco pago sem reduzir o cashback da proxima compra, dando pra
// "reciclar" credito sem nunca gastar de verdade. Ambas as chamadas sao idempotentes por
// natureza (usar_credito e conceder_credito - ver migration criar_sistema_creditos_cashback),
// entao chamar de novo pro mesmo pedido (reenvio de webhook) nao causa problema.
async function processarCreditoSeNecessario(pedido: PedidoMetadata, numeroPedidoLoja: string): Promise<void> {
  if (pedido.creditoAplicado > 0) {
    await usarCredito(pedido.cpf, pedido.creditoAplicado, numeroPedidoLoja);
  }
  const valorPago = pedido.itens.reduce((soma, item) => soma + item.valor * item.qtd, 0) + pedido.frete;
  await concederCashback(pedido.cpf, valorPago, numeroPedidoLoja);
}

// Salva o registro do pedido na tabela 'pedidos' (historico real pra "Minha conta", ver
// migration criar_pedidos_e_rastreio) e, so' na PRIMEIRA vez que esse pedido e' salvo de
// verdade (nunca num reenvio do webhook - ver salvar_pedido, que devolve true so' quando
// insere): manda o e-mail de confirmacao pro cliente, e - so' quando o envio for por Correios -
// compra e gera a etiqueta automaticamente no Melhor Envio. Se a compra da etiqueta falhar
// (saldo insuficiente, Melhor Envio fora do ar, autorizacao ainda pendente etc), marca
// falha_etiqueta e segue em frente - o pedido ja esta' criado no Bling de qualquer jeito, o
// Brunno so' precisa gerar a etiqueta na mao nesse caso (combinado com ele em 31/08/2026).
async function salvarPedidoEComprarEtiquetaSeNecessario(
  pedido: PedidoMetadata,
  numeroPedidoLoja: string,
  cupomCodigo: string | undefined
): Promise<void> {
  if (!SUPABASE_CONFIGURADO) return;

  const subtotal = pedido.itens.reduce((soma, item) => soma + item.valor * item.qtd, 0);
  const valorTotal = Math.round((subtotal + pedido.frete) * 100) / 100;
  // Retirada na loja e entrega expressa em Reserva tambem chegam com pedido.envio preenchido
  // (transportadora "Retirada" / "Entrega expressa", sem servicoId) - antes qualquer envio era
  // tratado como "correios", entao o e-mail de quem retirou na loja dizia "pelos Correios".
  const formaEnvio: "correios" | "retirada" | "entrega_local" = !pedido.envio
    ? "retirada"
    : ehRetirada(pedido.envio)
      ? "retirada"
      : ehEntregaExpressa(pedido.envio)
        ? "entrega_local"
        : "correios";

  let inseriuAgora = false;
  try {
    const supabase = clientePublico();
    const { data, error } = await supabase.rpc("salvar_pedido", {
      p_numero_pedido: numeroPedidoLoja,
      p_cpf: pedido.cpf,
      p_nome: pedido.nome,
      p_itens: pedido.itens,
      p_subtotal: subtotal,
      p_frete: pedido.frete,
      p_credito_aplicado: pedido.creditoAplicado,
      p_cupom_codigo: cupomCodigo ?? null,
      p_valor_total: valorTotal,
      p_forma_envio: formaEnvio,
      p_endereco: pedido.endereco,
      p_email: pedido.email
    });
    if (error) throw error;
    inseriuAgora = data === true;
  } catch (erro) {
    console.error(`Webhook Mercado Pago: erro ao salvar pedido ${numeroPedidoLoja} em 'pedidos':`, erro);
    return;
  }

  if (!inseriuAgora) return;

  // Estoque ao vivo (07/11/2026): baixa as pecas vendidas na hora, sem esperar o Bling avisar o
  // site - assim a mesma peca unica nao fica a venda pra outra cliente nesse meio-tempo.
  await baixarEstoqueVenda(
    pedido.itens.filter((item) => item.id > 0).map((item) => ({ id: item.id, qtd: item.qtd }))
  );

  // Compra no Google Analytics/Google Ads (07/11/2026) - so' na primeira vez, com o valor real
  // pago. Conta tambem o Pix pago depois, com a pagina fechada (ver lib/ga4.ts).
  await enviarCompraGA4({
    numeroPedido: numeroPedidoLoja,
    valorTotal,
    frete: pedido.frete,
    itens: pedido.itens,
    gaClientId: pedido.ga?.c,
    gaSessionId: pedido.ga?.s
  });

  // So' manda o e-mail na PRIMEIRA vez (mesmo raciocinio do resto dessa funcao) - nunca em
  // dobro se o Mercado Pago reenviar o mesmo webhook. Vale pras duas formas de envio
  // (Correios ou retirada), diferente da compra de etiqueta abaixo que e' so' Correios.
  //
  // Usa pedido.email (digitado pela propria cliente no checkout, obrigatorio desde
  // 31/08/2026) em vez do e-mail que o Mercado Pago devolve depois do pagamento - esse pode
  // vir mascarado ("XXXXXXXXXXX", visto em producao) e nao da' mais pra confiar nele.
  await enviarEmailConfirmacaoPedido({
    emailCliente: pedido.email,
    nomeCliente: pedido.nome,
    numeroPedido: numeroPedidoLoja,
    itens: pedido.itens,
    subtotal,
    frete: pedido.frete,
    valorTotal,
    creditoAplicado: pedido.creditoAplicado,
    cupomCodigo,
    formaEnvio,
    endereco: pedido.endereco
  });

  if (formaEnvio !== "correios" || !pedido.envio?.servicoId) return;

  try {
    const resultado = await comprarEGerarEtiqueta({
      servicoId: pedido.envio.servicoId,
      transportadora: pedido.envio.transportadora,
      servico: pedido.envio.servico,
      nomeCliente: pedido.nome,
      cpfLimpo: pedido.cpf,
      telefone: pedido.telefone,
      endereco: pedido.endereco,
      itens: pedido.itens.map((item) => ({ nome: item.nome, quantidade: item.qtd, valor: item.valor })),
      numeroPedidoLoja
    });
    const supabase = clientePublico();
    await supabase.rpc("atualizar_rastreio_pedido", {
      p_numero_pedido: numeroPedidoLoja,
      p_melhor_envio_id: resultado.melhorEnvioId,
      p_transportadora: resultado.transportadora,
      p_servico: resultado.servico,
      p_codigo_rastreio: resultado.codigoRastreio,
      p_link_rastreio: resultado.linkRastreio,
      p_status_envio: "etiqueta_gerada"
    });
    console.log(`Webhook Mercado Pago: etiqueta comprada no Melhor Envio pro pedido ${numeroPedidoLoja}`, resultado.melhorEnvioId);
  } catch (erro) {
    console.error(`Webhook Mercado Pago: falha ao comprar/gerar etiqueta no Melhor Envio pro pedido ${numeroPedidoLoja}:`, erro);
    try {
      const supabase = clientePublico();
      await supabase.rpc("marcar_falha_etiqueta", { p_numero_pedido: numeroPedidoLoja });
    } catch (erroMarcar) {
      console.error(`Webhook Mercado Pago: erro ao marcar falha_etiqueta pro pedido ${numeroPedidoLoja}:`, erroMarcar);
    }
  }
}

// Aviso antigo (IPN) as vezes manda so' o "resource" (ex: ".../payments/123456" ou "123456").
function idDoResource(resource: string | undefined): string | null {
  const achado = resource?.match(/(\d+)\s*$/);
  return achado ? achado[1] : null;
}

export async function POST(request: NextRequest) {
  const corpoBruto = await request.text();
  const params = request.nextUrl.searchParams;

  let corpo: { type?: string; topic?: string; action?: string; resource?: string; data?: { id?: string } } = {};
  try {
    corpo = corpoBruto ? JSON.parse(corpoBruto) : {};
  } catch {
    corpo = {}; // aviso antigo pode vir sem corpo JSON - os dados ficam na URL
  }

  // Formatos que o Mercado Pago manda pro mesmo evento:
  //  - webhook novo (assinado): ?data.id=123&type=payment, corpo {type:"payment", action:"payment.updated", data:{id}}
  //  - aviso antigo (IPN): ?topic=payment&id=123 (ou corpo {topic, resource}) - nao passa na assinatura
  //  - merchant_order: aviso de "pedido", nao de pagamento - ignorado
  const tipo = corpo.type ?? corpo.topic ?? params.get("type") ?? params.get("topic") ?? "";
  const ehPagamento = tipo === "payment" || (corpo.action ?? "").startsWith("payment.");
  const idBruto =
    corpo.data?.id ?? params.get("data.id") ?? (ehPagamento ? params.get("id") ?? idDoResource(corpo.resource) : null);
  const paymentId = idBruto && /^\d+$/.test(String(idBruto)) ? String(idBruto) : null;

  if (!ehPagamento || !paymentId) {
    console.log(`Webhook Mercado Pago: aviso "${tipo || "sem tipo"}" ignorado (nao e' de pagamento)`);
    return NextResponse.json({ recebido: true });
  }

  if (!validarAssinatura(request, corpoBruto)) {
    // Nao descarta mais (ver passo 1 no comentario do topo): segue e confere o pagamento direto
    // na API do Mercado Pago abaixo, com o token da loja.
    console.warn(
      `Webhook Mercado Pago: aviso do pagamento ${paymentId} sem assinatura valida (formato ${params.get("topic") ? "antigo/IPN" : "webhook"}) - conferindo direto na API`
    );
  }

  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!accessToken) {
    console.error("Webhook Mercado Pago: MERCADOPAGO_ACCESS_TOKEN ausente");
    return NextResponse.json({ erro: "config ausente" }, { status: 500 });
  }

  const respostaPagamento = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!respostaPagamento.ok) {
    console.error(`Webhook Mercado Pago: erro ao buscar pagamento ${paymentId}: ${respostaPagamento.status}`);
    return NextResponse.json({ erro: "erro ao buscar pagamento" }, { status: 502 });
  }
  const pagamento = (await respostaPagamento.json()) as PagamentoMercadoPago;

  console.log(`Webhook Mercado Pago: pagamento ${paymentId} status=${pagamento.status}`);

  if (pagamento.status !== "approved") {
    return NextResponse.json({ recebido: true });
  }

  const pedidoJson = pagamento.metadata?.pedido_json;
  if (typeof pedidoJson !== "string") {
    console.error(`Webhook Mercado Pago: pagamento ${paymentId} aprovado mas sem metadata.pedido_json`);
    return NextResponse.json({ erro: "pedido sem metadata" }, { status: 200 }); // 200 pra nao ficar re-tentando pra sempre
  }

  let pedido: PedidoMetadata;
  try {
    pedido = JSON.parse(pedidoJson);
  } catch {
    console.error(`Webhook Mercado Pago: pagamento ${paymentId} com metadata.pedido_json invalido`);
    return NextResponse.json({ erro: "metadata invalida" }, { status: 200 });
  }

  const codigoCupomUsado = typeof pagamento.metadata?.cupom === "string" ? pagamento.metadata.cupom : undefined;

  const itensBling: ItemPedidoBling[] = pedido.itens
    .filter((item) => item.id > 0) // id 0 = item "frete" (nao e' produto no Bling)
    .map((item) => ({ produtoId: item.id, quantidade: item.qtd, valor: item.valor }));

  const numeroPedidoLoja = pagamento.external_reference ?? `MP-${paymentId}`;

  try {
    const resultado = await criarPedidoVendaBling({
      numeroPedidoLoja,
      cliente: {
        nome: pedido.nome,
        cpf: pedido.cpf,
        // pedido.email (digitado pela cliente no checkout) em vez de pagamento.payer?.email -
        // esse ultimo pode vir mascarado pelo Mercado Pago ("XXXXXXXXXXX", visto em producao
        // em 31/08/2026), o que sujava o cadastro do cliente no Bling tambem.
        email: pedido.email,
        telefone: pedido.telefone
      },
      endereco: pedido.endereco,
      itens: itensBling,
      totalFrete: pedido.frete
    });

    console.log(`Webhook Mercado Pago: pedido de venda criado no Bling pro pagamento ${paymentId}`, resultado);
    await registrarUsoCupomSeNecessario(codigoCupomUsado, pedido.cpf);
    await processarCreditoSeNecessario(pedido, numeroPedidoLoja);
    await salvarPedidoEComprarEtiquetaSeNecessario(pedido, numeroPedidoLoja, codigoCupomUsado);
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : String(erro);
    // numeroLoja duplicado = provavelmente reenvio do mesmo webhook (ver comentario de
    // idempotencia acima) - trata como sucesso silencioso em vez de erro.
    if (/numeroLoja|duplicad/i.test(mensagem)) {
      console.warn(`Webhook Mercado Pago: pedido do pagamento ${paymentId} parece ja existir no Bling - ignorando`);
      await registrarUsoCupomSeNecessario(codigoCupomUsado, pedido.cpf);
      await processarCreditoSeNecessario(pedido, numeroPedidoLoja);
      await salvarPedidoEComprarEtiquetaSeNecessario(pedido, numeroPedidoLoja, codigoCupomUsado);
      return NextResponse.json({ recebido: true, duplicado: true });
    }
    console.error(`Webhook Mercado Pago: erro ao criar pedido no Bling pro pagamento ${paymentId}:`, mensagem);
    // devolve 500 aqui (nao 200) pra o Mercado Pago RE-TENTAR essa notificacao depois - erro
    // de rede/Bling fora do ar e' recuperavel, diferente dos casos de dado invalido acima.
    return NextResponse.json({ erro: "erro ao criar pedido no Bling" }, { status: 500 });
  }

  return NextResponse.json({ recebido: true });
}

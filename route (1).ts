import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { criarPedidoVendaBling, type ItemPedidoBling } from "@/lib/bling";
import type { PedidoMetadata } from "@/lib/mercadopago";
import { CUPONS } from "@/lib/cupons";
import { clientePublico } from "@/lib/supabase/publico";
import { SUPABASE_CONFIGURADO } from "@/lib/supabase/config";
import { usarCredito, concederCashback } from "@/lib/creditos";

// O Mercado Pago chama essa rota automaticamente quando o status de um pagamento muda.
// Documentacao: mercadopago.com.br/developers/pt/docs/checkout-pro/additional-content/notifications/webhooks
//
// Fluxo completo:
// 1. Valida a assinatura (header x-signature) usando MERCADOPAGO_WEBHOOK_SECRET - garante que
//    a notificacao realmente veio do Mercado Pago.
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
  payer?: { email?: string };
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

export async function POST(request: NextRequest) {
  const corpoBruto = await request.text();

  if (!validarAssinatura(request, corpoBruto)) {
    console.error("Webhook Mercado Pago: assinatura invalida, ignorando notificacao");
    return NextResponse.json({ erro: "assinatura invalida" }, { status: 401 });
  }

  let corpo: { type?: string; data?: { id?: string } };
  try {
    corpo = JSON.parse(corpoBruto);
  } catch {
    return NextResponse.json({ erro: "corpo invalido" }, { status: 400 });
  }

  // So' processa notificacoes de pagamento - o Mercado Pago tambem manda outros tipos
  // ("merchant_order" etc) que a gente ignora.
  const paymentId = corpo.data?.id ?? request.nextUrl.searchParams.get("data.id");
  if (corpo.type !== "payment" || !paymentId) {
    return NextResponse.json({ recebido: true });
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
        email: pagamento.payer?.email ?? "",
        telefone: pedido.telefone
      },
      endereco: pedido.endereco,
      itens: itensBling,
      totalFrete: pedido.frete
    });

    console.log(`Webhook Mercado Pago: pedido de venda criado no Bling pro pagamento ${paymentId}`, resultado);
    await registrarUsoCupomSeNecessario(codigoCupomUsado, pedido.cpf);
    await processarCreditoSeNecessario(pedido, numeroPedidoLoja);
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : String(erro);
    // numeroLoja duplicado = provavelmente reenvio do mesmo webhook (ver comentario de
    // idempotencia acima) - trata como sucesso silencioso em vez de erro.
    if (/numeroLoja|duplicad/i.test(mensagem)) {
      console.warn(`Webhook Mercado Pago: pedido do pagamento ${paymentId} parece ja existir no Bling - ignorando`);
      await registrarUsoCupomSeNecessario(codigoCupomUsado, pedido.cpf);
      await processarCreditoSeNecessario(pedido, numeroPedidoLoja);
      return NextResponse.json({ recebido: true, duplicado: true });
    }
    console.error(`Webhook Mercado Pago: erro ao criar pedido no Bling pro pagamento ${paymentId}:`, mensagem);
    // devolve 500 aqui (nao 200) pra o Mercado Pago RE-TENTAR essa notificacao depois - erro
    // de rede/Bling fora do ar e' recuperavel, diferente dos casos de dado invalido acima.
    return NextResponse.json({ erro: "erro ao criar pedido no Bling" }, { status: 500 });
  }

  return NextResponse.json({ recebido: true });
}

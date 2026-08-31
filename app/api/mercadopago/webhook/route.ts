import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { criarPedidoVendaBling, type ItemPedidoBling } from "@/lib/bling";
import type { PedidoMetadata } from "@/lib/mercadopago";
import { CUPONS } from "@/lib/cupons";
import { clientePublico } from "@/lib/supabase/publico";
import { SUPABASE_CONFIGURADO } from "@/lib/supabase/config";
import { usarCredito, concederCashback } from "@/lib/creditos";
import { comprarEGerarEtiqueta } from "@/lib/melhorEnvio";

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

// Salva o registro do pedido na tabela 'pedidos' (historico real pra "Minha conta", ver
// migration criar_pedidos_e_rastreio) e, so' na PRIMEIRA vez que esse pedido e' salvo de
// verdade (nunca num reenvio do webhook - ver salvar_pedido, que devolve true so' quando
// insere), compra e gera a etiqueta automaticamente no Melhor Envio quando o envio for por
// Correios. Se a compra da etiqueta falhar (saldo insuficiente, Melhor Envio fora do ar,
// autorizacao ainda pendente etc), marca falha_etiqueta e segue em frente - o pedido ja esta'
// criado no Bling de qualquer jeito, o Brunno so' precisa gerar a etiqueta na mao nesse caso
// (combinado com ele em 31/08/2026).
async function salvarPedidoEComprarEtiquetaSeNecessario(
  pedido: PedidoMetadata,
  numeroPedidoLoja: string,
  cupomCodigo: string | undefined
): Promise<void> {
  if (!SUPABASE_CONFIGURADO) return;

  const subtotal = pedido.itens.reduce((soma, item) => soma + item.valor * item.qtd, 0);
  const valorTotal = Math.round((subtotal + pedido.frete) * 100) / 100;
  const formaEnvio = pedido.envio ? "correios" : "retirada";

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
      p_endereco: pedido.endereco
    });
    if (error) throw error;
    inseriuAgora = data === true;
  } catch (erro) {
    console.error(`Webhook Mercado Pago: erro ao salvar pedido ${numeroPedidoLoja} em 'pedidos':`, erro);
    return;
  }

  if (!inseriuAgora || formaEnvio !== "correios" || !pedido.envio?.servicoId) return;

  try {
    const resultado = await comprarEGerarEtiqueta({
      servicoId: pedido.envio.servicoId,
      transportadora: pedido.envio.transportadora,
      servico: pedido.envio.servico,
      nomeCliente: pedido.nome,
      cpfLimpo: pedido.cpf,
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
    console.log(`Webhook Mercado Pago: etiqueta comprada no Melhor Envio pro pedido

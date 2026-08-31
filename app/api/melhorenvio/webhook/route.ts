import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { clientePublico } from "@/lib/supabase/publico";

// Recebe os avisos do Melhor Envio quando uma etiqueta muda de status (gerada, postada,
// entregue etc) - pedido do Brunno em 31/08/2026, junto com a compra automatica da etiqueta
// (ver lib/melhorEnvio.ts e app/api/mercadopago/webhook). Documentacao:
// docs.melhorenvio.com.br/docs/webhooks
//
// IMPORTANTE: o formato exato do payload (nomes dos campos dentro de "data") NAO esta'
// documentado em detalhe - o codigo abaixo tenta os nomes mais prováveis (id/protocol/
// tracking/status) e ignora silenciosamente qualquer campo que nao vier, em vez de quebrar.
// Se o primeiro pedido real mostrar um formato diferente, e' so' ajustar aqui - o pedido em si
// (Bling, cashback) nunca depende deste webhook pra funcionar, so' o status/rastreio exibido
// em "Minha conta" fica desatualizado ate' o ajuste.
//
// Assinatura: o Melhor Envio assina o corpo com HMAC-SHA256 usando o segredo do app
// (X-ME-Signature) - configuravel em MELHOR_ENVIO_WEBHOOK_SECRET. Sem esse valor configurado,
// a rota aceita sem validar (mesmo comportamento "inseguro mas nao trava" do webhook do
// Mercado Pago antes do secret existir, ver app/api/mercadopago/webhook).
function validarAssinatura(corpoBruto: string, assinaturaRecebida: string | null): boolean {
  const secret = process.env.MELHOR_ENVIO_WEBHOOK_SECRET;
  if (!secret) {
    console.warn("MELHOR_ENVIO_WEBHOOK_SECRET ausente - pulando validação de assinatura (INSEGURO)");
    return true;
  }
  if (!assinaturaRecebida) return false;
  const hashCalculado = createHmac("sha256", secret).update(corpoBruto).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(hashCalculado), Buffer.from(assinaturaRecebida));
  } catch {
    return false;
  }
}

// event -> status_envio da nossa tabela pedidos (ver migration criar_pedidos_e_rastreio).
// Eventos sem mapeamento (order.created, order.pending, order.cancelled etc) sao ignorados -
// so' interessa pro cliente ver "gerado" -> "postado" -> "entregue".
const MAPA_STATUS: Record<string, string> = {
  "order.generated": "etiqueta_gerada",
  "order.posted": "postado",
  "order.delivered": "entregue"
};

type PayloadWebhook = {
  event?: string;
  data?: {
    id?: string;
    order_id?: string;
    tracking?: string;
    protocol?: string;
    tracking_url?: string;
  };
};

export async function POST(request: NextRequest) {
  const corpoBruto = await request.text();

  if (!validarAssinatura(corpoBruto, request.headers.get("x-me-signature"))) {
    console.error("Webhook Melhor Envio: assinatura inválida, ignorando notificação");
    return NextResponse.json({ erro: "assinatura invalida" }, { status: 401 });
  }

  let corpo: PayloadWebhook;
  try {
    corpo = JSON.parse(corpoBruto);
  } catch {
    return NextResponse.json({ erro: "corpo invalido" }, { status: 400 });
  }

  const statusNovo = corpo.event ? MAPA_STATUS[corpo.event] : undefined;
  const melhorEnvioId = corpo.data?.id ?? corpo.data?.order_id;
  if (!statusNovo || !melhorEnvioId) {
    // Evento que a gente nao mapeia (ex: order.created) ou sem id reconhecivel - nao e' erro,
    // so' nao ha' nada pra atualizar.
    return NextResponse.json({ recebido: true });
  }

  try {
    const supabase = clientePublico();
    const { data: pedidos, error: erroBusca } = await supabase.rpc("pedido_por_melhor_envio_id", {
      p_melhor_envio_id: melhorEnvioId
    });
    if (erroBusca || !pedidos || pedidos.length === 0) {
      console.warn(`Webhook Melhor Envio: nenhum pedido encontrado pro id ${melhorEnvioId}`);
      return NextResponse.json({ recebido: true });
    }
    const pedido = pedidos[0] as { numero_pedido: string };

    const { error: erroUpdate } = await supabase.rpc("atualizar_rastreio_pedido", {
      p_numero_pedido: pedido.numero_pedido,
      p_melhor_envio_id: melhorEnvioId,
      p_transportadora: null,
      p_servico: null,
      p_codigo_rastreio: corpo.data?.tracking ?? corpo.data?.protocol ?? null,
      p_link_rastreio: corpo.data?.tracking_url ?? null,
      p_status_envio: statusNovo
    });
    if (erroUpdate) throw erroUpdate;
  } catch (erro) {
    console.error("Webhook Melhor Envio: erro ao atualizar rastreio:", erro);
    return NextResponse.json({ erro: "erro ao atualizar rastreio" }, { status: 500 });
  }

  return NextResponse.json({ recebido: true });
}

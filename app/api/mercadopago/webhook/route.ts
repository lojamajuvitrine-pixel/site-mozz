import { NextRequest, NextResponse } from "next/server";
import { criarPedidoVendaBling } from "@/lib/bling";

// O Mercado Pago chama essa rota automaticamente quando o status de um pagamento muda.
// Documentacao: mercadopago.com.br/developers/pt/docs/checkout-pro/additional-content/notifications/webhooks
//
// IMPORTANTE (fazer antes de ir pra producao): validar a assinatura do webhook usando o
// header "x-signature" + o segredo gerado no painel do Mercado Pago, pra garantir que a
// notificacao realmente veio do Mercado Pago e nao de terceiros. Ver "Boas praticas de
// credenciais" na doc oficial. Esse passo foi deixado como TODO porque depende de gerar
// o webhook secret na conta real da MOZZ.
export async function POST(request: NextRequest) {
  const corpo = await request.json();

  // TODO: validar assinatura (header x-signature) antes de confiar no payload
  // TODO: buscar o pagamento por id (GET /v1/payments/{id}) pra confirmar status "approved"
  // TODO: com o pagamento confirmado, montar os itens reais do pedido (hoje vem so o id)
  //       e chamar criarPedidoVendaBling(...) pra lancar a venda no Bling automaticamente.

  console.log("Webhook Mercado Pago recebido:", corpo);

  return NextResponse.json({ recebido: true });
}

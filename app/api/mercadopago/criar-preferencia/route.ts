import { NextRequest, NextResponse } from "next/server";
import { criarPreferenciaPagamento, type ItemCarrinho } from "@/lib/mercadopago";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { itens: ItemCarrinho[] };

    if (!body.itens || body.itens.length === 0) {
      return NextResponse.json({ erro: "Carrinho vazio" }, { status: 400 });
    }

    const numeroPedido = `MOZZ-${Date.now()}`;
    const preferencia = await criarPreferenciaPagamento(body.itens, numeroPedido);

    return NextResponse.json({
      initPoint: preferencia.init_point,
      numeroPedido
    });
  } catch (erro) {
    console.error("Erro ao criar preferencia Mercado Pago:", erro);
    return NextResponse.json({ erro: "Nao foi possivel iniciar o pagamento" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { consultarStatusPagamento } from "@/lib/mercadopago";

export const dynamic = "force-dynamic";

// A tela do Pix pergunta aqui, a cada poucos segundos, se o pagamento ja' caiu (16/10/2026).
// Devolve so' o status - e so' se o numero do pedido bater com o pagamento.
export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id") ?? "";
  const pedido = request.nextUrl.searchParams.get("pedido") ?? "";
  if (!/^\d{5,20}$/.test(id) || !/^MOZZ-\d{10,16}$/.test(pedido)) {
    return NextResponse.json({ erro: "Consulta inválida" }, { status: 400 });
  }
  try {
    const status = await consultarStatusPagamento(id, pedido);
    if (!status) return NextResponse.json({ erro: "Pagamento não encontrado" }, { status: 404 });
    return NextResponse.json({ status });
  } catch (erro) {
    console.error("Erro ao consultar pagamento:", erro);
    return NextResponse.json({ erro: "Erro ao consultar" }, { status: 502 });
  }
}

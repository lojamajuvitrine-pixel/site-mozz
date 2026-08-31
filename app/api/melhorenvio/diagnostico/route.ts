import { NextRequest, NextResponse } from "next/server";
import { calcularFrete } from "@/lib/frete";

// ROTA TEMPORARIA DE DIAGNOSTICO - so' consulta cotacao (nao gasta nada, nao compra nada),
// pra descobrir qual transportadora esta' dando o erro "nao aceita envios nao-comerciais
// partindo deste estado" nos pedidos dentro do Parana (Reserva -> Ponta Grossa). Pedido do
// Brunno em 31/08/2026. APAGAR ESTE ARQUIVO depois de usar.
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const chave = request.nextUrl.searchParams.get("chave");
  if (chave !== "mozz-diagnostico-frete") {
    return NextResponse.json({ erro: "chave ausente ou incorreta" }, { status: 401 });
  }

  try {
    // Mesmo CEP de destino dos dois pedidos que falharam (Ponta Grossa, PR).
    const opcoes = await calcularFrete("84040010", 1);
    return NextResponse.json({ ok: true, opcoes });
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : String(erro);
    return NextResponse.json({ ok: false, erro: mensagem }, { status: 500 });
  }
}

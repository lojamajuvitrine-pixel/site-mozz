import { NextRequest, NextResponse } from "next/server";
import { buscarProdutoDetalheBling } from "@/lib/bling";

// Rota temporaria de diagnostico: busca o detalhe completo de UM produto pra confirmar
// em quais campos o Bling guarda a marca (o endpoint de lista /produtos nao traz esse
// campo). Passar ?id=<id do produto> na URL. Remover depois que o mapeamento de
// scripts/sync-bling.ts estiver fechado.
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ erro: "passa ?id=<id do produto> na URL" }, { status: 400 });
  }
  try {
    const detalhe = await buscarProdutoDetalheBling(Number(id));
    return NextResponse.json(detalhe);
  } catch (erro) {
    return NextResponse.json({ erro: String(erro) }, { status: 500 });
  }
}

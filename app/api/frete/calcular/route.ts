import { NextRequest, NextResponse } from "next/server";
import { calcularFrete } from "@/lib/frete";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { cep: string; quantidadeItens?: number };
    const opcoes = await calcularFrete(body.cep, body.quantidadeItens ?? 1);
    return NextResponse.json({ opcoes });
  } catch (erro) {
    console.error("Erro ao calcular frete:", erro);
    return NextResponse.json(
      { erro: erro instanceof Error ? erro.message : "Não foi possível calcular o frete" },
      { status: 400 }
    );
  }
}

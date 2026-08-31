import { NextRequest, NextResponse } from "next/server";
import { listarSituacoesModuloBling } from "@/lib/bling";

export const dynamic = "force-dynamic";

// Rota TEMPORARIA (apagar depois de usar, igual as de diagnostico do Melhor Envio em 31/08/2026)
// - so' serve pra descobrir, na conta REAL de Bling da MOZZ, o id numerico do modulo "Pedido de
// Venda" e o id da situacao "Em andamento" dentro dele (esses ids sao especificos da conta, nao
// da' pra advinhar - ver comentario em listarSituacoesModuloBling em lib/bling.ts). So' faz GET
// (leitura), nao muda nada no Bling. Protegida por chave pra nao ficar aberta pra qualquer um.
export async function GET(request: NextRequest) {
  const chave = request.nextUrl.searchParams.get("chave");
  if (chave !== "mozz-diagnostico-situacoes") {
    return NextResponse.json({ erro: "nao autorizado" }, { status: 401 });
  }

  const resultados: Record<string, unknown> = {};
  for (let idModulo = 1; idModulo <= 20; idModulo++) {
    try {
      const resposta = await listarSituacoesModuloBling(idModulo);
      if (resposta.data && resposta.data.length > 0) {
        resultados[idModulo] = resposta.data;
      }
    } catch {
      // modulo nao existe ou sem permissao - ignora e tenta o proximo
    }
  }

  return NextResponse.json({ ok: true, modulos: resultados });
}

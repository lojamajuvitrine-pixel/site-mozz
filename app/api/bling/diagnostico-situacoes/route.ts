import { NextRequest, NextResponse } from "next/server";
import { listarPedidosVendaBling } from "@/lib/bling";

export const dynamic = "force-dynamic";

// Rota TEMPORARIA (apagar depois de usar, igual as de diagnostico do Melhor Envio em 31/08/2026)
// - so' serve pra descobrir, na conta REAL de Bling da MOZZ, o id numerico da situacao "Em
// andamento" pra pedido de venda. So' faz GET (leitura), nao muda nada no Bling.
//
// v3 (31/08/2026): as v1/v2 tentavam GET /situacoes/modulos/1..30 pra listar as situacoes
// direto - a maioria voltou "429 limite de requisicoes atingido" (o Bling so' libera 3
// chamadas por segundo, e o loop tentava rapido demais em sequencia) e o resto voltou "404 nao
// encontrado" de verdade, sugerindo que o id do modulo "Pedido de Venda" nem esta' nessa faixa
// pequena de numeros. Trocado pelo caminho mais confiavel: o Brunno muda manualmente UM pedido
// de teste pra "Em andamento" direto na tela do Bling, e essa rota so' LISTA os pedidos de
// venda recentes (uma chamada so', sem risco de limite) - a gente le' o id da situacao direto
// desse pedido, sem precisar acertar nenhum numero de modulo.
export async function GET(request: NextRequest) {
  const chave = request.nextUrl.searchParams.get("chave");
  if (chave !== "mozz-diagnostico-situacoes") {
    return NextResponse.json({ erro: "nao autorizado" }, { status: 401 });
  }

  try {
    const resposta = await listarPedidosVendaBling(1);
    return NextResponse.json({ ok: true, pedidos: resposta.data });
  } catch (erro) {
    return NextResponse.json(
      { ok: false, erro: erro instanceof Error ? erro.message : String(erro) },
      { status: 500 }
    );
  }
}

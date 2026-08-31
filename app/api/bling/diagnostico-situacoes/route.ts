import { NextRequest, NextResponse } from "next/server";
import { listarSituacoesModuloBling, listarPedidosVendaBling } from "@/lib/bling";

export const dynamic = "force-dynamic";

// Rota TEMPORARIA (apagar depois de usar, igual as de diagnostico do Melhor Envio em 31/08/2026)
// - so' serve pra descobrir, na conta REAL de Bling da MOZZ, o id numerico da situacao "Em
// andamento" pra pedido de venda (esse id e' especifico da conta, nao da' pra advinhar - ver
// comentario em listarSituacoesModuloBling em lib/bling.ts). So' faz GET (leitura), nao muda
// nada no Bling. Protegida por chave pra nao ficar aberta pra qualquer um.
//
// v2 (31/08/2026): a v1 so' tentava /situacoes/modulos/1..20 e voltou tudo vazio - ou o id do
// modulo "Pedido de Venda" nao esta' nessa faixa, ou o app nao tem permissao pra esse endpoint.
// Agora tambem lista os pedidos de venda recentes com a situacao de cada um - se o Brunno mudar
// manualmente UM pedido de teste pra "Em andamento" na tela do Bling antes de chamar essa rota,
// da' pra ler o id certo direto do pedido, sem precisar acertar o id do modulo.
export async function GET(request: NextRequest) {
  const chave = request.nextUrl.searchParams.get("chave");
  if (chave !== "mozz-diagnostico-situacoes") {
    return NextResponse.json({ erro: "nao autorizado" }, { status: 401 });
  }

  const modulos: Record<string, { ok: boolean; dados?: unknown; erro?: string }> = {};
  for (let idModulo = 1; idModulo <= 30; idModulo++) {
    try {
      const resposta = await listarSituacoesModuloBling(idModulo);
      modulos[idModulo] = { ok: true, dados: resposta.data };
    } catch (erro) {
      modulos[idModulo] = { ok: false, erro: erro instanceof Error ? erro.message : String(erro) };
    }
  }

  let pedidos: unknown = null;
  let erroPedidos: string | null = null;
  try {
    const resposta = await listarPedidosVendaBling(1);
    pedidos = resposta.data;
  } catch (erro) {
    erroPedidos = erro instanceof Error ? erro.message : String(erro);
  }

  return NextResponse.json({ ok: true, modulos, pedidos, erroPedidos });
}

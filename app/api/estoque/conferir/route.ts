import { NextRequest, NextResponse } from "next/server";
import {
  buscarProduto,
  coresDoProduto,
  estoqueDaVariante,
  idVarianteProduto,
  tamanhosDisponiveisDoColor
} from "@/lib/produtos";

// Conferencia do carrinho (07/11/2026): quando a cliente abre o carrinho, o site pergunta quantas
// unidades tem AGORA de cada peca que esta' la' (estoque ao vivo, ver lib/estoqueAoVivo.ts) - assim
// uma peca que vendeu na loja fisica depois que ela colocou no carrinho sai antes do pagamento,
// com aviso, em vez de travar so' na hora de pagar.
//
// Resposta: { disponivel: { [idVariante]: numero | null } } - 0 = esgotou, null = sem informacao
// de quantidade (o carrinho nao limita).
export const dynamic = "force-dynamic";

type ItemConferencia = { produtoId?: unknown; cor?: unknown; tamanho?: unknown };

export async function POST(request: NextRequest) {
  try {
    const corpo = (await request.json()) as { itens?: ItemConferencia[] };
    const itens = Array.isArray(corpo.itens) ? corpo.itens.slice(0, 50) : [];
    const disponivel: Record<string, number | null> = {};

    let primeiro = true;
    for (const item of itens) {
      if (typeof item.produtoId !== "string" || typeof item.cor !== "string" || typeof item.tamanho !== "string") {
        continue;
      }
      const chave = idVarianteProduto(item.produtoId, item.cor, item.tamanho);
      // so' o primeiro busca o saldo de agora no banco - os outros reaproveitam o mesmo retrato
      const produto = await buscarProduto(item.produtoId, { estoqueFresco: primeiro });
      primeiro = false;
      if (!produto) {
        disponivel[chave] = 0;
        continue;
      }
      const cor = coresDoProduto(produto).find((c) => c.cor === item.cor);
      if (!cor || !tamanhosDisponiveisDoColor(cor).includes(item.tamanho)) {
        disponivel[chave] = 0;
        continue;
      }
      disponivel[chave] = estoqueDaVariante(produto, item.cor, item.tamanho);
    }

    return NextResponse.json({ disponivel });
  } catch {
    return NextResponse.json({ disponivel: {} });
  }
}

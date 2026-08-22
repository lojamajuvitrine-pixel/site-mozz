import { NextResponse } from "next/server";
import { listarProdutosBling } from "@/lib/bling";

// Rota manual de sincronizacao: puxa o catalogo do Bling. Hoje so retorna os dados crus
// pra inspecao - o passo de gravar em data/produtos.json fica em scripts/sync-bling.ts,
// rodado localmente (npm run sync:bling) ou por um cron job depois que a conta Bling
// estiver conectada de verdade.
//
// force-dynamic: essa rota depende de credenciais do Bling (env vars) e nao deve ser
// pre-renderizada em build time - sem isso o "next build" tenta avaliar a rota de
// antemao e loga um erro (inofensivo, mas desnecessario) por faltar credenciais no build.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const produtos = await listarProdutosBling();
    return NextResponse.json(produtos);
  } catch (erro) {
    console.error("Erro ao sincronizar com o Bling:", erro);
    return NextResponse.json({ erro: String(erro) }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ehAdmin } from "@/lib/admin";
import { clienteServicoBlackFriday } from "@/lib/blackFriday";

// Salva (ou tira) o preco da Black Friday de uma peca - painel /admin/black-friday.
// preco null = tira a peca da Black.
export async function POST(request: NextRequest) {
  const supabaseUsuario = createClient();
  const {
    data: { user }
  } = await supabaseUsuario.auth.getUser();
  if (!ehAdmin(user?.email)) return NextResponse.json({ erro: "Não autorizado" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { produtoId?: string; preco?: number | null };
  if (!body.produtoId) return NextResponse.json({ erro: "produtoId obrigatório" }, { status: 400 });

  const supabase = clienteServicoBlackFriday();
  if (!supabase) return NextResponse.json({ erro: "Supabase não configurado" }, { status: 500 });

  if (body.preco === null || body.preco === undefined) {
    const { error } = await supabase.from("black_friday_produtos").delete().eq("produto_id", body.produtoId);
    if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, removido: true });
  }

  const preco = Math.round(Number(body.preco) * 100) / 100;
  if (!Number.isFinite(preco) || preco <= 0) {
    return NextResponse.json({ erro: "Preço precisa ser maior que zero" }, { status: 400 });
  }

  const { error } = await supabase
    .from("black_friday_produtos")
    .upsert({ produto_id: body.produtoId, preco, atualizado_em: new Date().toISOString() });
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

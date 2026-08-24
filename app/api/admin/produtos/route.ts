import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ehAdmin } from "@/lib/admin";

// So' o e-mail admin (ver lib/admin.ts) pode ler/escrever aqui - confere a sessao (cookie,
// via lib/supabase/server) de quem esta chamando. Essa checagem e' so' a primeira camada: a
// policy de RLS da tabela produtos_site no Supabase e' quem garante de verdade, mesmo que
// alguem tente chamar essa rota direto sem passar pelo middleware/pagina.
async function clienteSeAdmin() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!ehAdmin(user?.email)) return null;
  return supabase;
}

type PayloadProduto = {
  produtoId?: string;
  precoEspecial?: number | null;
  destaque?: boolean;
  outlet?: boolean;
};

// Cadastra/atualiza a config especial de um produto (preco especial, destaque, outlet).
// Sempre manda o registro INTEIRO (nao so' o campo que mudou) - o painel ja carrega o estado
// atual completo de cada linha, entao um upsert simples resolve sem precisar de merge parcial.
// Se os 3 campos voltarem ao padrao (sem preco, destaque=false, outlet=false), apaga a linha
// em vez de guardar um registro vazio - mantem a tabela so' com produtos que tem algo de fato
// configurado.
export async function POST(request: NextRequest) {
  const supabase = await clienteSeAdmin();
  if (!supabase) return NextResponse.json({ erro: "Não autorizado" }, { status: 401 });

  const body = (await request.json()) as PayloadProduto;
  if (!body.produtoId) {
    return NextResponse.json({ erro: "produtoId obrigatório" }, { status: 400 });
  }
  if (body.precoEspecial !== null && body.precoEspecial !== undefined && body.precoEspecial <= 0) {
    return NextResponse.json({ erro: "Preço especial precisa ser maior que zero" }, { status: 400 });
  }

  const precoEspecial = body.precoEspecial ?? null;
  const destaque = !!body.destaque;
  const outlet = !!body.outlet;

  if (precoEspecial === null && !destaque && !outlet) {
    const { error } = await supabase.from("produtos_site").delete().eq("produto_id", body.produtoId);
    if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, removido: true });
  }

  const { error } = await supabase.from("produtos_site").upsert({
    produto_id: body.produtoId,
    preco_especial: precoEspecial,
    destaque,
    outlet,
    atualizado_em: new Date().toISOString()
  });

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

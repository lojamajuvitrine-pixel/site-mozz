import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ehAdmin } from "@/lib/admin";

async function clienteSeAdmin() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!ehAdmin(user?.email)) return null;
  return supabase;
}

type TabelaMedidasPayload = { colunas: string[]; linhas: string[][] };

type PayloadProduto = {
  produtoId?: string;
  precoEspecial?: number | null;
  destaque?: boolean;
  outlet?: boolean;
  ativo?: boolean;
  medidasCustomizadas?: TabelaMedidasPayload | null;
  composicaoCustomizada?: string | null;
};

function medidasValidas(valor: unknown): valor is TabelaMedidasPayload {
  if (!valor || typeof valor !== "object") return false;
  const v = valor as { colunas?: unknown; linhas?: unknown };
  const colunas = v.colunas;
  const linhas = v.linhas;
  if (!Array.isArray(colunas) || colunas.length === 0 || !colunas.every((c) => typeof c === "string")) {
    return false;
  }
  if (!Array.isArray(linhas) || linhas.length === 0) return false;
  const totalColunas = colunas.length;
  return linhas.every(
    (linha) => Array.isArray(linha) && linha.length === totalColunas && linha.every((x) => typeof x === "string")
  );
}

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
  if (body.medidasCustomizadas != null && !medidasValidas(body.medidasCustomizadas)) {
    return NextResponse.json({ erro: "Tabela de medidas em formato inválido" }, { status: 400 });
  }

  const precoEspecial = body.precoEspecial ?? null;
  const destaque = !!body.destaque;
  const outlet = !!body.outlet;
  // ausente = ativa (comportamento padrao) - so' considera "desativada" quando o painel manda
  // explicitamente false.
  const ativo = body.ativo !== false;
  const medidasCustomizadas = body.medidasCustomizadas ?? null;
  const composicaoCustomizada = body.composicaoCustomizada?.trim() || null;

  // So' apaga a linha (volta tudo pro padrao do Bling) quando NENHUM campo tem valor
  // diferente do padrao - "ativo" tambem entra nessa conta, senao uma peca desativada com
  // mais nada customizado seria removida da tabela e voltaria a aparecer no catalogo.
  if (precoEspecial === null && !destaque && !outlet && ativo && !medidasCustomizadas && !composicaoCustomizada) {
    const { error } = await supabase.from("produtos_site").delete().eq("produto_id", body.produtoId);
    if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, removido: true });
  }

  const { error } = await supabase.from("produtos_site").upsert({
    produto_id: body.produtoId,
    preco_especial: precoEspecial,
    destaque,
    outlet,
    ativo,
    medidas_customizadas: medidasCustomizadas,
    composicao_customizada: composicaoCustomizada,
    atualizado_em: new Date().toISOString()
  });

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

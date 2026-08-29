import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ehAdmin } from "@/lib/admin";

async function clienteSeAdmin() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user || !ehAdmin(user.email)) {
    return null;
  }
  return supabase;
}

type PayloadConfiguracaoLoja = {
  freteGratisAcimaDe?: number | null;
  retiradaHabilitada?: boolean;
  retiradaInstrucoes?: string | null;
};

export async function POST(request: NextRequest) {
  const supabase = await clienteSeAdmin();
  if (!supabase) {
    return NextResponse.json({ erro: "Não autorizado" }, { status: 401 });
  }

  const body = (await request.json()) as PayloadConfiguracaoLoja;

  if (
    body.freteGratisAcimaDe !== null &&
    body.freteGratisAcimaDe !== undefined &&
    (!Number.isFinite(body.freteGratisAcimaDe) || body.freteGratisAcimaDe <= 0)
  ) {
    return NextResponse.json(
      { erro: "Valor mínimo pro frete grátis precisa ser maior que zero" },
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from("configuracoes_loja")
    .update({
      frete_gratis_acima_de: body.freteGratisAcimaDe ?? null,
      retirada_habilitada: !!body.retiradaHabilitada,
      retirada_instrucoes: body.retiradaInstrucoes?.trim() || null,
      atualizado_em: new Date().toISOString()
    })
    .eq("id", 1);

  if (error) {
    return NextResponse.json({ erro: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

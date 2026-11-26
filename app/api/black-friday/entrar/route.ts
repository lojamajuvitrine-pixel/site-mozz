import { NextRequest, NextResponse } from "next/server";
import { clienteServicoBlackFriday } from "@/lib/blackFriday";
import { gravarCookieVip, janelaAcessoAntecipadoAberta } from "@/lib/blackFridayCookieVip";

// 26/11/2026 (Brunno): link geral da Black (sem codigo). A partir das 21h a cliente digita o
// e-mail; se ele estiver na lista de cadastros, libera o acesso antecipado (cookie VIP).
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as { email?: string };
  const email = (body.email ?? "").trim().toLowerCase().slice(0, 160);

  if (!janelaAcessoAntecipadoAberta()) {
    return NextResponse.json({ erro: "O acesso antecipado abre hoje às 21h." }, { status: 403 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ erro: "Digite um e-mail válido." }, { status: 400 });
  }

  const supabase = clienteServicoBlackFriday();
  if (!supabase) return NextResponse.json({ erro: "Acesso indisponível no momento. Tente de novo." }, { status: 500 });

  const { data, error } = await supabase
    .from("black_friday_cadastros")
    .select("id")
    .eq("email", email)
    .limit(1);
  if (error) {
    console.error("Black Friday: erro ao conferir e-mail:", error.message);
    return NextResponse.json({ erro: "Não foi possível conferir agora. Tente de novo." }, { status: 500 });
  }
  if (!data || data.length === 0) {
    return NextResponse.json(
      { erro: "Não encontramos esse e-mail na lista. Faça seu cadastro abaixo e entre na hora.", naoEncontrado: true },
      { status: 404 }
    );
  }
  return gravarCookieVip(NextResponse.json({ ok: true }));
}

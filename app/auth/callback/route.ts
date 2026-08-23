import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Pra onde o link magico do e-mail leva o cliente de volta. O Supabase manda um "code" na
// URL - aqui a gente troca esse code por uma sessao de verdade (fica guardada em cookie
// httpOnly, o middleware.ts cuida de renovar sozinho depois disso). "next" e' pra onde manda
// o cliente depois de logar (hoje sempre /conta, ver app/conta/entrar/page.tsx).
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/conta";

  if (code) {
    const supabase = createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/conta/entrar?erro=link-invalido`);
}

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_CONFIGURADO } from "@/lib/supabase/config";

// Roda em TODA requisicao que bate no site (ver "matcher" no final do arquivo). Duas coisas:
// 1) renova o cookie de sessao do Supabase automaticamente (sem isso o login expira sozinho
//    mesmo com o cliente ainda "logado" na cabeca dele - o access_token tem vida curta e
//    precisa ser trocado por um novo usando o refresh_token, isso tem que acontecer em toda
//    requisicao de servidor pra sessao nao cair no meio da visita).
// 2) protege as paginas dentro de /conta (exceto /conta/entrar): sem sessao valida, manda
//    pra tela de login antes de renderizar a pagina protegida.
export async function middleware(request: NextRequest) {
  let resposta = NextResponse.next({ request });

  // Sem credenciais reais configuradas ainda (ver PROXIMOS_PASSOS.md) - deixa passar direto,
  // a propria pagina /conta/entrar mostra o aviso de "em configuracao" (ver SUPABASE_CONFIGURADO
  // em app/conta/entrar/page.tsx). Evita quebrar o middleware (e o site inteiro) antes da
  // conta Supabase existir.
  if (!SUPABASE_CONFIGURADO) {
    return resposta;
  }

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesParaSetar) {
        cookiesParaSetar.forEach(({ name, value }) => request.cookies.set(name, value));
        resposta = NextResponse.next({ request });
        cookiesParaSetar.forEach(({ name, value, options }) => resposta.cookies.set(name, value, options));
      }
    }
  });

  const {
    data: { user }
  } = await supabase.auth.getUser();

  const rotaProtegida = request.nextUrl.pathname.startsWith("/conta") && request.nextUrl.pathname !== "/conta/entrar";

  if (!user && rotaProtegida) {
    const url = request.nextUrl.clone();
    url.pathname = "/conta/entrar";
    return NextResponse.redirect(url);
  }

  return resposta;
}

export const config = {
  matcher: [
    // roda em tudo, exceto arquivos estaticos/imagens (senao fica renovando sessao a toa em
    // cada foto de produto carregada, por exemplo)
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|produtos/).*)"
  ]
};

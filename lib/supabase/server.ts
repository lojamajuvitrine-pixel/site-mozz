// Cliente do Supabase pra usar em SERVER COMPONENTS e Route Handlers - le a sessao dos
// cookies da requisicao (via next/headers) em vez de localStorage, que so' existe no
// navegador. E' esse cliente que a pagina /conta usa pra descobrir, no servidor, se tem
// alguem logado antes de renderizar (evita "piscar" conteudo de convidado antes de logar).
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config";

export function createClient() {
  const cookieStore = cookies();

  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesParaSetar) {
        try {
          cookiesParaSetar.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // chamado de dentro de um Server Component (nao um Route Handler/Server Action) -
          // nao pode escrever cookie dali. Sem problema: o middleware.ts ja cuida de manter
          // a sessao renovada em toda requisicao, entao essa escrita aqui e' so' um extra.
        }
      }
    }
  });
}

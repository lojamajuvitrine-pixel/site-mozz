// Cliente Supabase "solto" (sem sessao/cookies) pra leituras publicas que qualquer visitante
// pode fazer - hoje usado so' pra ler os precos especiais do site (a tabela precos_especiais
// libera SELECT pra todo mundo via RLS, so' escrita fica restrita ao e-mail admin). Diferente
// de lib/supabase/server.ts, que fica ligado aos cookies de quem esta logado - nao usar esse
// cliente aqui pra nada que dependa de sessao (perfil, pedidos, escrita administrativa).
//
// Importante pra performance: por ser um cliente sem cookies, pode ser chamado em QUALQUER
// contexto de servidor (Server Component, generateMetadata, sitemap.ts) sem forcar a rota
// inteira a virar dinamica - o que o lib/supabase/server.ts (baseado em cookies()) forcaria.
import { createClient as criarClienteSupabase } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase/config";

export function clientePublico() {
  return criarClienteSupabase(SUPABASE_URL, SUPABASE_ANON_KEY);
}

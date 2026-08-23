"use client";

// Cliente do Supabase pra usar em COMPONENTES DE CLIENTE ("use client") - por exemplo a
// tela de login, que chama signInWithOtp direto do navegador. Le/escreve a sessao em
// cookies automaticamente (via @supabase/ssr), o que e' o que permite o servidor (middleware,
// Server Components) tambem enxergar se o cliente esta logado.
import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config";

export function createClient() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

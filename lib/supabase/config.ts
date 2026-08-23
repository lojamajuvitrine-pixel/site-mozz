// Fonte unica dos valores de conexao do Supabase (usado tanto no cliente do navegador quanto
// no servidor) - com fallback pra nao QUEBRAR O BUILD antes da conta Supabase existir (mesmo
// principio de lib/site.ts pro NEXT_PUBLIC_SITE_URL: melhor o build passar e o login falhar
// com um erro claro em runtime do que a Vercel inteira ficar fora do ar por causa disso).
//
// Ver PROXIMOS_PASSOS.md pra como criar o projeto Supabase e pegar esses dois valores.
const URL_PLACEHOLDER = "https://placeholder.supabase.co";
const CHAVE_PLACEHOLDER = "placeholder-anon-key";

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || URL_PLACEHOLDER;
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || CHAVE_PLACEHOLDER;

// true quando as credenciais reais ja foram configuradas - usado pra mostrar uma mensagem
// amigavel em vez de deixar o cliente tentar logar contra um projeto que nao existe.
export const SUPABASE_CONFIGURADO = SUPABASE_URL !== URL_PLACEHOLDER && SUPABASE_ANON_KEY !== CHAVE_PLACEHOLDER;

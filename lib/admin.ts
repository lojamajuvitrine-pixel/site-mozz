// Lista de e-mails com acesso ao painel administrativo (/admin) - hoje so' o Brunno. Pra
// adicionar mais gente, e' so' incluir o e-mail aqui - usa o MESMO login por link magico que
// o cliente ja usa em /conta/entrar, nao precisa de senha nem cadastro separado.
//
// IMPORTANTE: essa lista so' controla o que a INTERFACE mostra (middleware.ts, paginas e API
// routes em /admin e /api/admin). A seguranca de verdade contra escrita nao autorizada e' a
// policy de RLS da tabela produtos_site no Supabase, que tambem precisa ser atualizada se
// algum e-mail for adicionado/removido daqui (ver o SQL em PROXIMOS_PASSOS.md).
const EMAILS_ADMIN = ["brbo15@hotmail.com"];

export function ehAdmin(email: string | null | undefined): boolean {
  return !!email && EMAILS_ADMIN.includes(email.toLowerCase());
}

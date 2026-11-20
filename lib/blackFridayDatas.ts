// Datas da Black Friday Mozz 2026, num arquivo separado e sem dependencias, pra poderem ser usadas
// tambem em componentes do navegador (menu, faixa da home) sem levar o Supabase junto.
export const BLACK_FRIDAY_ACESSO_ANTECIPADO = "2026-11-27T21:00:00-03:00";
export const BLACK_FRIDAY_ABERTURA = "2026-11-28T00:00:00-03:00";
export const BLACK_FRIDAY_FIM = "2026-11-30T23:59:59-03:00";

// Enquanto for true, o menu mostra "Black Friday" (em vez de "Outlet") e a home mostra a faixa.
export function campanhaBlackFridayNoAr(agora: Date = new Date()): boolean {
  return agora.getTime() <= Date.parse(BLACK_FRIDAY_FIM);
}

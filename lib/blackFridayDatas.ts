// Datas da Black Friday Mozz 2026, num arquivo separado e sem dependencias, pra poderem ser usadas
// tambem em componentes do navegador (menu, faixa da home) sem levar o Supabase junto.
export const BLACK_FRIDAY_ACESSO_ANTECIPADO = "2026-11-26T21:00:00-03:00";
export const BLACK_FRIDAY_ABERTURA = "2026-11-27T00:00:00-03:00";
export const BLACK_FRIDAY_FIM = "2026-11-30T23:59:59-03:00";

// Codigo do link de acesso antecipado e o cookie que marca quem abriu o link (20/11/2026: so'
// quem tem o link ve os precos da Black entre 26/11 21h e 27/11 00h; o middleware grava o cookie).
export const CODIGO_ACESSO_ANTECIPADO = "vip-mozz-2611";
export const COOKIE_ACESSO_VIP = "mozz_bf_vip";

// Precos da Black valem pra: todo mundo de 27/11 00h a 30/11 23h59; e, de 26/11 21h ate'
// 23h59, so' pra quem abriu o link de acesso antecipado (cookie).
export function precosBlackFridayLiberados(acessoVip: boolean, agora: Date = new Date()): boolean {
  const t = agora.getTime();
  if (t > Date.parse(BLACK_FRIDAY_FIM)) return false;
  if (t >= Date.parse(BLACK_FRIDAY_ABERTURA)) return true;
  return acessoVip && t >= Date.parse(BLACK_FRIDAY_ACESSO_ANTECIPADO);
}

// Enquanto for true, o menu mostra "Black Friday" (em vez de "Outlet") e a home mostra a faixa.
export function campanhaBlackFridayNoAr(agora: Date = new Date()): boolean {
  return agora.getTime() <= Date.parse(BLACK_FRIDAY_FIM);
}

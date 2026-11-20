import { campanhaBlackFridayNoAr } from "./blackFridayDatas";

// Campanha Black November 2026 (pedido do Brunno em 05/11/2026): durante novembro a vitrine de
// outlet vira "Black November" - menu, pagina propria (/black-november) e banner na home. As
// pecas sao as mesmas marcadas como "outlet" no painel /admin/produtos, com o preco especial de
// cada uma. Depois da data abaixo tudo volta sozinho a se chamar "Outlet" (menu, /outlet e o
// banner some), sem precisar subir codigo de novo.
// 20/11/2026: Brunno encerrou a Black November antes da hora pra trabalhar so' com a Black
// Friday. A data abaixo ficou no passado, entao banner, pagina e nome no menu ja' voltaram ao
// "Outlet". As pecas de outlet seguem com o preco especial.
export const BLACK_NOVEMBER_FIM = "2026-11-20T12:40:00-03:00";

// A regra de frete das pecas promocionais (gratis so' acima de R$ 2.000) continua ate' 30/11,
// mesmo com a Black November encerrada - as pecas continuam com desconto fundo.
export const REGRA_FRETE_PROMOCIONAL_FIM = "2026-11-30T23:59:59-03:00";

export function regraFretePromocionalAtiva(agora: Date = new Date()): boolean {
  return agora.getTime() <= Date.parse(REGRA_FRETE_PROMOCIONAL_FIM);
}

export function blackNovemberAtiva(agora: Date = new Date()): boolean {
  return agora.getTime() <= Date.parse(BLACK_NOVEMBER_FIM);
}

// Nome da vitrine pra usar em texto corrido ("pecas da Black November" / "pecas do outlet").
export function nomeVitrinePromocional(): string {
  return blackNovemberAtiva() ? "da Black November" : "do outlet";
}

export function rotuloMenuVitrine(): string {
  if (campanhaBlackFridayNoAr()) return "Black Friday";
  return blackNovemberAtiva() ? "Black November" : "Outlet";
}

// Ate' 30/11 o item do menu vira "Black Friday" e leva pra /black-friday (contagem + cadastro
// antes da abertura, vitrine depois). Depois volta sozinho a ser "Outlet".
export function caminhoVitrinePromocional(): string {
  if (campanhaBlackFridayNoAr()) return "/black-friday";
  return blackNovemberAtiva() ? "/black-november" : "/outlet";
}

export function menuEhBlackFriday(): boolean {
  return campanhaBlackFridayNoAr();
}

// Frete gratis na Black November (decisao do Brunno em 05/11/2026): carrinho com pelo menos uma
// peca da Black November so' ganha frete gratis acima de R$ 2.000 - as pecas ja' estao com
// desconto fundo e o frete comia a margem. Carrinho so' com pecas normais segue o valor do
// painel (/admin/produtos). Usado no servidor (lib/mercadopago.ts), no carrinho e na pagina do
// produto, pra todos mostrarem e cobrarem a mesma regra.
export const FRETE_GRATIS_BLACK_NOVEMBER = 2000;

export function limiarFreteGratis(limiarBase: number | null, temPecaPromocional: boolean): number | null {
  if (limiarBase === null) return null;
  return temPecaPromocional && regraFretePromocionalAtiva() ? Math.max(limiarBase, FRETE_GRATIS_BLACK_NOVEMBER) : limiarBase;
}

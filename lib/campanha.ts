// Campanha Black November 2026 (pedido do Brunno em 05/11/2026): durante novembro a vitrine de
// outlet vira "Black November" - menu, pagina propria (/black-november) e banner na home. As
// pecas sao as mesmas marcadas como "outlet" no painel /admin/produtos, com o preco especial de
// cada uma. Depois da data abaixo tudo volta sozinho a se chamar "Outlet" (menu, /outlet e o
// banner some), sem precisar subir codigo de novo.
export const BLACK_NOVEMBER_FIM = "2026-11-30T23:59:59-03:00";

export function blackNovemberAtiva(agora: Date = new Date()): boolean {
  return agora.getTime() <= Date.parse(BLACK_NOVEMBER_FIM);
}

// Nome da vitrine pra usar em texto corrido ("pecas da Black November" / "pecas do outlet").
export function nomeVitrinePromocional(): string {
  return blackNovemberAtiva() ? "da Black November" : "do outlet";
}

export function rotuloMenuVitrine(): string {
  return blackNovemberAtiva() ? "Black November" : "Outlet";
}

export function caminhoVitrinePromocional(): string {
  return blackNovemberAtiva() ? "/black-november" : "/outlet";
}

// Frete gratis na Black November (decisao do Brunno em 05/11/2026): carrinho com pelo menos uma
// peca da Black November so' ganha frete gratis acima de R$ 2.000 - as pecas ja' estao com
// desconto fundo e o frete comia a margem. Carrinho so' com pecas normais segue o valor do
// painel (/admin/produtos). Usado no servidor (lib/mercadopago.ts), no carrinho e na pagina do
// produto, pra todos mostrarem e cobrarem a mesma regra.
export const FRETE_GRATIS_BLACK_NOVEMBER = 2000;

export function limiarFreteGratis(limiarBase: number | null, temPecaPromocional: boolean): number | null {
  if (limiarBase === null) return null;
  return temPecaPromocional && blackNovemberAtiva() ? Math.max(limiarBase, FRETE_GRATIS_BLACK_NOVEMBER) : limiarBase;
}

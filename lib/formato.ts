export function formatarPreco(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// Parcelamento sem juros pra mostrar no card/pagina do produto, no padrao das lojas de moda
// (ex: "ou 5x de R$ 199,80 sem juros"). MAX_PARCELAS_SEM_JUROS e' o teto de parcelas da MOZZ -
// se um dia isso mudar (ex: acordo diferente com a adquirente), so mexer aqui.
export const MAX_PARCELAS_SEM_JUROS = 10;
// abaixo desse valor a parcela nao compensa: o site reduz o numero de parcelas sozinho (19/10/2026,
// pedido do Brunno: ate 10x, parcela minima de R$ 60). Definir o mesmo minimo no painel do Mercado Pago.
const VALOR_MINIMO_PARCELA = 60;

// Desconto de 10% no Pix (decidido pelo Brunno em 19/10/2026): vale so' sobre as pecas (nao sobre
// o frete) e NAO soma com cupom - quando a cliente tem cupom, vale o maior dos dois. Ver
// prepararPedido em lib/mercadopago.ts (revalidado no servidor) e app/carrinho/page.tsx.
export const PERCENTUAL_DESCONTO_PIX = 10;

export function calcularDescontoPix(subtotal: number): number {
  return Math.round(subtotal * PERCENTUAL_DESCONTO_PIX) / 100;
}

export function calcularParcelamento(preco: number): { parcelas: number; valorParcela: number } | null {
  for (let parcelas = MAX_PARCELAS_SEM_JUROS; parcelas >= 2; parcelas--) {
    const valorParcela = preco / parcelas;
    if (valorParcela >= VALOR_MINIMO_PARCELA) {
      return { parcelas, valorParcela };
    }
  }
  return null;
}

export function formatarParcelamento(preco: number): string | null {
  const parcelamento = calcularParcelamento(preco);
  if (!parcelamento) return null;
  return `ou ${parcelamento.parcelas}x de ${formatarPreco(parcelamento.valorParcela)} sem juros`;
}

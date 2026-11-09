export function formatarPreco(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// Parcelamento sem juros pra mostrar no card/pagina do produto, no padrao das lojas de moda
// (ex: "ou 5x de R$ 199,80 sem juros"). MAX_PARCELAS_SEM_JUROS e' o teto de parcelas da MOZZ -
// se um dia isso mudar (ex: acordo diferente com a adquirente), so mexer aqui.
export const MAX_PARCELAS_SEM_JUROS = 10;
// Pecas em promocao (preco riscado ou outlet/Black November) vao so' ate 3x sem juros e NAO tem
// desconto no Pix (decidido pelo Brunno em 09/11/2026). Carrinho com pelo menos uma peca em
// promocao vai ate 3x no pedido inteiro. Nao ha opcao com juros: o numero de parcelas sem juros
// e' configuracao da conta do Mercado Pago (vale pra loja toda); o site so' limita o maximo.
export const MAX_PARCELAS_PROMOCAO = 3;

export function emPromocao(produto: { precoOriginal?: number | null; outlet?: boolean | null }): boolean {
  return !!produto.precoOriginal || !!produto.outlet;
}

export function maxParcelas(promocao: boolean): number {
  return promocao ? MAX_PARCELAS_PROMOCAO : MAX_PARCELAS_SEM_JUROS;
}
// abaixo desse valor a parcela nao compensa: o site reduz o numero de parcelas sozinho (19/10/2026,
// pedido do Brunno: ate 10x, parcela minima de R$ 60). Definir o mesmo minimo no painel do Mercado Pago.
const VALOR_MINIMO_PARCELA = 60;

// Desconto de 10% no Pix (decidido pelo Brunno em 19/10/2026): vale so' sobre as pecas SEM
// promocao (09/11/2026 - ver emPromocao acima), nao sobre o frete, e NAO soma com cupom - quando a cliente tem cupom, vale o maior dos dois. Ver
// prepararPedido em lib/mercadopago.ts (revalidado no servidor) e app/carrinho/page.tsx.
export const PERCENTUAL_DESCONTO_PIX = 10;

export function calcularDescontoPix(subtotal: number): number {
  return Math.round(subtotal * PERCENTUAL_DESCONTO_PIX) / 100;
}

export function calcularParcelamento(
  preco: number,
  maximo: number = MAX_PARCELAS_SEM_JUROS
): { parcelas: number; valorParcela: number } | null {
  for (let parcelas = maximo; parcelas >= 2; parcelas--) {
    const valorParcela = preco / parcelas;
    if (valorParcela >= VALOR_MINIMO_PARCELA) {
      return { parcelas, valorParcela };
    }
  }
  return null;
}

export function formatarParcelamento(preco: number, maximo: number = MAX_PARCELAS_SEM_JUROS): string | null {
  const parcelamento = calcularParcelamento(preco, maximo);
  if (!parcelamento) return null;
  return `ou ${parcelamento.parcelas}x de ${formatarPreco(parcelamento.valorParcela)} sem juros`;
}

// Cupons de desconto ativos na loja. Como o site ainda nao tem painel admin, esse arquivo
// E' o "painel" - pra criar, editar ou desativar um cupom, peca pro Claude mexer aqui (ou
// edite direto, se preferir) e publique. Formato de cada cupom:
// - codigo: como o cliente digita no carrinho (nao diferencia maiuscula/minuscula)
// - tipo: "percentual" (ex: valor 10 = 10% de desconto) ou "fixo" (valor em R$ de desconto)
// - valor: numero (percentual de 0 a 100, ou reais, conforme o tipo)
// - validoAte: data limite opcional no formato "AAAA-MM-DD" - depois dela o cupom para de
//   funcionar sozinho, sem precisar lembrar de desativar na mao
// - pedidoMinimo: valor minimo do carrinho (em R$) pra poder usar o cupom (opcional)
// - ativo: liga/desliga o cupom sem precisar apagar a linha
export type Cupom = {
  codigo: string;
  tipo: "percentual" | "fixo";
  valor: number;
  validoAte?: string;
  pedidoMinimo?: number;
  ativo: boolean;
};

export const CUPONS: Cupom[] = [
  // exemplo (desativado) - copie o formato abaixo pra criar um cupom de verdade:
  // { codigo: "BEMVINDA10", tipo: "percentual", valor: 10, ativo: true }
];

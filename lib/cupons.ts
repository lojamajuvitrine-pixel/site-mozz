// Cupons de desconto ativos na loja. Como o site ainda nao tem painel admin pra cupom, esse
// arquivo E' o "painel" - pra criar, editar ou desativar um cupom, peca pro Claude mexer aqui
// (ou edite direto, se preferir) e publique. Formato de cada cupom:
// - codigo: como o cliente digita no carrinho (nao diferencia maiuscula/minuscula)
// - tipo: "percentual" (ex: valor 10 = 10% de desconto) ou "fixo" (valor em R$ de desconto)
// - valor: numero (percentual de 0 a 100, ou reais, conforme o tipo)
// - validoAte: data limite opcional no formato "AAAA-MM-DD" - depois dela o cupom para de
//   funcionar sozinho, sem precisar lembrar de desativar na mao
// - pedidoMinimo: valor minimo do carrinho (em R$) pra poder usar o cupom (opcional)
// - usoUnicoPorCpf: true = cada CPF so' consegue usar ESSE cupom uma vez, mesmo em navegador
//   ou conta diferente - e' o que faz um cupom ser "de primeira compra" na pratica (pedido do
//   Brunno em 30/08/2026). Fica registrado na tabela cupons_usados do Supabase (ver
//   lib/cupom.ts) no momento em que o PAGAMENTO e' aprovado de verdade (nao so' quando o
//   cliente aplica o cupom no carrinho) - carrinho abandonado ou pagamento recusado nao
//   "gasta" o uso. Omitir ou false = cupom pode ser usado quantas vezes quiser, por qualquer
//   pessoa (cupom de promocao comum).
// - ativo: liga/desliga o cupom sem precisar apagar a linha
export type Cupom = {
  codigo: string;
  tipo: "percentual" | "fixo";
  valor: number;
  validoAte?: string;
  pedidoMinimo?: number;
  usoUnicoPorCpf?: boolean;
  ativo: boolean;
};

export const CUPONS: Cupom[] = [
  // Cupom de primeira compra - decidido pelo Brunno em 30/08/2026: 10% de desconto,
  // usoUnicoPorCpf faz cada CPF conseguir usar so' uma vez (na pratica, "valido so' na
  // primeira compra"). Sem pedidoMinimo nem validoAte por enquanto.
  { codigo: "PRIMEIRACOMPRA", tipo: "percentual", valor: 10, usoUnicoPorCpf: true, ativo: true }

  // exemplo de cupom de promocao comum (desativado) - qualquer pessoa pode usar, quantas
  // vezes quiser, enquanto estiver ativo:
  // { codigo: "VERAO10", tipo: "percentual", valor: 10, ativo: true }
];

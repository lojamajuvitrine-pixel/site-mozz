import { clientePublico } from "@/lib/supabase/publico";
import { SUPABASE_CONFIGURADO } from "@/lib/supabase/config";

// Sistema de cashback/credito de loja - pedido do Brunno em 30/08/2026, inspirado no cashback
// da Foxton (ver claude/analise-concorrentes-marcas.md, doc do projeto). Regra confirmada com
// o Brunno: quem tem um pagamento aprovado ganha de volta 15% do valor da compra (COM frete
// incluso, mesmo criterio da Foxton) em credito de loja, valido por 30 dias, utilizavel em ate'
// 30% do valor de uma compra futura (tambem incluindo frete). Rastreado por CPF (nao por
// login), porque o checkout permite compra como visitante (ver middleware.ts e
// app/carrinho/page.tsx) - mesmo principio ja usado pelo cupom PRIMEIRACOMPRA (ver lib/cupom.ts
// e lib/cupons.ts).
//
// Se um dia essas regras mudarem (percentual, validade ou teto de uso), so' mexer nas tres
// constantes abaixo.
//
// Seguranca no Supabase (migration criar_sistema_creditos_cashback): as tabelas
// creditos_clientes e creditos_consumos tem RLS habilitado e ZERO policies - ninguem le ou
// escreve direto nelas com a chave publica/anon usada aqui. Todo acesso passa por funcoes
// SECURITY DEFINER (saldo_credito_disponivel, conceder_credito, usar_credito), que devolvem
// so' o minimo necessario (nunca a linha crua) - mesmo padrao de cupom_ja_usado/registrar_uso_cupom.
export const PERCENTUAL_CASHBACK = 0.15; // 15% do valor da compra volta como credito
export const DIAS_VALIDADE_CREDITO = 30; // credito expira 30 dias apos ser concedido
export const PERCENTUAL_MAXIMO_USO = 0.3; // credito cobre no maximo 30% do valor de uma compra futura

// Saldo de credito disponivel pra um CPF (soma do que ainda nao expirou e nao foi totalmente
// usado). Se o Supabase estiver fora do ar ou nao configurado, devolve 0 - nao bloqueia a
// compra por causa disso (mesmo principio de cupomJaUsadoPeloCpf em lib/cupom.ts), so' significa
// que a cliente nao ve/nao consegue aplicar credito nesse momento, o resto do checkout segue normal.
export async function buscarSaldoCredito(cpfLimpo: string): Promise<number> {
  if (!SUPABASE_CONFIGURADO || !cpfLimpo) return 0;
  try {
    const supabase = clientePublico();
    const { data, error } = await supabase.rpc("saldo_credito_disponivel", { p_cpf: cpfLimpo });
    if (error) return 0;
    return Number(data) || 0;
  } catch {
    return 0;
  }
}

// Calcula quanto de credito pode efetivamente ser aplicado num pedido: nunca mais que o saldo
// disponivel, nunca mais que o valor que a propria cliente pediu pra usar, e nunca mais que
// PERCENTUAL_MAXIMO_USO do valor do pedido (subtotal com desconto de cupom + frete - a mesma
// base "incluindo frete" que a Foxton usa pro teto). Usado tanto no carrinho (preview) quanto
// revalidado no servidor na hora de criar a preferencia (ver lib/mercadopago.ts) - nunca confia
// so' no calculo feito no navegador.
export function calcularCreditoAplicavel(
  saldoDisponivel: number,
  valorSolicitado: number,
  valorPedido: number
): number {
  const teto = Math.round(valorPedido * PERCENTUAL_MAXIMO_USO * 100) / 100;
  const valor = Math.min(Math.max(0, saldoDisponivel), Math.max(0, valorSolicitado), teto);
  return Math.round(valor * 100) / 100;
}

// Concede o cashback de uma compra aprovada - chamado so' pelo webhook, depois que o pagamento
// ja foi confirmado approved e o pedido criado no Bling (nunca no momento da compra em si, pra
// nao dar credito de um pedido que pode nao ir pra frente). Idempotente via pedido_origem unique
// (ON CONFLICT DO NOTHING na funcao conceder_credito) - chamar duas vezes pro mesmo pedido
// (reenvio de webhook) nao concede credito em dobro. Nunca lanca erro pra fora: se isso falhar,
// o pior cenario e' a cliente nao receber o cashback dessa compra, bem menos grave que travar um
// pedido cujo pagamento ja foi aprovado.
export async function concederCashback(cpfLimpo: string, valorCompra: number, numeroPedido: string): Promise<void> {
  if (!SUPABASE_CONFIGURADO || valorCompra <= 0) return;
  const valorCredito = Math.round(valorCompra * PERCENTUAL_CASHBACK * 100) / 100;
  if (valorCredito <= 0) return;
  try {
    const supabase = clientePublico();
    const { error } = await supabase.rpc("conceder_credito", {
      p_cpf: cpfLimpo,
      p_valor: valorCredito,
      p_pedido_origem: numeroPedido,
      p_dias_validade: DIAS_VALIDADE_CREDITO
    });
    if (error) throw error;
  } catch (erro) {
    console.error(`Erro ao conceder cashback do pedido ${numeroPedido}:`, erro);
  }
}

// Consome o credito aplicado num pedido - chamado so' pelo webhook, junto com concederCashback,
// depois do pagamento aprovado (carrinho abandonado nao pode "gastar" credito, mesmo principio
// do cupom de primeira compra - ver registrarUsoCupomSeNecessario no webhook). Idempotente via
// pedido_uso PK (a funcao usar_credito checa se ja existe antes de consumir de novo). Devolve o
// valor efetivamente consumido (pode ser menor que o pedido se o saldo mudou entre a criacao da
// preferencia e a aprovacao do pagamento). Nunca lanca erro pra fora, mesmo raciocinio de
// concederCashback acima.
export async function usarCredito(cpfLimpo: string, valor: number, numeroPedido: string): Promise<number> {
  if (!SUPABASE_CONFIGURADO || valor <= 0) return 0;
  try {
    const supabase = clientePublico();
    const { data, error } = await supabase.rpc("usar_credito", {
      p_cpf: cpfLimpo,
      p_valor: valor,
      p_pedido_uso: numeroPedido
    });
    if (error) throw error;
    return Number(data) || 0;
  } catch (erro) {
    console.error(`Erro ao consumir credito do pedido ${numeroPedido}:`, erro);
    return 0;
  }
}

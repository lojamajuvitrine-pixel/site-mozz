import { CUPONS, type Cupom } from "@/lib/cupons";
import { clientePublico } from "@/lib/supabase/publico";
import { SUPABASE_CONFIGURADO } from "@/lib/supabase/config";
import { validarCpf } from "@/lib/cpf";

export type ResultadoCupom =
  | { valido: true; cupom: Cupom; desconto: number }
  | { valido: false; motivo: string };

// Checa (via funcao security definer no Supabase - ver migration cupons_usados) se esse CPF
// ja usou esse cupom antes. Nunca le a tabela cupons_usados direto (CPF e' dado sensivel e a
// chave usada aqui e' a publica/anon) - so' um boolean vai e volta. Se o Supabase estiver fora
// do ar ou nao configurado, deixa passar (nao bloqueia venda por causa disso - mesmo principio
// de buscarConfigProdutos/buscarConfiguracaoLoja).
async function cupomJaUsadoPeloCpf(codigo: string, cpfLimpo: string): Promise<boolean> {
  if (!SUPABASE_CONFIGURADO) return false;
  try {
    const supabase = clientePublico();
    const { data, error } = await supabase.rpc("cupom_ja_usado", {
      p_cupom_codigo: codigo,
      p_cpf: cpfLimpo
    });
    if (error) return false;
    return !!data;
  } catch {
    return false;
  }
}

// Validacao sempre roda de novo no servidor na hora de criar a preferencia de pagamento
// (ver lib/mercadopago.ts) - nunca confia so' no desconto calculado no navegador, pra nao
// dar pra manipular o total pagado mexendo no cliente.
//
// cpfDigitado so' e' obrigatorio quando o cupom encontrado tem usoUnicoPorCpf: true (cupom de
// primeira compra) - pra cupom comum, nem precisa passar. No carrinho o campo de cupom fica
// ANTES do campo de CPF (ver app/carrinho/page.tsx), entao se o cliente tentar aplicar um
// cupom de primeira compra antes de preencher o CPF, a mensagem pede pra preencher primeiro
// em vez de travar sem explicar por que.
export async function validarCupom(
  codigoDigitado: string,
  subtotal: number,
  cpfDigitado?: string
): Promise<ResultadoCupom> {
  const codigo = codigoDigitado.trim().toUpperCase();
  if (!codigo) return { valido: false, motivo: "Digite um código de cupom" };

  const cupom = CUPONS.find((c) => c.codigo.toUpperCase() === codigo);
  if (!cupom) return { valido: false, motivo: "Cupom não encontrado" };
  if (!cupom.ativo) return { valido: false, motivo: "Cupom inativo" };

  if (cupom.validoAte) {
    const limite = new Date(`${cupom.validoAte}T23:59:59`);
    if (Number.isFinite(limite.getTime()) && limite < new Date()) {
      return { valido: false, motivo: "Cupom expirado" };
    }
  }

  if (cupom.pedidoMinimo && subtotal < cupom.pedidoMinimo) {
    return {
      valido: false,
      motivo: `Válido a partir de ${cupom.pedidoMinimo.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL"
      })} em compras`
    };
  }

  if (cupom.usoUnicoPorCpf) {
    const cpfLimpo = (cpfDigitado ?? "").replace(/\D/g, "");
    if (!validarCpf(cpfLimpo)) {
      return { valido: false, motivo: "Preencha seu CPF (mais abaixo) antes de aplicar esse cupom" };
    }
    const jaUsado = await cupomJaUsadoPeloCpf(cupom.codigo, cpfLimpo);
    if (jaUsado) {
      return { valido: false, motivo: "Esse cupom já foi usado - válido só na primeira compra" };
    }
  }

  const desconto = cupom.tipo === "percentual" ? subtotal * (cupom.valor / 100) : Math.min(cupom.valor, subtotal);

  return { valido: true, cupom, desconto: Math.round(desconto * 100) / 100 };
}

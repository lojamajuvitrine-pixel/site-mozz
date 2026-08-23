import { CUPONS, type Cupom } from "@/lib/cupons";

export type ResultadoCupom =
  | { valido: true; cupom: Cupom; desconto: number }
  | { valido: false; motivo: string };

// Validacao sempre roda de novo no servidor na hora de criar a preferencia de pagamento
// (ver lib/mercadopago.ts) - nunca confia so' no desconto calculado no navegador, pra nao
// dar pra manipular o total pagado mexendo no cliente.
export function validarCupom(codigoDigitado: string, subtotal: number): ResultadoCupom {
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

  const desconto = cupom.tipo === "percentual" ? subtotal * (cupom.valor / 100) : Math.min(cupom.valor, subtotal);

  return { valido: true, cupom, desconto: Math.round(desconto * 100) / 100 };
}

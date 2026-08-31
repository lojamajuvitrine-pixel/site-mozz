import { NextRequest, NextResponse } from "next/server";
import { buscarSaldoCredito } from "@/lib/creditos";

// Usado pelo carrinho pra mostrar o saldo de credito de loja disponivel assim que o CPF
// digitado fica valido (ver app/carrinho/page.tsx) - mesmo padrao do /api/cupom/validar. O
// valor realmente aplicado no pedido e' sempre revalidado de novo no servidor ao criar a
// preferencia (ver lib/mercadopago.ts) - nunca confia so' nesse numero pra decidir quanto a
// cliente paga.
export async function POST(request: NextRequest) {
  const body = (await request.json()) as { cpf?: string };
  const cpfLimpo = (body.cpf ?? "").replace(/\D/g, "");
  const saldo = await buscarSaldoCredito(cpfLimpo);
  return NextResponse.json({ saldo });
}

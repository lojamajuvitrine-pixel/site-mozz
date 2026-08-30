import { NextRequest, NextResponse } from "next/server";
import { validarCupom } from "@/lib/cupom";

// Usado pelo carrinho pra dar feedback imediato ("cupom aplicado: -R$ 20,00") antes de ir
// pro checkout. A validacao de verdade (que decide quanto o cliente paga) roda de novo no
// servidor ao criar a preferencia do Mercado Pago (ver app/api/mercadopago/criar-preferencia).
export async function POST(request: NextRequest) {
  const body = (await request.json()) as { codigo: string; subtotal: number; cpf?: string };
  const resultado = await validarCupom(body.codigo ?? "", body.subtotal ?? 0, body.cpf);
  return NextResponse.json(resultado);
}

import { NextRequest, NextResponse } from "next/server";
import { clientePublico } from "@/lib/supabase/publico";

// Recebe o pedido de "avise-me quando voltar ao estoque" (ver components/AvisoEstoque.tsx).
// Usa o cliente PUBLICO (anon) de proposito - a tabela avisos_estoque so' libera INSERT pra
// anon via RLS (ver PROXIMOS_PASSOS.md pro SQL), nunca leitura: ninguem, nem essa rota, consegue
// listar os e-mails de volta usando essa chave. So' o script de sync (chave service_role,
// nunca exposta ao navegador) le e marca como notificado.
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Payload = { produtoId?: string; tamanho?: string; email?: string };

export async function POST(request: NextRequest) {
  const body = (await request.json()) as Payload;
  const produtoId = body.produtoId?.trim();
  const tamanho = body.tamanho?.trim();
  const email = body.email?.trim().toLowerCase();

  if (!produtoId || !tamanho) {
    return NextResponse.json({ erro: "Produto ou tamanho inválido" }, { status: 400 });
  }
  if (!email || !EMAIL_REGEX.test(email)) {
    return NextResponse.json({ erro: "E-mail inválido" }, { status: 400 });
  }

  const supabase = clientePublico();
  const { error } = await supabase.from("avisos_estoque").insert({ produto_id: produtoId, tamanho, email });

  // codigo 23505 = violacao de unique constraint - a pessoa ja pediu aviso desse mesmo
  // produto/tamanho antes e ainda nao foi notificada. Nao e' erro de verdade pro cliente,
  // ela ja esta' na lista - trata como sucesso.
  if (error && error.code !== "23505") {
    return NextResponse.json({ erro: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

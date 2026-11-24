import { NextRequest, NextResponse } from "next/server";
import { createClient as clienteSupabase } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { ehAdmin } from "@/lib/admin";
import { enviarEmailRastreioPedido, linkRastreioPadrao } from "@/lib/emailRastreio";

// Botao do painel /admin/pedidos (24/11/2026): salva o codigo de rastreio de uma etiqueta feita
// na mao no Melhor Envio (opcional) e manda o e-mail "pedido enviado" pra cliente.
export async function POST(request: NextRequest) {
  const supabaseUsuario = createClient();
  const {
    data: { user }
  } = await supabaseUsuario.auth.getUser();
  if (!ehAdmin(user?.email)) return NextResponse.json({ erro: "Não autorizado" }, { status: 401 });

  let corpo: { numeroPedido?: string; codigo?: string };
  try {
    corpo = await request.json();
  } catch {
    return NextResponse.json({ erro: "Corpo inválido" }, { status: 400 });
  }
  const numeroPedido = String(corpo.numeroPedido ?? "").trim();
  const codigo = String(corpo.codigo ?? "").trim().toUpperCase();
  if (!numeroPedido) return NextResponse.json({ erro: "Pedido não informado" }, { status: 400 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !chave) return NextResponse.json({ erro: "Supabase não configurado" }, { status: 500 });
  const supabase = clienteSupabase(url, chave, { auth: { persistSession: false } });

  if (codigo) {
    if (!/^[A-Z0-9]{8,20}$/.test(codigo)) {
      return NextResponse.json({ erro: "Código de rastreio inválido" }, { status: 400 });
    }
    const { error } = await supabase
      .from("pedidos")
      .update({
        codigo_rastreio: codigo,
        link_rastreio: linkRastreioPadrao(codigo),
        transportadora: "Correios",
        status_envio: "etiqueta_gerada",
        atualizado_em: new Date().toISOString()
      })
      .eq("numero_pedido", numeroPedido);
    if (error) return NextResponse.json({ erro: "Não consegui salvar o código" }, { status: 500 });
  }

  const resultado = await enviarEmailRastreioPedido(numeroPedido);
  if (!resultado.ok) return NextResponse.json({ erro: resultado.motivo ?? "Falha ao enviar" }, { status: 400 });
  return NextResponse.json({ ok: true });
}

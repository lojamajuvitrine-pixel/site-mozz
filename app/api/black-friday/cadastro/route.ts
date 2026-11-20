import { NextRequest, NextResponse } from "next/server";
import { clienteServicoBlackFriday } from "@/lib/blackFriday";

// Cadastro pro acesso antecipado da Black Friday (pagina /black-friday). Mesmo WhatsApp
// cadastrado de novo so' atualiza nome/e-mail, sem duplicar a pessoa na lista.
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as {
    nome?: string;
    whatsapp?: string;
    email?: string;
    aceite?: boolean;
  };

  const nome = (body.nome ?? "").trim().slice(0, 120);
  let whatsapp = (body.whatsapp ?? "").replace(/\D/g, "");
  if (whatsapp.startsWith("55") && whatsapp.length >= 12) whatsapp = whatsapp.slice(2);
  const email = (body.email ?? "").trim().toLowerCase().slice(0, 160);

  if (nome.length < 2) return NextResponse.json({ erro: "Digite seu nome." }, { status: 400 });
  if (whatsapp.length < 10 || whatsapp.length > 11) {
    return NextResponse.json({ erro: "Digite seu WhatsApp com DDD." }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ erro: "Digite um e-mail válido." }, { status: 400 });
  }
  if (!body.aceite) {
    return NextResponse.json({ erro: "Marque a opção para receber as ofertas da Mozz." }, { status: 400 });
  }

  const supabase = clienteServicoBlackFriday();
  if (!supabase) return NextResponse.json({ erro: "Cadastro indisponível no momento." }, { status: 500 });

  const { error } = await supabase
    .from("black_friday_cadastros")
    .upsert({ nome, whatsapp, email, aceita_marketing: true }, { onConflict: "whatsapp" });
  if (error) {
    console.error("Black Friday: erro ao salvar cadastro:", error.message);
    return NextResponse.json({ erro: "Não foi possível concluir o cadastro. Tente de novo." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

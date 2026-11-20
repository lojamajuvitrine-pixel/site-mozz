import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ehAdmin } from "@/lib/admin";
import {
  CODIGO_ACESSO_ANTECIPADO,
  LIBERAR_ENVIO_EMAIL_EM,
  clienteServicoBlackFriday
} from "@/lib/blackFriday";
import { SITE_URL } from "@/lib/site";

export const maxDuration = 60;

const REMETENTE = "MOZZ <pedidos@notificacoes.lojamozz.com.br>";
const OURO = "#C9A24B";

function escapar(texto: string): string {
  return texto.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function htmlEmail(nome: string, link: string): string {
  const primeiroNome = escapar(nome.trim().split(" ")[0] || nome.trim());
  return `
  <div style="background:#000;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;">
    <div style="max-width:480px;margin:0 auto;text-align:center;color:#fff;">
      <p style="font-size:30px;letter-spacing:10px;color:${OURO};margin:0;font-weight:bold;">MOZZ</p>
      <p style="font-size:26px;font-weight:800;margin:16px 0 0;">BLACK FRIDAY</p>
      <p style="font-size:18px;margin:24px 0 8px;">Olá, ${primeiroNome}!</p>
      <p style="font-size:15px;line-height:1.6;color:#ddd;margin:0 0 24px;">
        Como você se cadastrou, a Black Friday da Mozz abriu primeiro para você.
        Até a meia-noite, só quem tem este link consegue comprar, com a grade completa.
      </p>
      <a href="${link}" style="display:inline-block;background:${OURO};color:#000;text-decoration:none;font-weight:bold;font-size:16px;padding:16px 32px;border-radius:999px;">Entrar na Black Friday</a>
      <p style="font-size:13px;color:#999;margin:24px 0 0;">
        A partir de 28/11 à 00h00 a página abre para todo mundo e as peças podem esgotar.
      </p>
    </div>
  </div>`;
}

// Manda o e-mail de acesso antecipado pra todo mundo cadastrado que ainda nao recebeu
// (botao no painel /admin/black-friday). Pode clicar de novo sem medo: quem ja' recebeu nao
// recebe outra vez.
export async function POST() {
  const supabaseUsuario = createClient();
  const {
    data: { user }
  } = await supabaseUsuario.auth.getUser();
  if (!ehAdmin(user?.email)) return NextResponse.json({ erro: "Não autorizado" }, { status: 401 });

  if (Date.now() < Date.parse(LIBERAR_ENVIO_EMAIL_EM)) {
    return NextResponse.json({ erro: "O envio libera em 27/11 a partir das 20h30." }, { status: 400 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const supabase = clienteServicoBlackFriday();
  if (!apiKey || !supabase) return NextResponse.json({ erro: "Envio de e-mail não configurado" }, { status: 500 });

  const { data, error } = await supabase
    .from("black_friday_cadastros")
    .select("id, nome, email")
    .is("email_acesso_enviado_em", null);
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });

  const link = `${SITE_URL}/black-friday?acesso=${CODIGO_ACESSO_ANTECIPADO}`;
  const pendentes = data ?? [];
  let enviados = 0;
  let falhas = 0;

  // Resend aceita ate' 100 e-mails por chamada no envio em lote.
  for (let i = 0; i < pendentes.length; i += 100) {
    const lote = pendentes.slice(i, i + 100);
    try {
      const resposta = await fetch("https://api.resend.com/emails/batch", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(
          lote.map((c) => ({
            from: REMETENTE,
            to: [c.email],
            subject: "Seu acesso antecipado à Black Friday Mozz está liberado",
            html: htmlEmail(c.nome, link)
          }))
        )
      });
      if (!resposta.ok) throw new Error(`Resend falhou (${resposta.status}): ${await resposta.text()}`);
      await supabase
        .from("black_friday_cadastros")
        .update({ email_acesso_enviado_em: new Date().toISOString() })
        .in(
          "id",
          lote.map((c) => c.id)
        );
      enviados += lote.length;
    } catch (erro) {
      console.error("Black Friday: erro ao enviar lote de e-mails de acesso antecipado:", erro);
      falhas += lote.length;
    }
  }

  return NextResponse.json({ ok: true, enviados, falhas });
}

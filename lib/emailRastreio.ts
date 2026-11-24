// E-mail "seu pedido foi enviado" com o codigo de rastreio (pedido do Brunno em 24/11/2026).
// O e-mail de confirmacao (lib/emailPedido.ts) ja' prometia "voce recebe outro e-mail com o
// codigo de rastreio", mas esse segundo e-mail nunca existia.
//
// Quem chama:
// - app/api/mercadopago/webhook: logo depois que o site compra a etiqueta sozinho;
// - app/api/melhorenvio/webhook: quando o Melhor Envio avisa etiqueta gerada/postada;
// - app/api/admin/pedidos/rastreio: botao no painel /admin/pedidos (etiqueta feita na mao).
//
// Nunca manda duas vezes: a coluna pedidos.email_rastreio_enviado_em marca o envio.
// Nunca derruba quem chamou: qualquer erro so' vira log e retorno { ok: false }.
import { createClient } from "@supabase/supabase-js";

const REMETENTE = "MOZZ <pedidos@notificacoes.lojamozz.com.br>";

export function linkRastreioPadrao(codigo: string): string {
  return `https://www.melhorrastreio.com.br/rastreio/${encodeURIComponent(codigo)}`;
}

function clienteServico() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !chave) return null;
  return createClient(url, chave, { auth: { persistSession: false } });
}

function escapar(texto: string): string {
  return texto.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

type ItemPedido = { nome?: string; qtd?: number };

function montarHtml(params: { nome: string; numeroPedido: string; itens: ItemPedido[]; codigo: string; link: string }): string {
  const primeiroNome = escapar(params.nome.trim().split(" ")[0] || params.nome.trim());
  const pecas = params.itens
    .map((item) => `${item.qtd && item.qtd > 1 ? `${item.qtd}x ` : ""}${escapar(item.nome ?? "")}`)
    .filter(Boolean)
    .join("<br>");
  return `
    <div style="font-family:sans-serif;color:#1a1a1a;max-width:480px;">
      <p>Oi, ${primeiroNome}!</p>
      <p>Seu pedido na Mozz já está a caminho.</p>
      <p style="font-weight:600;margin-bottom:4px;">Pedido ${escapar(params.numeroPedido)}</p>
      <p style="margin-top:0;"><strong>Peça(s):</strong><br>${pecas}</p>
      <p><strong>Envio:</strong> Correios<br><strong>Código de rastreio:</strong> ${escapar(params.codigo)}</p>
      <p style="margin:24px 0;">
        <a href="${params.link}" style="display:inline-block;background:#1a1a1a;color:#fff;text-decoration:none;font-weight:600;padding:12px 24px;border-radius:999px;">Acompanhar minha entrega</a>
      </p>
      <p style="font-size:13px;color:#666;">O rastreio pode levar até 24 horas para mostrar a primeira movimentação depois da postagem.</p>
      <p>Qualquer dúvida, é só responder este e-mail ou chamar a gente no WhatsApp.</p>
      <p>— Equipe Mozz · <a href="https://lojamozz.com.br">lojamozz.com.br</a></p>
    </div>
  `;
}

export type ResultadoEmailRastreio = { ok: boolean; motivo?: string };

export async function enviarEmailRastreioPedido(numeroPedido: string): Promise<ResultadoEmailRastreio> {
  const apiKey = process.env.RESEND_API_KEY;
  const supabase = clienteServico();
  if (!apiKey || !supabase) {
    console.warn("E-mail de rastreio: RESEND_API_KEY ou SUPABASE_SERVICE_ROLE_KEY ausente - pulando envio.");
    return { ok: false, motivo: "Envio de e-mail não configurado" };
  }

  try {
    const { data: pedido, error } = await supabase
      .from("pedidos")
      .select("numero_pedido, nome, email, itens, codigo_rastreio, link_rastreio, email_rastreio_enviado_em")
      .eq("numero_pedido", numeroPedido)
      .maybeSingle();
    if (error) throw error;
    if (!pedido) return { ok: false, motivo: "Pedido não encontrado" };
    if (pedido.email_rastreio_enviado_em) return { ok: false, motivo: "E-mail de rastreio já foi enviado" };

    const codigo = String(pedido.codigo_rastreio ?? "").trim();
    if (!codigo) return { ok: false, motivo: "Pedido sem código de rastreio" };

    const email = String(pedido.email ?? "").trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      console.warn(`E-mail de rastreio do pedido ${numeroPedido}: e-mail inválido ("${pedido.email}")`);
      return { ok: false, motivo: "E-mail da cliente inválido" };
    }

    // Marca ANTES de mandar (com condicao "ainda nao enviado") - se dois webhooks chegarem juntos,
    // so' um consegue marcar e so' esse manda. Se o Resend falhar, desmarca pra poder tentar de novo.
    const { data: marcado, error: erroMarca } = await supabase
      .from("pedidos")
      .update({ email_rastreio_enviado_em: new Date().toISOString() })
      .eq("numero_pedido", numeroPedido)
      .is("email_rastreio_enviado_em", null)
      .select("numero_pedido");
    if (erroMarca) throw erroMarca;
    if (!marcado || marcado.length === 0) return { ok: false, motivo: "E-mail de rastreio já foi enviado" };

    const link = String(pedido.link_rastreio ?? "").trim() || linkRastreioPadrao(codigo);
    const itens = Array.isArray(pedido.itens) ? (pedido.itens as ItemPedido[]) : [];

    const resposta = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: REMETENTE,
        to: [email],
        subject: `Seu pedido foi enviado 🖤 ${numeroPedido}`,
        html: montarHtml({ nome: String(pedido.nome ?? ""), numeroPedido, itens, codigo, link })
      })
    });
    if (!resposta.ok) {
      const texto = await resposta.text();
      await supabase.from("pedidos").update({ email_rastreio_enviado_em: null }).eq("numero_pedido", numeroPedido);
      throw new Error(`Resend falhou (${resposta.status}): ${texto}`);
    }
    return { ok: true };
  } catch (erro) {
    console.error(`Erro ao enviar e-mail de rastreio do pedido ${numeroPedido}:`, erro);
    return { ok: false, motivo: "Falha ao enviar o e-mail" };
  }
}

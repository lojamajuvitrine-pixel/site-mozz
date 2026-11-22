// API de Conversoes do Meta (22/11/2026, pedido do Brunno) - manda a COMPRA pelo servidor quando
// o Mercado Pago aprova o pagamento (webhook), igual ja' acontece com o Google Analytics
// (lib/ga4.ts). Conta tambem o Pix pago depois, com a pagina fechada. O navegador continua
// mandando o mesmo Purchase com o mesmo event_id (numero do pedido), e o Meta junta os dois sem
// contar em dobro. So' funciona com META_CAPI_TOKEN na Vercel (Gerenciador de Eventos > pixel >
// Configuracoes > API de Conversoes > Gerar token); sem ele, nao faz nada.
import { createHash } from "crypto";

type ItemCompra = { id: number | string; qtd: number; valor?: number };

function hash(valor: string | undefined | null): string[] | undefined {
  const limpo = (valor ?? "").trim().toLowerCase();
  if (!limpo) return undefined;
  return [createHash("sha256").update(limpo).digest("hex")];
}

export async function enviarCompraMeta(params: {
  numeroPedido: string;
  valorTotal: number;
  itens: ItemCompra[];
  email?: string | null;
  telefone?: string | null;
  cpf?: string | null;
  endereco?: { cidade?: string; uf?: string; cep?: string } | null;
}): Promise<void> {
  const token = process.env.META_CAPI_TOKEN;
  const pixel = process.env.NEXT_PUBLIC_META_PIXEL_ID;
  if (!token || !pixel) return;

  const telefone = (params.telefone ?? "").replace(/\D/g, "");
  const cidade = (params.endereco?.cidade ?? "").normalize("NFD").replace(/[̀-ͯ\s]/g, "");
  const corpo = {
    data: [
      {
        event_name: "Purchase",
        event_time: Math.floor(Date.now() / 1000),
        event_id: params.numeroPedido,
        action_source: "website",
        event_source_url: "https://lojamozz.com.br/checkout/sucesso",
        user_data: {
          em: hash(params.email),
          ph: hash(telefone ? (telefone.startsWith("55") ? telefone : `55${telefone}`) : ""),
          external_id: hash(params.cpf),
          ct: hash(cidade),
          st: hash(params.endereco?.uf),
          zp: hash((params.endereco?.cep ?? "").replace(/\D/g, "")),
          country: hash("br")
        },
        custom_data: {
          currency: "BRL",
          value: Math.round(params.valorTotal * 100) / 100,
          content_type: "product",
          content_ids: params.itens.map((i) => String(i.id)),
          contents: params.itens.map((i) => ({ id: String(i.id), quantity: i.qtd }))
        }
      }
    ]
  };

  try {
    const resposta = await fetch(`https://graph.facebook.com/v21.0/${pixel}/events?access_token=${encodeURIComponent(token)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corpo)
    });
    if (!resposta.ok) console.warn(`[meta-capi] compra ${params.numeroPedido} recusada: ${resposta.status} ${await resposta.text()}`);
  } catch (erro) {
    console.warn(`[meta-capi] falha ao enviar compra ${params.numeroPedido}:`, erro);
  }
}

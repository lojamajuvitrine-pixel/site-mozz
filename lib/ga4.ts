// Compra enviada pro Google Analytics 4 pelo SERVIDOR (Measurement Protocol) - 07/11/2026.
//
// Antes a compra so' era medida na pagina /checkout/sucesso, no navegador: se a cliente gerasse o
// Pix, fechasse a pagina e pagasse depois, a venda nao contava no Google Ads. Agora o webhook do
// Mercado Pago chama isso quando o pagamento e' aprovado (a qualquer hora, com a pagina aberta ou
// nao), com o valor real pago (produtos + frete, ja' com descontos). O Google Ads importa essa
// compra do Analytics como conversao principal.
//
// O codigo de visitante (_ga) e a sessao vem do navegador no checkout (lerIdsGoogleAnalytics em
// lib/tracking.ts) e ficam guardados no pedido - e' isso que liga a compra ao anuncio clicado.
//
// Precisa de GA4_API_SECRET na Vercel (Google Analytics > Administrador > Fluxos de dados > o
// fluxo do site > Chaves secretas da API do Measurement Protocol). Sem ela, nao envia nada.
type ItemCompra = { id: number | string; nome: string; qtd: number; valor: number };

export async function enviarCompraGA4(params: {
  numeroPedido: string;
  valorTotal: number;
  frete: number;
  itens: ItemCompra[];
  gaClientId?: string;
  gaSessionId?: string;
}): Promise<void> {
  const idMedicao = process.env.NEXT_PUBLIC_GA_ID;
  const segredo = process.env.GA4_API_SECRET;
  if (!idMedicao || !segredo) {
    console.warn(`[ga4] NEXT_PUBLIC_GA_ID ou GA4_API_SECRET ausente - compra ${params.numeroPedido} nao enviada pro Google Analytics`);
    return;
  }

  const visitanteIdentificado = !!params.gaClientId && /^\d+\.\d+$/.test(params.gaClientId);
  // Sem o codigo do visitante (bloqueador de anuncio, cookie recusado), a compra entra no
  // Analytics mesmo assim (receita certa), so' sem ligar a um anuncio.
  const clientId = visitanteIdentificado
    ? params.gaClientId!
    : `${Math.floor(Math.random() * 1_000_000_000)}.${Math.floor(Date.now() / 1000)}`;

  const corpo = {
    client_id: clientId,
    events: [
      {
        name: "purchase",
        params: {
          transaction_id: params.numeroPedido,
          currency: "BRL",
          value: Math.round(params.valorTotal * 100) / 100,
          shipping: Math.round(params.frete * 100) / 100,
          ...(params.gaSessionId && /^\d+$/.test(params.gaSessionId) ? { session_id: params.gaSessionId } : {}),
          engagement_time_msec: 1,
          items: params.itens
            .filter((item) => Number(item.id) > 0)
            .map((item) => ({ item_id: String(item.id), item_name: item.nome, price: item.valor, quantity: item.qtd }))
        }
      }
    ]
  };

  try {
    const resposta = await fetch(
      `https://www.google-analytics.com/mp/collect?measurement_id=${encodeURIComponent(idMedicao)}&api_secret=${encodeURIComponent(segredo)}`,
      { method: "POST", body: JSON.stringify(corpo), cache: "no-store" }
    );
    if (!resposta.ok) {
      console.error(`[ga4] Google Analytics respondeu ${resposta.status} pra compra ${params.numeroPedido}`);
      return;
    }
    console.log(
      `[ga4] compra ${params.numeroPedido} enviada pro Google Analytics (${visitanteIdentificado ? "com" : "sem"} visitante identificado)`
    );
  } catch (erro) {
    console.error(`[ga4] falha ao enviar a compra ${params.numeroPedido} pro Google Analytics:`, erro);
  }
}

// Integracao com o Mercado Pago via Checkout Pro (Preferences API).
// Fluxo: o carrinho vira uma "preferencia" criada aqui no servidor -> o comprador e'
// redirecionado pro ambiente do Mercado Pago (init_point) -> ele paga -> o Mercado Pago
// chama nosso webhook (app/api/mercadopago/webhook) pra avisar o status real do pagamento.
// Documentacao: mercadopago.com.br/developers/pt/docs/checkout-pro/overview

import { MercadoPagoConfig, Preference } from "mercadopago";
import type { Produto } from "@/lib/produtos";

function obterCliente() {
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error("MERCADOPAGO_ACCESS_TOKEN ausente no .env");
  }
  return new MercadoPagoConfig({ accessToken });
}

export type ItemCarrinho = { produto: Produto; cor: string; tamanho: string; quantidade: number };

export async function criarPreferenciaPagamento(itens: ItemCarrinho[], numeroPedido: string) {
  const client = obterCliente();
  const preference = new Preference(client);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const resposta = await preference.create({
    body: {
      external_reference: numeroPedido,
      items: itens.map((item) => ({
        id: item.produto.id,
        title:
          item.cor && item.cor !== "Único"
            ? `${item.produto.nome} (${item.cor}, ${item.tamanho})`
            : `${item.produto.nome} (${item.tamanho})`,
        quantity: item.quantidade,
        unit_price: item.produto.preco,
        currency_id: "BRL"
      })),
      back_urls: {
        success: `${siteUrl}/checkout/sucesso`,
        failure: `${siteUrl}/checkout/erro`,
        pending: `${siteUrl}/checkout/pendente`
      },
      auto_return: "approved",
      notification_url: `${siteUrl}/api/mercadopago/webhook`
    }
  });

  return resposta;
}

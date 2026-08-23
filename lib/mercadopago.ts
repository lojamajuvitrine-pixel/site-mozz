// Integracao com o Mercado Pago via Checkout Pro (Preferences API).
// Fluxo: o carrinho vira uma "preferencia" criada aqui no servidor -> o comprador e'
// redirecionado pro ambiente do Mercado Pago (init_point) -> ele paga -> o Mercado Pago
// chama nosso webhook (app/api/mercadopago/webhook) pra avisar o status real do pagamento.
// Documentacao: mercadopago.com.br/developers/pt/docs/checkout-pro/overview

import { MercadoPagoConfig, Preference } from "mercadopago";
import type { Produto } from "@/lib/produtos";
import { validarCupom } from "@/lib/cupom";

function obterCliente() {
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error("MERCADOPAGO_ACCESS_TOKEN ausente no .env");
  }
  return new MercadoPagoConfig({ accessToken });
}

export type ItemCarrinho = { produto: Produto; cor: string; tamanho: string; quantidade: number };

export async function criarPreferenciaPagamento(
  itens: ItemCarrinho[],
  numeroPedido: string,
  cupomCodigo?: string
) {
  const client = obterCliente();
  const preference = new Preference(client);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  // O desconto do cupom (se houver) e' revalidado aqui no servidor - nunca confia no valor
  // calculado no carrinho no navegador. A Preference API do Mercado Pago nao aceita um item
  // de "desconto" com preco negativo, entao o jeito e' aplicar o desconto proporcionalmente
  // no preco unitario de cada item (reduz todo mundo pela mesma porcentagem), o que da' no
  // mesmo total final.
  const subtotal = itens.reduce((soma, item) => soma + item.produto.preco * item.quantidade, 0);
  let fatorDesconto = 1;
  let codigoCupomAplicado: string | undefined;
  if (cupomCodigo && subtotal > 0) {
    const resultado = validarCupom(cupomCodigo, subtotal);
    if (resultado.valido) {
      fatorDesconto = (subtotal - resultado.desconto) / subtotal;
      codigoCupomAplicado = resultado.cupom.codigo;
    }
  }

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
        unit_price: Math.round(item.produto.preco * fatorDesconto * 100) / 100,
        currency_id: "BRL"
      })),
      metadata: codigoCupomAplicado ? { cupom: codigoCupomAplicado } : undefined,
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

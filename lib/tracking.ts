"use client";

// Eventos de ecommerce pro Meta Pixel e Google Analytics - sem isso, o pixel so' sabe que
// alguem visitou o site (PageView), mas nao sabe quem colocou peca na sacola, quem chegou
// perto de comprar ou quem comprou de fato. Sao esses 4 eventos (ViewContent, AddToCart,
// InitiateCheckout, Purchase) que permitem: reengajar quem viu uma peca ou abandonou o
// carrinho com anuncio, otimizar campanha pra gente parecida com quem realmente compra (nao
// so' quem clica), e medir o retorno de cada campanha (ROAS) direito.
//
// window.fbq/gtag so' existem se o Pixel/GA estiverem configurados (ver NEXT_PUBLIC_META_
// PIXEL_ID/NEXT_PUBLIC_GA_ID em app/layout.tsx) - por isso todo disparo aqui usa "?." e
// funciona sem quebrar mesmo antes desses IDs existirem (so' nao manda nada).
//
// Limitacao conhecida: o valor do evento de Purchase usa o subtotal do carrinho no momento
// em que o cliente chega na pagina de sucesso (nao inclui frete, e desconto de cupom so'
// entra se ainda estiver no localStorage) - pra numero exato por pedido, precisaria de
// rastreamento server-side (Conversions API) puxando o valor real do webhook do Mercado
// Pago, o que fica pra depois.
declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    gtag?: (...args: unknown[]) => void;
  }
}

export type ItemRastreado = {
  id: string;
  nome: string;
  marca: string;
  preco: number;
  quantidade: number;
};

function itensParaGA(itens: ItemRastreado[]) {
  return itens.map((i) => ({
    item_id: i.id,
    item_name: i.nome,
    item_brand: i.marca,
    price: i.preco,
    quantity: i.quantidade
  }));
}

// Disparado ao ABRIR a pagina de um produto (ver SeletorProduto.tsx) - e' o primeiro passo
// do funil, o que faltava pra completar ViewContent -> AddToCart -> InitiateCheckout ->
// Purchase. Sem isso, o Pixel nao consegue montar publico de remarketing de "quem viu peca
// X mas nao comprou", nem otimizar campanha por quem tem intencao real de compra.
export function rastrearVisualizarProduto(item: ItemRastreado) {
  window.fbq?.("track", "ViewContent", {
    content_ids: [item.id],
    content_name: item.nome,
    content_type: "product",
    value: item.preco,
    currency: "BRL"
  });
  window.gtag?.("event", "view_item", {
    currency: "BRL",
    value: item.preco,
    items: itensParaGA([item])
  });
}

export function rastrearAdicionarAoCarrinho(item: ItemRastreado) {
  const valor = item.preco * item.quantidade;
  window.fbq?.("track", "AddToCart", {
    content_ids: [item.id],
    content_name: item.nome,
    content_type: "product",
    value: valor,
    currency: "BRL"
  });
  window.gtag?.("event", "add_to_cart", {
    currency: "BRL",
    value: valor,
    items: itensParaGA([item])
  });
}

export function rastrearIniciarCheckout(itens: ItemRastreado[]) {
  const valor = itens.reduce((soma, i) => soma + i.preco * i.quantidade, 0);
  window.fbq?.("track", "InitiateCheckout", {
    content_ids: itens.map((i) => i.id),
    contents: itens.map((i) => ({ id: i.id, quantity: i.quantidade })),
    value: valor,
    currency: "BRL",
    num_items: itens.reduce((soma, i) => soma + i.quantidade, 0)
  });
  window.gtag?.("event", "begin_checkout", {
    currency: "BRL",
    value: valor,
    items: itensParaGA(itens)
  });
}

export function rastrearCompra(pedidoId: string, itens: ItemRastreado[]) {
  const valor = itens.reduce((soma, i) => soma + i.preco * i.quantidade, 0);
  window.fbq?.("track", "Purchase", {
    content_ids: itens.map((i) => i.id),
    contents: itens.map((i) => ({ id: i.id, quantity: i.quantidade })),
    value: valor,
    currency: "BRL"
  });
  window.gtag?.("event", "purchase", {
    transaction_id: pedidoId,
    currency: "BRL",
    value: valor,
    items: itensParaGA(itens)
  });
}

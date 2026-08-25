// Integracao com o Mercado Pago via Checkout Pro (Preferences API).
// Fluxo: o carrinho vira uma "preferencia" criada aqui no servidor -> o comprador e'
// redirecionado pro ambiente do Mercado Pago (init_point) -> ele paga -> o Mercado Pago
// chama nosso webhook (app/api/mercadopago/webhook) pra avisar o status real do pagamento.
// Documentacao: mercadopago.com.br/developers/pt/docs/checkout-pro/overview

import { MercadoPagoConfig, Preference } from "mercadopago";
import type { Produto } from "@/lib/produtos";
import { resolverProdutoIdBling } from "@/lib/produtos";
import { validarCupom } from "@/lib/cupom";
import { validarCpf } from "@/lib/cpf";

function obterCliente() {
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error("MERCADOPAGO_ACCESS_TOKEN ausente no .env");
  }
  return new MercadoPagoConfig({ accessToken });
}

export type ItemCarrinho = { produto: Produto; cor: string; tamanho: string; quantidade: number };

export type FreteEscolhido = { servico: string; transportadora: string; preco: number };

export type ClienteCheckout = { nomeCompleto: string; cpf: string; telefone?: string };

// Formato compacto guardado no metadata da preferencia (volta intacto no payload do
// pagamento quando o Mercado Pago chama o webhook - ver app/api/mercadopago/webhook) - assim
// o webhook nao depende de nenhum banco novo nem de tentar re-interpretar o titulo dos itens:
// os ids Bling ja vem resolvidos daqui (ver resolverProdutoIdBling), na hora da compra.
export type PedidoMetadata = {
  itens: { id: number; nome: string; qtd: number; valor: number }[];
  frete: number;
  nome: string;
  cpf: string;
  telefone?: string;
};

export async function criarPreferenciaPagamento(
  itens: ItemCarrinho[],
  numeroPedido: string,
  cliente: ClienteCheckout,
  frete?: FreteEscolhido,
  cupomCodigo?: string
) {
  if (!cliente.nomeCompleto.trim() || !validarCpf(cliente.cpf)) {
    throw new Error("Nome completo e CPF válidos são obrigatórios pra finalizar a compra");
  }

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

  const itensPreferencia = itens.map((item) => ({
    id: item.produto.id,
    title:
      item.cor && item.cor !== "Único"
        ? `${item.produto.nome} (${item.cor}, ${item.tamanho})`
        : `${item.produto.nome} (${item.tamanho})`,
    quantity: item.quantidade,
    unit_price: Math.round(item.produto.preco * fatorDesconto * 100) / 100,
    currency_id: "BRL",
    // resolvido AGORA (nao no webhook) pra nao depender do catalogo nao ter mudado ate' o
    // pagamento ser confirmado - ver resolverProdutoIdBling em lib/produtos.ts.
    _idBling: resolverProdutoIdBling(item.produto, item.tamanho)
  }));

  // Frete entra como um item a parte (o Mercado Pago nao tem um campo nativo de "frete" na
  // Preference API) - assim ele soma no total cobrado do cliente de verdade, em vez de ficar
  // so' informativo como estava antes (ver components/CalculoFrete.tsx).
  if (frete && frete.preco > 0) {
    itensPreferencia.push({
      id: "frete",
      title: `Frete - ${frete.transportadora} ${frete.servico}`,
      quantity: 1,
      unit_price: Math.round(frete.preco * 100) / 100,
      currency_id: "BRL",
      _idBling: 0
    });
  }

  const pedidoMetadata: PedidoMetadata = {
    itens: itens.map((item, indice) => ({
      id: itensPreferencia[indice]._idBling,
      nome: `${item.produto.nome} (${item.tamanho})`,
      qtd: item.quantidade,
      valor: itensPreferencia[indice].unit_price
    })),
    frete: frete?.preco ?? 0,
    nome: cliente.nomeCompleto.trim(),
    cpf: cliente.cpf.replace(/\D/g, ""),
    telefone: cliente.telefone
  };

  const resposta = await preference.create({
    body: {
      external_reference: numeroPedido,
      items: itensPreferencia.map(({ _idBling, ...item }) => item),
      metadata: {
        ...(codigoCupomAplicado ? { cupom: codigoCupomAplicado } : {}),
        pedido_json: JSON.stringify(pedidoMetadata)
      },
      payer: { name: cliente.nomeCompleto.trim().split(" ")[0], identification: { type: "CPF", number: pedidoMetadata.cpf } },
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

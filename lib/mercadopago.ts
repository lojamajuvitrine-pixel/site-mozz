// Integracao com o Mercado Pago via Checkout Pro (Preferences API).
// Fluxo: o carrinho vira uma "preferencia" criada aqui no servidor -> o comprador e'
// redirecionado pro ambiente do Mercado Pago (init_point) -> ele paga -> o Mercado Pago
// chama nosso webhook (app/api/mercadopago/webhook) pra avisar o status real do pagamento.
// Documentacao: mercadopago.com.br/developers/pt/docs/checkout-pro/overview

import { MercadoPagoConfig, Preference } from "mercadopago";
import type { Produto } from "@/lib/produtos";
import { resolverProdutoIdBling, buscarProduto, coresDoProduto, tamanhosDisponiveisDoColor } from "@/lib/produtos";
import { validarCupom } from "@/lib/cupom";
import { validarCpf } from "@/lib/cpf";

// Erro "esperado" (o pedido em si nao pode seguir por um motivo que o cliente precisa saber -
// endereco incompleto, tamanho sem estoque, etc.) - diferente de um erro tecnico inesperado
// (Mercado Pago fora do ar, bug). A rota da API (app/api/mercadopago/criar-preferencia) usa
// isso pra decidir se mostra a mensagem real pro cliente ou uma generica (ver comentario la').
export class ErroValidacaoPedido extends Error {}

function obterCliente() {
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error("MERCADOPAGO_ACCESS_TOKEN ausente no .env");
  }
  return new MercadoPagoConfig({ accessToken });
}

export type ItemCarrinho = { produto: Produto; cor: string; tamanho: string; quantidade: number };

export type FreteEscolhido = { servico: string; transportadora: string; preco: number };

export type EnderecoCheckout = {
  cep: string;
  rua: string;
  numero: string;
  complemento?: string;
  bairro: string;
  cidade: string;
  uf: string;
};

export type ClienteCheckout = {
  nomeCompleto: string;
  cpf: string;
  telefone?: string;
  endereco: EnderecoCheckout;
};

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
  endereco: EnderecoCheckout;
};

export async function criarPreferenciaPagamento(
  itens: ItemCarrinho[],
  numeroPedido: string,
  cliente: ClienteCheckout,
  frete?: FreteEscolhido,
  cupomCodigo?: string
) {
  if (!cliente.nomeCompleto.trim() || !validarCpf(cliente.cpf)) {
    throw new ErroValidacaoPedido("Nome completo e CPF válidos são obrigatórios pra finalizar a compra");
  }
  const end = cliente.endereco;
  if (!end?.rua?.trim() || !end?.numero?.trim() || !end?.bairro?.trim() || !end?.cidade?.trim() || !end?.uf?.trim()) {
    throw new ErroValidacaoPedido("Endereço de entrega completo é obrigatório pra finalizar a compra");
  }

  // Revalida cada item do carrinho contra o catalogo real (data/produtos.json, atualizado a
  // cada 5min pelo sync-estoque) ANTES de criar a preferencia - nunca confia no que veio do
  // carrinho no navegador. Isso fecha dois problemas de uma vez, os dois levantados pelo
  // Brunno em 29/08/2026: (1) nada impedia comprar um tamanho que zerou o estoque entre a
  // cliente ver a pagina e finalizar a compra; (2) o preco usado era o que veio no corpo do
  // request (item.produto.preco) - alguem adulterando a chamada da API diretamente (fora do
  // site normal) conseguiria mandar qualquer preco. Dai' pra frente so' o preco/nome vindos
  // AGORA do catalogo (produtoReal) sao usados - o que veio do carrinho serve so' pra saber
  // QUAL produto/cor/tamanho/quantidade, nunca o preco.
  const itensValidados = await Promise.all(
    itens.map(async (item) => {
      const produtoReal = await buscarProduto(item.produto.id);
      if (!produtoReal) {
        throw new ErroValidacaoPedido(`"${item.produto.nome}" não está mais disponível`);
      }
      const corReal = coresDoProduto(produtoReal).find((c) => c.cor === item.cor);
      if (!corReal || !tamanhosDisponiveisDoColor(corReal).includes(item.tamanho)) {
        throw new ErroValidacaoPedido(
          `"${produtoReal.nome}" (${item.cor}, tamanho ${item.tamanho}) está sem estoque no momento`
        );
      }
      return { item, produtoReal };
    })
  );

  const client = obterCliente();
  const preference = new Preference(client);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  // O desconto do cupom (se houver) e' revalidado aqui no servidor - nunca confia no valor
  // calculado no carrinho no navegador. A Preference API do Mercado Pago nao aceita um item
  // de "desconto" com preco negativo, entao o jeito e' aplicar o desconto proporcionalmente
  // no preco unitario de cada item (reduz todo mundo pela mesma porcentagem), o que da' no
  // mesmo total final.
  const subtotal = itensValidados.reduce((soma, { item, produtoReal }) => soma + produtoReal.preco * item.quantidade, 0);
  let fatorDesconto = 1;
  let codigoCupomAplicado: string | undefined;
  if (cupomCodigo && subtotal > 0) {
    const resultado = validarCupom(cupomCodigo, subtotal);
    if (resultado.valido) {
      fatorDesconto = (subtotal - resultado.desconto) / subtotal;
      codigoCupomAplicado = resultado.cupom.codigo;
    }
  }

  const itensPreferencia = itensValidados.map(({ item, produtoReal }) => ({
    id: produtoReal.id,
    title:
      item.cor && item.cor !== "Único"
        ? `${produtoReal.nome} (${item.cor}, ${item.tamanho})`
        : `${produtoReal.nome} (${item.tamanho})`,
    quantity: item.quantidade,
    unit_price: Math.round(produtoReal.preco * fatorDesconto * 100) / 100,
    currency_id: "BRL",
    // resolvido AGORA (nao no webhook) pra nao depender do catalogo nao ter mudado ate' o
    // pagamento ser confirmado - ver resolverProdutoIdBling em lib/produtos.ts.
    _idBling: resolverProdutoIdBling(produtoReal, item.tamanho)
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
    itens: itensValidados.map(({ item, produtoReal }, indice) => ({
      id: itensPreferencia[indice]._idBling,
      nome: `${produtoReal.nome} (${item.tamanho})`,
      qtd: item.quantidade,
      valor: itensPreferencia[indice].unit_price
    })),
    frete: frete?.preco ?? 0,
    nome: cliente.nomeCompleto.trim(),
    cpf: cliente.cpf.replace(/\D/g, ""),
    telefone: cliente.telefone,
    endereco: {
      cep: end.cep.replace(/\D/g, ""),
      rua: end.rua.trim(),
      numero: end.numero.trim(),
      complemento: end.complemento?.trim() || undefined,
      bairro: end.bairro.trim(),
      cidade: end.cidade.trim(),
      uf: end.uf.trim().toUpperCase()
    }
  };

  const resposta = await preference.create({
    body: {
      external_reference: numeroPedido,
      items: itensPreferencia.map(({ _idBling, ...item }) => item),
      metadata: {
        ...(codigoCupomAplicado ? { cupom: codigoCupomAplicado } : {}),
        pedido_json: JSON.stringify(pedidoMetadata)
      },
      payer: {
        name: cliente.nomeCompleto.trim().split(" ")[0],
        identification: { type: "CPF", number: pedidoMetadata.cpf },
        address: {
          zip_code: pedidoMetadata.endereco.cep,
          street_name: pedidoMetadata.endereco.rua,
          street_number: pedidoMetadata.endereco.numero
        }
      },
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

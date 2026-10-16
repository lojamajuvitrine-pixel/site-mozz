import { NextRequest, NextResponse } from "next/server";
import {
  criarPagamentoCartao,
  criarPagamentoPix,
  ErroValidacaoPedido,
  mensagemRecusaCartao,
  type ClienteCheckout,
  type DadosCartao,
  type FreteEscolhido,
  type ItemCarrinho
} from "@/lib/mercadopago";

// Pagamento DENTRO do site (16/10/2026) - Pix (devolve o QR Code pra mostrar na pagina) ou
// cartao (o token do cartao vem do Card Payment Brick do Mercado Pago; o numero do cartao
// nunca passa por aqui). Mesmas validacoes do criar-preferencia (ver lib/mercadopago.ts ->
// prepararPedido) e o mesmo webhook confirma o pedido depois (Bling, e-mail, etiqueta...).
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      metodo: "pix" | "cartao";
      itens: ItemCarrinho[];
      cupomCodigo?: string;
      cliente: ClienteCheckout;
      frete?: FreteEscolhido;
      creditoSolicitado?: number;
      valorEsperado?: number;
      cartao?: DadosCartao;
      sessaoDispositivo?: string;
    };

    if (body.metodo !== "pix" && body.metodo !== "cartao") {
      return NextResponse.json({ erro: "Forma de pagamento inválida" }, { status: 400 });
    }
    if (!body.itens || body.itens.length === 0) {
      return NextResponse.json({ erro: "Carrinho vazio" }, { status: 400 });
    }
    if (!body.cliente?.nomeCompleto || !body.cliente?.cpf || !body.cliente?.email || !body.cliente?.telefone) {
      return NextResponse.json({ erro: "Preencha seus dados antes de pagar" }, { status: 400 });
    }

    const numeroPedido = `MOZZ-${Date.now()}`;

    if (body.metodo === "pix") {
      const pix = await criarPagamentoPix(
        body.itens,
        numeroPedido,
        body.cliente,
        body.frete,
        body.cupomCodigo,
        body.creditoSolicitado,
        body.valorEsperado
      );
      return NextResponse.json({ numeroPedido, ...pix });
    }

    const cartao = await criarPagamentoCartao(
      body.itens,
      numeroPedido,
      body.cliente,
      body.cartao as DadosCartao,
      body.frete,
      body.cupomCodigo,
      body.creditoSolicitado,
      body.valorEsperado,
      typeof body.sessaoDispositivo === "string" ? body.sessaoDispositivo.slice(0, 200) : undefined
    );
    return NextResponse.json({
      numeroPedido,
      pagamentoId: cartao.pagamentoId,
      status: cartao.status,
      mensagem: cartao.status === "rejected" ? mensagemRecusaCartao(cartao.statusDetalhe) : null
    });
  } catch (erro) {
    if (erro instanceof ErroValidacaoPedido) {
      return NextResponse.json({ erro: erro.message }, { status: 400 });
    }
    console.error("Erro ao criar pagamento Mercado Pago:", erro);
    return NextResponse.json(
      { erro: "Não foi possível processar o pagamento agora. Tente de novo em instantes." },
      { status: 500 }
    );
  }
}

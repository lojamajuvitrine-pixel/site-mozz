import { NextRequest, NextResponse } from "next/server";
import {
  criarPreferenciaPagamento,
  ErroValidacaoPedido,
  type ClienteCheckout,
  type FreteEscolhido,
  type ItemCarrinho
} from "@/lib/mercadopago";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      itens: ItemCarrinho[];
      cupomCodigo?: string;
      cliente: ClienteCheckout;
      frete?: FreteEscolhido;
    };

    if (!body.itens || body.itens.length === 0) {
      return NextResponse.json({ erro: "Carrinho vazio" }, { status: 400 });
    }
    if (!body.cliente?.nomeCompleto || !body.cliente?.cpf) {
      return NextResponse.json({ erro: "Nome completo e CPF são obrigatórios" }, { status: 400 });
    }

    const numeroPedido = `MOZZ-${Date.now()}`;
    const preferencia = await criarPreferenciaPagamento(
      body.itens,
      numeroPedido,
      body.cliente,
      body.frete,
      body.cupomCodigo
    );

    return NextResponse.json({
      initPoint: preferencia.init_point,
      numeroPedido
    });
  } catch (erro) {
    // ErroValidacaoPedido = o pedido nao pode seguir por um motivo que a cliente precisa
    // saber (endereco incompleto, tamanho sem estoque, produto que saiu do catalogo) - mostra
    // a mensagem real. Qualquer outro erro (Mercado Pago fora do ar, bug) continua generico,
    // pra nao vazar detalhe tecnico pro cliente.
    if (erro instanceof ErroValidacaoPedido) {
      return NextResponse.json({ erro: erro.message }, { status: 400 });
    }
    console.error("Erro ao criar preferencia Mercado Pago:", erro);
    return NextResponse.json({ erro: "Nao foi possivel iniciar o pagamento" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { calcularFrete } from "@/lib/frete";
import { adicionarAoCarrinho } from "@/lib/melhorEnvio";

// ROTA TEMPORARIA DE TESTE - so' pra validar a autorizacao OAuth do Melhor Envio antes de
// ligar a compra automatica de verdade (pedido do Brunno em 31/08/2026). Faz SO' o passo que
// nao cobra nada: cotar um frete real e colocar no carrinho. Nao paga, nao gera etiqueta.
// APAGAR ESTE ARQUIVO depois que o teste passar - nao e' pra ficar em producao.
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const chave = request.nextUrl.searchParams.get("chave");
  if (chave !== "mozz-teste-carrinho") {
    return NextResponse.json({ erro: "chave ausente ou incorreta" }, { status: 401 });
  }

  const cepOrigem = process.env.MELHOR_ENVIO_CEP_ORIGEM;
  if (!cepOrigem) {
    return NextResponse.json({ erro: "MELHOR_ENVIO_CEP_ORIGEM ausente no .env" }, { status: 500 });
  }

  try {
    // Passo A: cotacao real (mesma chamada que ja funciona no site hoje) so' pra pegar um
    // servicoId numerico valido e atual - evita chutar um id fixo que pode ter mudado.
    const opcoes = await calcularFrete(cepOrigem, 1);
    const servicoId = opcoes[0]?.servicoId;
    if (!servicoId) {
      return NextResponse.json({ erro: "cotacao nao devolveu nenhum servico com id" }, { status: 502 });
    }
    const opcaoEscolhida = opcoes[0];

    // Passo B: o unico passo que estamos testando de verdade - adiciona ao carrinho do
    // Melhor Envio (OAuth), sem pagar. Cliente e endereco sao fake (dados da propria loja),
    // so' pra existir uma "ordem" de teste no carrinho.
    const resultado = await adicionarAoCarrinho({
      servicoId,
      nomeCliente: "Teste Mozz",
      cpfLimpo: "11144477735", // CPF valido (digito verificador correto), so' pra teste
      endereco: {
        cep: cepOrigem,
        rua: "Avenida Coronel Rogério Borba",
        numero: "480",
        bairro: "Centro",
        cidade: "Reserva",
        uf: "PR"
      },
      itens: [{ nome: "Produto de teste (nao e um pedido real)", quantidade: 1, valor: 10 }],
      numeroPedidoLoja: `TESTE-${Date.now()}`
    });

    return NextResponse.json({
      ok: true,
      mensagem: "Adicionado ao carrinho do Melhor Envio com sucesso - nada foi cobrado.",
      cotacaoUsada: opcaoEscolhida,
      orderId: resultado.orderId
    });
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : String(erro);
    return NextResponse.json({ ok: false, erro: mensagem }, { status: 500 });
  }
}

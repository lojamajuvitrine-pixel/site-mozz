// Envia o e-mail de confirmacao de pedido pro cliente, depois que o pagamento e' aprovado e o
// pedido e' salvo PELA PRIMEIRA VEZ (ver salvarPedidoEComprarEtiquetaSeNecessario em
// app/api/mercadopago/webhook/route.ts - so' chamado quando inseriuAgora e' true, pra nunca
// mandar em dobro se o Mercado Pago reenviar o mesmo webhook). Pedido do Brunno em 31/08/2026.
//
// Reusa a mesma conta do Resend ja' usada pelo aviso de "voltou ao estoque" (ver
// scripts/avisoEstoque.ts) - mas essa aqui roda dentro do proprio site (Vercel), entao precisa
// da RESEND_API_KEY tambem configurada la', separada do secret que ja existe no GitHub Actions.
import { formatarPreco } from "@/lib/formato";
import { PERCENTUAL_CASHBACK } from "@/lib/creditos";
import type { EnderecoCheckout } from "@/lib/mercadopago";

const REMETENTE = "MOZZ <pedidos@notificacoes.lojamozz.com.br>";
const ENDERECO_LOJA = "Avenida Coronel Rogério Borba, nº 480, Reserva, PR";

export type ItemEmailPedido = { nome: string; qtd: number; valor: number };

export async function enviarEmailConfirmacaoPedido(params: {
  emailCliente: string;
  nomeCliente: string;
  numeroPedido: string;
  itens: ItemEmailPedido[];
  subtotal: number;
  frete: number;
  valorTotal: number;
  creditoAplicado: number;
  cupomCodigo: string | undefined;
  formaEnvio: "correios" | "retirada";
  endereco: EnderecoCheckout;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || !params.emailCliente) {
    console.warn(
      "E-mail de confirmação: RESEND_API_KEY ausente ou pedido sem e-mail do cliente - pulando envio."
    );
    return;
  }

  // Mesma formula de lib/creditos.ts (concederCashback) - so' pra MOSTRAR o valor no e-mail,
  // nao concede credito nenhum aqui (isso continua acontecendo so' em concederCashback).
  const cashback = Math.round(params.valorTotal * PERCENTUAL_CASHBACK * 100) / 100;

  const linhasItens = params.itens
    .map(
      (item) =>
        `<tr><td style="padding:4px 0;">${item.qtd}x ${item.nome}</td><td style="padding:4px 0;text-align:right;">${formatarPreco(item.valor * item.qtd)}</td></tr>`
    )
    .join("");

  const enderecoCompleto = `${params.endereco.rua}, nº ${params.endereco.numero}${
    params.endereco.complemento ? `, ${params.endereco.complemento}` : ""
  }, ${params.endereco.bairro}, ${params.endereco.cidade}/${params.endereco.uf}`;

  const blocoEntrega =
    params.formaEnvio === "correios"
      ? `<p><strong>Entrega:</strong> pelos Correios, no endereço ${enderecoCompleto}. Assim que a etiqueta for gerada, você recebe outro e-mail com o código de rastreio.</p>`
      : `<p><strong>Retirada na loja:</strong> ${ENDERECO_LOJA}. Segunda a sexta, das 9h às 18h. Sábado, das 9h às 12h.</p>`;

  const html = `
    <div style="font-family:sans-serif;color:#1a1a1a;max-width:480px;">
      <p>Olá, ${params.nomeCliente.split(" ")[0]}!</p>
      <p>Seu pagamento foi aprovado e seu pedido já está confirmado.</p>
      <p style="font-weight:600;margin-bottom:4px;">Pedido ${params.numeroPedido}</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">${linhasItens}</table>
      <table style="width:100%;border-collapse:collapse;font-size:14px;margin-top:8px;border-top:1px solid #ddd;padding-top:8px;">
        <tr><td>Subtotal</td><td style="text-align:right;">${formatarPreco(params.subtotal)}</td></tr>
        <tr><td>Frete</td><td style="text-align:right;">${params.frete > 0 ? formatarPreco(params.frete) : "Grátis"}</td></tr>
        ${
          params.creditoAplicado > 0
            ? `<tr><td>Crédito usado</td><td style="text-align:right;">− ${formatarPreco(params.creditoAplicado)}</td></tr>`
            : ""
        }
        <tr style="font-weight:600;"><td>Total pago</td><td style="text-align:right;">${formatarPreco(params.valorTotal)}</td></tr>
      </table>
      ${params.cupomCodigo ? `<p style="font-size:13px;color:#666;">Cupom aplicado: ${params.cupomCodigo}</p>` : ""}
      ${blocoEntrega}
      ${
        cashback > 0
          ? `<p>Você ganhou ${formatarPreco(cashback)} de cashback nessa compra, já disponível pra usar na próxima.</p>`
          : ""
      }
      <p>Acompanhe seu pedido a qualquer momento em <a href="https://lojamozz.com.br/conta">Minha conta</a>.</p>
      <p>Qualquer dúvida, é só chamar no WhatsApp.</p>
      <p>— Time MOZZ</p>
    </div>
  `;

  try {
    const resposta = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: REMETENTE,
        to: [params.emailCliente],
        subject: `Pedido confirmado - MOZZ ${params.numeroPedido}`,
        html
      })
    });
    if (!resposta.ok) {
      const texto = await resposta.text();
      throw new Error(`Resend falhou (${resposta.status}): ${texto}`);
    }
  } catch (erro) {
    // Nunca trava o pedido por causa disso - mesma tolerancia a falha do resto do webhook (o
    // pior cenario e' a cliente nao receber o e-mail, nao e' motivo pra reprocessar o pedido).
    console.error(`Erro ao enviar e-mail de confirmação do pedido ${params.numeroPedido}:`, erro);
  }
}

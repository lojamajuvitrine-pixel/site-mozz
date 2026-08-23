"use client";

// Pagina pra onde o Mercado Pago manda o cliente quando o pagamento fica PENDENTE de
// confirmacao (back_urls.pending em lib/mercadopago.ts) - comum em boleto e alguns Pix/cartao
// em analise. O carrinho e' esvaziado porque o pedido ja foi registrado do lado do Mercado
// Pago (so' falta a confirmacao), entao nao faz sentido a pessoa comprar de novo.
// useSearchParams precisa estar dentro de <Suspense> (exigencia do Next.js pra paginas
// que leem parametros da URL), por isso a divisao em dois componentes abaixo.

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useCart } from "@/lib/cart-context";

function Conteudo() {
  const params = useSearchParams();
  const { limpar } = useCart();
  const numeroPedido = params.get("external_reference");

  useEffect(() => {
    limpar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section className="py-16 max-w-md mx-auto text-center">
      <p className="font-serif text-2xl mb-3">Pagamento em analise</p>
      <p className="text-[13px] text-mozz-gray mb-1">
        Recebemos seu pedido e estamos aguardando a confirmacao do pagamento.
      </p>
      {numeroPedido && (
        <p className="text-[13px] text-mozz-gray mb-6">Numero do pedido: {numeroPedido}</p>
      )}
      <a href="/" className="inline-block text-[13px] underline mt-4">
        Voltar para a loja
      </a>
    </section>
  );
}

export default function PaginaCheckoutPendente() {
  return (
    <Suspense fallback={null}>
      <Conteudo />
    </Suspense>
  );
}

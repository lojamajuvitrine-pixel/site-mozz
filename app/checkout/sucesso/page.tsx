"use client";

// Pagina pra onde o Mercado Pago manda o cliente depois de um pagamento APROVADO
// (back_urls.success em lib/mercadopago.ts). Ele chega aqui com parametros na URL, ex:
// ?payment_id=...&status=approved&external_reference=MOZZ-123...
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
    limpar(); // esvazia o carrinho, ja que a compra foi concluida
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section className="py-16 max-w-md mx-auto text-center">
      <p className="font-serif text-3xl mb-3">Pedido confirmado</p>
      <p className="text-[14.5px] text-mozz-gray mb-1">Seu pagamento foi aprovado.</p>
      {numeroPedido && (
        <p className="text-[14.5px] text-mozz-gray mb-6">Numero do pedido: {numeroPedido}</p>
      )}
      <a href="/" className="inline-block text-[14.5px] underline mt-4">
        Voltar para a loja
      </a>
    </section>
  );
}

export default function PaginaCheckoutSucesso() {
  return (
    <Suspense fallback={null}>
      <Conteudo />
    </Suspense>
  );
}

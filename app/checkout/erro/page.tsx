"use client";

// Pagina pra onde o Mercado Pago manda o cliente depois de um pagamento RECUSADO/cancelado
// (back_urls.failure em lib/mercadopago.ts). O carrinho e' mantido de proposito, pra pessoa
// poder tentar de novo sem montar tudo outra vez.
export const dynamic = "force-dynamic";

export default function PaginaCheckoutErro() {
  return (
    <section className="py-16 max-w-md mx-auto text-center">
      <p className="font-serif text-2xl mb-3">Pagamento nao aprovado</p>
      <p className="text-[13px] text-mozz-gray mb-6">
        Nao conseguimos confirmar seu pagamento. Seu carrinho continua salvo - voce pode
        tentar novamente ou usar outra forma de pagamento.
      </p>
      <a href="/carrinho" className="inline-block text-[13px] py-3 px-6 bg-mozz-black text-white">
        Voltar ao carrinho
      </a>
    </section>
  );
}

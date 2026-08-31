import type { Metadata } from "next";

// Pagina de formas de parcelamento - conteudo baseado no que ja aparecia (resumido) no
// rodape (ver components/Footer.tsx), agora com uma pagina propria linkada em Politicas -
// parte da reestruturacao do rodape em colunas pedida pelo Brunno em 31/08/2026, inspirada
// no rodape da Foxton.
export const metadata: Metadata = {
  title: "Formas de parcelamento",
  description: "Como pagar na MOZZ: cartão de crédito em até 3x sem juros, Pix ou boleto."
};

export default function PaginaParcelamento() {
  return (
    <section className="py-8 max-w-2xl">
      <p className="font-serif text-3xl mb-6">Formas de parcelamento</p>

      <div className="space-y-5 text-[14.5px] text-mozz-black/80 leading-relaxed">
        <div>
          <p className="text-mozz-black font-medium mb-1">Cartão de crédito</p>
          <p>Parcele em até 3x sem juros, nas bandeiras aceitas pelo Mercado Pago.</p>
        </div>

        <div>
          <p className="text-mozz-black font-medium mb-1">Pix</p>
          <p>Pagamento à vista, com confirmação normalmente imediata após o envio.</p>
        </div>

        <div>
          <p className="text-mozz-black font-medium mb-1">Boleto</p>
          <p>
            Pagamento à vista, com compensação em até 2 dias úteis — seu pedido só é confirmado
            depois que o pagamento cai.
          </p>
        </div>

        <p className="text-mozz-gray text-[13px]">
          O pagamento é processado com segurança pelo Mercado Pago. A MOZZ não tem acesso nem
          armazena os dados do seu cartão.
        </p>
      </div>
    </section>
  );
}

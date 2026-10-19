import type { Metadata } from "next";

// Pagina "Preco garantido" (pedido do Brunno em 19/10/2026): a Mozz cobre o preco do site oficial
// da marca, SO' antes do pagamento (a cliente manda o link pelo WhatsApp e o valor do pedido e'
// ajustado antes de pagar). Nao entram: cupons/codigos, outlet/liquidacao, promocao relampago/
// Black Friday, marketplaces e outros revendedores.
const NUMERO_WHATSAPP = "5542988351888";
const LINK_WHATSAPP = `https://wa.me/${NUMERO_WHATSAPP}?text=${encodeURIComponent(
  "Olá! Quero o preço garantido: achei uma peça mais barata no site oficial da marca."
)}`;

export const metadata: Metadata = {
  title: "Preço garantido",
  description: "Achou a mesma peça mais barata no site oficial da marca? A MOZZ cobre o preço, antes do pagamento."
};

export default function PaginaPrecoGarantido() {
  return (
    <section className="py-8 max-w-2xl">
      <p className="font-serif text-3xl mb-4">Preço garantido</p>
      <p className="text-[15px] text-mozz-black/80 leading-relaxed mb-8">
        Achou a mesma peça mais barata no site oficial da marca? A gente cobre.
      </p>

      <div className="space-y-6 text-[14.5px] text-mozz-black/80 leading-relaxed">
        <div>
          <p className="text-mozz-black font-medium mb-2">Como funciona</p>
          <ol className="list-decimal pl-5 space-y-1.5">
            <li>Antes de pagar, chame a gente no WhatsApp com o link da peça no site oficial da marca.</li>
            <li>Conferimos: mesma peça, mesma cor e mesmo tamanho, disponível para compra.</li>
            <li>Se o preço no site oficial for menor, ajustamos o valor do seu pedido antes do pagamento.</li>
          </ol>
        </div>

        <div>
          <p className="text-mozz-black font-medium mb-2">O que não entra</p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>Cupons e códigos de desconto.</li>
            <li>Peças de outlet e liquidação.</li>
            <li>Promoções relâmpago e Black Friday.</li>
            <li>Marketplaces e outros revendedores. Vale apenas o site oficial da própria marca.</li>
          </ul>
        </div>

        <a
          href={LINK_WHATSAPP}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block text-[14.5px] px-7 py-3 bg-mozz-black text-white"
        >
          Falar no WhatsApp
        </a>
      </div>
    </section>
  );
}

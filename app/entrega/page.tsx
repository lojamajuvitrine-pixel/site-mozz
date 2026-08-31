import type { Metadata } from "next";
import Link from "next/link";

// Pagina de formas de entrega e retirada - explica o calculo de frete por CEP (ver
// lib/frete.ts) e a opcao de retirar na loja fisica quando habilitada (ver lib/configLoja.ts
// e components/CalculoFrete.tsx). De proposito sem valores fixos de frete gratis/prazo aqui,
// porque isso e' configuravel pelo Brunno em /admin/produtos e ja aparece dinamico pro
// cliente no carrinho e na pagina do produto (ver components/AvisoFreteGratis.tsx) - repetir
// um numero fixo aqui arriscaria ficar desatualizado. Parte da reestruturacao do rodape
// pedida pelo Brunno em 31/08/2026.
export const metadata: Metadata = {
  title: "Formas de entrega",
  description: "Como funciona o frete e a retirada na loja física da MOZZ."
};

const ENDERECO_LOJA = "Avenida Coronel Rogério Borba, nº 480, Reserva, PR";
const LINK_MAPS = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ENDERECO_LOJA)}`;

export default function PaginaEntrega() {
  return (
    <section className="py-8 max-w-2xl">
      <p className="font-serif text-3xl mb-6">Formas de entrega</p>

      <div className="space-y-5 text-[14.5px] text-mozz-black/80 leading-relaxed">
        <div>
          <p className="text-mozz-black font-medium mb-1">Entrega pelo Correios</p>
          <p>
            Calculamos o frete e o prazo estimado automaticamente pelo seu CEP, direto na página
            do produto ou no carrinho, antes de fechar a compra. Enviamos pra todo o Brasil.
          </p>
        </div>

        <div>
          <p className="text-mozz-black font-medium mb-1">Frete grátis</p>
          <p>
            Quando ativo, o frete grátis a partir de um valor mínimo de compra aparece indicado
            automaticamente na página do produto e no carrinho.
          </p>
        </div>

        <div>
          <p className="text-mozz-black font-medium mb-1">Retirada na loja</p>
          <p>
            Quando essa opção estiver disponível, você pode escolher retirar seu pedido
            gratuitamente na nossa loja física, em vez de receber por entrega:
          </p>
          <a href={LINK_MAPS} target="_blank" rel="noopener noreferrer" className="underline block mt-2">
            {ENDERECO_LOJA}
          </a>
          <p className="mt-1">Segunda a sexta, das 9h às 18h. Sábado, das 9h às 12h.</p>
        </div>

        <p className="text-mozz-gray text-[13px]">
          Dúvidas sobre o prazo do seu pedido?{" "}
          <Link href="/conta" className="underline">
            Acesse Minha conta
          </Link>{" "}
          ou chama a gente no WhatsApp.
        </p>
      </div>
    </section>
  );
}

import Link from "next/link";
import { MAX_PARCELAS_PROMOCAO } from "@/lib/formato";

// Banner da Black November no topo da home, no celular e no desktop (pedido do Brunno em
// 05/11/2026, textos aprovados por ele). O "Ate X% OFF" vem do maior desconto entre as pecas da
// vitrine (calculado em app/page.tsx), entao acompanha sozinho o que estiver marcado no painel.
export default function BannerBlackNovember({ maiorDesconto }: { maiorDesconto: number }) {
  return (
    <section className="-mx-6 bg-mozz-black text-white" aria-label="Black November">
      <Link href="/black-november" className="block px-6 py-9 md:py-14 text-center">
        <p className="font-serif text-[34px] md:text-[56px] leading-none tracking-[0.12em] uppercase">
          Black November
        </p>
        <p className="mt-3 text-[16px] md:text-[20px] font-semibold">
          {maiorDesconto > 0 ? `Até ${maiorDesconto}% OFF em peças selecionadas` : "Ofertas em peças selecionadas"}
        </p>
        <p className="mt-1.5 text-[12.5px] md:text-[13.5px] text-white/75">
          {/* Pecas em promocao: sem desconto no Pix e ate 3x sem juros (09/11/2026) */}
          até {MAX_PARCELAS_PROMOCAO}x sem juros · até 30/11
        </p>
        <span className="inline-block mt-5 border border-white px-7 py-2.5 text-[12.5px] tracking-[0.2em] uppercase">
          Ver ofertas
        </span>
      </Link>
    </section>
  );
}

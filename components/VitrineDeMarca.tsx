import Link from "next/link";
import ProductCard from "@/components/ProductCard";
import type { Produto } from "@/lib/produtos";

type Props = {
  marca: string;
  slug: string;
  categoria: string;
  headline: string;
  descricao: string;
  produtos: Produto[];
};

// Bloco "vitrine por marca" pra home - carrossel horizontal de peças + texto/CTA do lado,
// inspirado no site oqvestir (print mandado pelo Brunno em 27/09/2026: 4 fotos de produto +
// um painel de texto "categoria / título / descrição / botão"). Aqui uma marca inteira faz o
// papel da "categoria" do exemplo. Usa as peças marcadas como destaque daquela marca (mesma
// escolha do Brunno pra vitrine "Novidades" da home) - se a marca ainda não tiver nenhuma
// destaque marcada no painel /admin/produtos, o bloco inteiro fica escondido (não mostra
// carrossel vazio) até ter pelo menos uma peça.
export default function VitrineDeMarca({ marca, slug, categoria, headline, descricao, produtos }: Props) {
  if (produtos.length === 0) return null;

  return (
    <section className="py-10 border-t border-black/10 grid md:grid-cols-[1fr_320px] gap-8">
      <div className="flex gap-4 overflow-x-auto pb-2 -mx-6 px-6 md:mx-0 md:px-0 snap-x snap-mandatory">
        {produtos.slice(0, 8).map((produto) => (
          <div key={produto.id} className="w-[46%] md:w-[220px] shrink-0 snap-start">
            <ProductCard produto={produto} />
          </div>
        ))}
      </div>

      <div className="flex flex-col justify-center px-1">
        <p className="text-[13px] text-mozz-gray tracking-widest uppercase mb-2">{categoria}</p>
        <p className="font-serif text-2xl mb-3">{headline}</p>
        <p className="text-[14px] text-mozz-gray mb-5">{descricao}</p>
        <Link
          href={`/marca/${slug}`}
          className="inline-block text-center bg-mozz-black text-white text-[13.5px] px-5 py-3 hover:opacity-90 transition-opacity w-fit"
        >
          Ver coleção {marca}
        </Link>
      </div>
    </section>
  );
}

import type { Produto } from "@/lib/produtos";
import { produtosRelacionados } from "@/lib/produtos";
import ProductCard from "@/components/ProductCard";

export default function ProdutosRelacionados({ produto }: { produto: Produto }) {
  const relacionados = produtosRelacionados(produto);
  if (relacionados.length === 0) return null;

  return (
    <section className="mt-14 pt-8 border-t border-black/10">
      <p className="text-[13px] text-mozz-gray mb-4">Quem viu também gostou</p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        {relacionados.map((p) => (
          <ProductCard key={p.id} produto={p} />
        ))}
      </div>
    </section>
  );
}

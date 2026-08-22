import ProductCard from "@/components/ProductCard";
import { listarPorMarca } from "@/lib/produtos";
import { notFound } from "next/navigation";

export default function PaginaMarca({ params }: { params: { slug: string } }) {
  const produtos = listarPorMarca(params.slug);

  if (produtos.length === 0) {
    notFound();
  }

  return (
    <section className="py-8">
      <p className="font-serif text-2xl mb-6 capitalize">{params.slug}</p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        {produtos.map((produto) => (
          <ProductCard key={produto.id} produto={produto} />
        ))}
      </div>
    </section>
  );
}

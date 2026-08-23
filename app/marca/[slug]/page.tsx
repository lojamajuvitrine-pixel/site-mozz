import GradeProdutos from "@/components/GradeProdutos";
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
      <GradeProdutos produtos={produtos} />
    </section>
  );
}

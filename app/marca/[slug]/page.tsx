import type { Metadata } from "next";
import GradeProdutos from "@/components/GradeProdutos";
import { listarPorMarca } from "@/lib/produtos";
import { notFound } from "next/navigation";

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const nomeMarca = params.slug.charAt(0).toUpperCase() + params.slug.slice(1);
  return {
    title: `${nomeMarca}`,
    description: `Peças da ${nomeMarca} na MOZZ - loja multimarcas com frete para todo o Brasil.`
  };
}

export default function PaginaMarca({ params }: { params: { slug: string } }) {
  const produtos = listarPorMarca(params.slug);

  if (produtos.length === 0) {
    notFound();
  }

  return (
    <section className="py-8">
      <p className="font-serif text-3xl mb-6 capitalize">{params.slug}</p>
      <GradeProdutos produtos={produtos} />
    </section>
  );
}

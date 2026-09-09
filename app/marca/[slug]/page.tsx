import type { Metadata } from "next";
import GradeProdutos from "@/components/GradeProdutos";
import { listarPorMarca } from "@/lib/produtos";
import { notFound } from "next/navigation";
import { SITE_URL as siteUrl } from "@/lib/site";

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const nomeMarca = params.slug.charAt(0).toUpperCase() + params.slug.slice(1);
  return {
    title: `${nomeMarca}`,
    description: `Peças da ${nomeMarca} na MOZZ - loja multimarcas com frete para todo o Brasil.`,
    alternates: { canonical: `${siteUrl}/marca/${params.slug}` }
  };
}

export const revalidate = 30;

export default async function PaginaMarca({ params }: { params: { slug: string } }) {
  const produtos = await listarPorMarca(params.slug);

  if (produtos.length === 0) {
    notFound();
  }

  const nomeMarca = params.slug.charAt(0).toUpperCase() + params.slug.slice(1);

  // Trilha de navegacao (Home > Marca) - mostra esse caminho direto no resultado de busca do
  // Google em vez do link cru da URL.
  const jsonLdBreadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
      { "@type": "ListItem", position: 2, name: nomeMarca, item: `${siteUrl}/marca/${params.slug}` }
    ]
  };

  return (
    <section className="py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdBreadcrumb) }} />
      <h1 className="font-serif text-3xl mb-6 capitalize">{params.slug}</h1>
      <GradeProdutos produtos={produtos} />
    </section>
  );
}

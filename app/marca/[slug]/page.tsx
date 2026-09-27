import type { Metadata } from "next";
import GradeProdutos from "@/components/GradeProdutos";
import { listarPorMarca } from "@/lib/produtos";
import { notFound } from "next/navigation";
import { SITE_URL as siteUrl } from "@/lib/site";

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  // Pega o nome da marca de um produto real (ex: "NV") em vez de so' colocar maiuscula na
  // primeira letra da URL ("nv" -> "Nv") - bug reportado pelo Brunno em 27/09/2026: a marca NV
  // e' uma sigla (as duas letras maiusculas), entao capitalizar so' a primeira letra deixava
  // "Nv" errado no titulo da pagina/aba do navegador e no cabecalho visivel.
  const produtos = await listarPorMarca(params.slug);
  const nomeMarca = produtos[0]?.marca ?? params.slug.charAt(0).toUpperCase() + params.slug.slice(1);
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

  // Mesmo motivo do generateMetadata acima: pega o nome real do produto ("NV") em vez de so'
  // capitalizar a primeira letra da URL ("Nv").
  const nomeMarca = produtos[0].marca;

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
      <h1 className="font-serif text-3xl mb-6">{nomeMarca}</h1>
      <GradeProdutos produtos={produtos} />
    </section>
  );
}

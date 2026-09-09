import type { Metadata } from "next";
import { buscarProduto, coresDoProduto } from "@/lib/produtos";
import { notFound } from "next/navigation";
import SeletorProduto from "@/components/SeletorProduto";
import DetalhesProduto from "@/components/DetalhesProduto";
import ProdutosRelacionados from "@/components/ProdutosRelacionados";
import { textoDescricao } from "@/lib/detalhesProduto";
import { SITE_URL as siteUrl } from "@/lib/site";

// generateMetadata roda no servidor por produto - e' o que faz o Google (e o preview de link
// no WhatsApp/Instagram) mostrar o nome/foto/preco certos da peca em vez do titulo generico
// do site inteiro.
export const revalidate = 30;

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const produto = await buscarProduto(params.slug);
  if (!produto) return {};

  const descricao = textoDescricao(produto).slice(0, 160);
  const imagem = produto.imagem ? [`${siteUrl}${produto.imagem}`] : undefined;
  const url = `${siteUrl}/produto/${produto.id}`;

  return {
    title: `${produto.nome} — ${produto.marca}`,
    description: descricao,
    alternates: { canonical: url },
    openGraph: {
      title: `${produto.nome} — ${produto.marca}`,
      description: descricao,
      images: imagem,
      url,
      type: "website"
    }
  };
}

export default async function PaginaProduto({ params }: { params: { slug: string } }) {
  const produto = await buscarProduto(params.slug);
  if (!produto) notFound();

  const cores = coresDoProduto(produto);
  const temEstoqueGeral = cores.some((c) => (c.tamanhosDisponiveis ?? c.tamanhos).length > 0);

  // Dado estruturado (schema.org/Product) - e' isso que permite o Google mostrar preco,
  // disponibilidade e ate' estrelas de avaliacao direto no resultado de busca (rich result),
  // em vez de so' um link azul comum. Nao inventa avaliacao/rating porque o site ainda nao
  // coleta isso de verdade.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: produto.nome,
    sku: produto.id,
    brand: { "@type": "Brand", name: produto.marca },
    description: textoDescricao(produto),
    image: produto.imagem ? `${siteUrl}${produto.imagem}` : undefined,
    offers: {
      "@type": "Offer",
      url: `${siteUrl}/produto/${produto.id}`,
      priceCurrency: "BRL",
      price: produto.preco,
      availability: temEstoqueGeral
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock"
    }
  };

  // Trilha de navegacao (Home > Marca > Nome do produto) - mostra esse caminho direto no
  // resultado de busca do Google em vez do link cru da URL. O slug da marca usa a mesma
  // conversao (toLowerCase) que o Nav.tsx ja usa pros links /marca/[slug].
  const jsonLdBreadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
      {
        "@type": "ListItem",
        position: 2,
        name: produto.marca,
        item: `${siteUrl}/marca/${produto.marca.toLowerCase()}`
      },
      { "@type": "ListItem", position: 3, name: produto.nome, item: `${siteUrl}/produto/${produto.id}` }
    ]
  };

  return (
    // pb-20 no celular: espaco pra barra fixa de compra (ver SeletorProduto.tsx) nao cobrir
    // o final da pagina (relacionados/rodape) enquanto rola
    <div className="pb-20 md:pb-0">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdBreadcrumb) }} />
      <SeletorProduto produto={produto} />
      <DetalhesProduto produto={produto} />
      <ProdutosRelacionados produto={produto} />
    </div>
  );
}

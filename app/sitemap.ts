import type { MetadataRoute } from "next";
import { listarProdutos, marcasDisponiveis } from "@/lib/produtos";

// Sitemap gerado automaticamente com TODO produto do catalogo - e' o que ajuda o Google a
// achar e indexar cada peca (em vez de depender so' de seguir link por link a partir da
// home). Fica disponivel em /sitemap.xml sozinho, o Next.js cuida do resto.
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://site-mozz.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  const produtos = listarProdutos();
  const marcas = marcasDisponiveis();

  const paginasEstaticas: MetadataRoute.Sitemap = [
    { url: siteUrl, changeFrequency: "daily", priority: 1 },
    { url: `${siteUrl}/produtos`, changeFrequency: "daily", priority: 0.9 }
  ];

  const paginasMarca: MetadataRoute.Sitemap = marcas.map((marca) => ({
    url: `${siteUrl}/marca/${marca.toLowerCase()}`,
    changeFrequency: "daily",
    priority: 0.7
  }));

  const paginasProduto: MetadataRoute.Sitemap = produtos.map((produto) => ({
    url: `${siteUrl}/produto/${produto.id}`,
    changeFrequency: "weekly",
    priority: 0.6
  }));

  return [...paginasEstaticas, ...paginasMarca, ...paginasProduto];
}

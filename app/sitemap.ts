import type { MetadataRoute } from "next";
import { listarProdutos, marcasDisponiveis } from "@/lib/produtos";
import { SITE_URL as siteUrl } from "@/lib/site";

// Sitemap gerado automaticamente com TODO produto do catalogo - e' o que ajuda o Google a
// achar e indexar cada peca (em vez de depender so' de seguir link por link a partir da
// home). Fica disponivel em /sitemap.xml sozinho, o Next.js cuida do resto.

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [produtos, marcas] = await Promise.all([listarProdutos(), marcasDisponiveis()]);

  const paginasEstaticas: MetadataRoute.Sitemap = [
    { url: siteUrl, changeFrequency: "daily", priority: 1 },
    { url: `${siteUrl}/produtos`, changeFrequency: "daily", priority: 0.9 },
    { url: `${siteUrl}/outlet`, changeFrequency: "daily", priority: 0.7 },
    { url: `${siteUrl}/trocas`, changeFrequency: "monthly", priority: 0.3 }
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

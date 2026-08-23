// URL publica do site - usada em metadata (SEO), sitemap.xml, robots.txt e no JSON-LD da
// pagina de produto. Blindada contra a variavel de ambiente NEXT_PUBLIC_SITE_URL vir
// ausente, vazia ou sem o "https://" na Vercel: `new URL()` com um valor invalido lanca uma
// excecao direto no carregamento do modulo, o que derruba TODA pagina do site (foi
// exatamente a causa do "Failed to collect page data for /_not-found" quebrando o build em
// 23/08/2026 - o metadataBase do layout raiz usava new URL() sem essa protecao).
function normalizarUrl(valor: string | undefined): string {
  const padrao = "https://site-mozz.vercel.app";
  if (!valor) return padrao;
  try {
    return new URL(valor).origin;
  } catch {
    return padrao;
  }
}

export const SITE_URL = normalizarUrl(process.env.NEXT_PUBLIC_SITE_URL);

// Configuracoes "so' do site" por produto - preco especial, destaque (aparece priorizado na
// vitrine da home), outlet (aparece na aba /outlet) e a tabela de medidas real da peca - tudo
// isso vive numa tabela a parte no Supabase (produtos_site), sem nunca mexer no cadastro do
// Bling. E' o que alimenta o painel administrativo em /admin/produtos (ver
// app/admin/produtos/page.tsx).
import { clientePublico } from "@/lib/supabase/publico";
import { SUPABASE_CONFIGURADO } from "@/lib/supabase/config";
import type { TabelaMedidas } from "@/lib/detalhesProduto";

export type ConfigProduto = {
  precoEspecial: number | null;
  destaque: boolean;
  outlet: boolean;
  medidasCustomizadas: TabelaMedidas | null;
  composicaoCustomizada: string | null;
  // false = peca desativada manualmente no painel /admin/produtos - some do catalogo publico
  // mesmo tendo estoque/foto no Bling, ate' alguem reativar (pedido do Brunno em 29/08/2026,
  // pra poder tirar uma peca do ar sem precisar mexer em nada no Bling - ex: peca com defeito,
  // fora de linha, ou que ele quer segurar a venda por um tempo).
  ativo: boolean;
  // Escolha manual de qual foto vem PRIMEIRO no carrossel de cada cor (painel
  // /admin/produtos, pedido do Brunno em 26/09/2026 - ex: sempre a foto de corpo inteiro da
  // modelo na frente das fotos de detalhe). Mapa "nome da cor" -> caminho da imagem escolhida
  // (o mesmo caminho que ja aparece em cor.imagens, ex: "/produtos/123--preto--2.jpg"). So'
  // reordena - nunca remove foto nenhuma. Cor sem entrada aqui continua na ordem normal que
  // vem do Bling. Aplicado em lib/produtos.ts (aplicarCapaPorCor).
  capaPorCor: Record<string, string> | null;
};

type LinhaProdutoSite = {
  produto_id: string;
  preco_especial: number | null;
  destaque: boolean;
  outlet: boolean;
  medidas_customizadas?: unknown;
  composicao_customizada?: string | null;
  ativo?: boolean;
  capa_por_cor?: unknown;
};

// Confere que o jsonb salvo e' mesmo um mapa "cor -> caminho de imagem" antes de usar -
// protege contra linha antiga (coluna ainda nao existia), null, array, ou qualquer coisa fora
// do formato esperado. Se nao bater (ou vier vazio), trata como "sem escolha nenhuma" (usa a
// ordem normal do Bling) em vez de quebrar a pagina do produto.
function validarCapaPorCor(valor: unknown): Record<string, string> | null {
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) return null;
  const entradas = Object.entries(valor as Record<string, unknown>).filter(
    (par): par is [string, string] =>
      typeof par[0] === "string" && par[0].trim() !== "" && typeof par[1] === "string" && par[1].trim() !== ""
  );
  return entradas.length > 0 ? Object.fromEntries(entradas) : null;
}

// Confere que o jsonb salvo tem mesmo a cara de uma TabelaMedidas antes de usar - protege
// contra linha antiga (coluna ainda nao existia), null, ou qualquer coisa fora do formato
// esperado. Se nao bater, trata como "sem tabela customizada" (volta pra generica da
// categoria) em vez de quebrar a pagina do produto.
function validarTabelaMedidas(valor: unknown): TabelaMedidas | null {
  if (!valor || typeof valor !== "object") return null;
  const v = valor as { colunas?: unknown; linhas?: unknown };
  const colunas = v.colunas;
  const linhas = v.linhas;
  if (!Array.isArray(colunas) || colunas.length === 0 || !colunas.every((c) => typeof c === "string")) {
    return null;
  }
  if (!Array.isArray(linhas) || linhas.length === 0) return null;
  const totalColunas = colunas.length;
  const linhasValidas = linhas.every(
    (linha) => Array.isArray(linha) && linha.length === totalColunas && linha.every((x) => typeof x === "string")
  );
  if (!linhasValidas) return null;
  return { colunas: colunas as string[], linhas: linhas as string[][] };
}

export async function buscarConfigProdutos(): Promise<Map<string, ConfigProduto>> {
  if (!SUPABASE_CONFIGURADO) return new Map();
  try {
    const supabase = clientePublico();
    const { data, error } = await supabase
      .from("produtos_site")
      .select(
        "produto_id, preco_especial, destaque, outlet, medidas_customizadas, composicao_customizada, ativo, capa_por_cor"
      );
    if (error || !data) return new Map();

    return new Map(
      (data as LinhaProdutoSite[]).map((linha) => [
        String(linha.produto_id),
        {
          precoEspecial: linha.preco_especial !== null ? Number(linha.preco_especial) : null,
          destaque: !!linha.destaque,
          outlet: !!linha.outlet,
          medidasCustomizadas: validarTabelaMedidas(linha.medidas_customizadas),
          composicaoCustomizada: linha.composicao_customizada?.trim() || null,
          // so' false quando explicitamente desativado - linha antiga sem essa coluna, ou
          // qualquer valor que nao seja exatamente false, conta como ativa.
          ativo: linha.ativo !== false,
          capaPorCor: validarCapaPorCor(linha.capa_por_cor)
        }
      ])
    );
  } catch {
    return new Map();
  }
}

// Configuracoes "so' do site" por produto - preco especial, destaque (aparece priorizado na
// vitrine da home) e outlet (aparece na aba /outlet) - tudo isso vive numa tabela a parte no
// Supabase (produtos_site), sem nunca mexer no cadastro do Bling. E' o que alimenta o painel
// administrativo em /admin/produtos (ver app/admin/produtos/page.tsx).
import { clientePublico } from "@/lib/supabase/publico";
import { SUPABASE_CONFIGURADO } from "@/lib/supabase/config";

export type ConfigProduto = {
  precoEspecial: number | null;
  destaque: boolean;
  outlet: boolean;
};

type LinhaProdutoSite = {
  produto_id: string;
  preco_especial: number | null;
  destaque: boolean;
  outlet: boolean;
};

// Le a tabela inteira com um cliente PUBLICO (sem sessao) - a leitura precisa acontecer pra
// TODO visitante do site, logado ou nao (a tabela tem RLS liberando SELECT geral, so' a
// escrita fica restrita ao e-mail admin - ver lib/admin.ts e a policy no Supabase). Tabela
// pequena (uma linha por produto com alguma config especial, nunca o catalogo inteiro), da'
// pra trazer tudo de uma vez em vez de consultar produto por produto.
export async function buscarConfigProdutos(): Promise<Map<string, ConfigProduto>> {
  if (!SUPABASE_CONFIGURADO) return new Map();
  try {
    const supabase = clientePublico();
    const { data, error } = await supabase
      .from("produtos_site")
      .select("produto_id, preco_especial, destaque, outlet");
    if (error || !data) return new Map();

    return new Map(
      (data as LinhaProdutoSite[]).map((linha) => [
        String(linha.produto_id),
        {
          precoEspecial: linha.preco_especial !== null ? Number(linha.preco_especial) : null,
          destaque: !!linha.destaque,
          outlet: !!linha.outlet
        }
      ])
    );
  } catch {
    // Supabase fora do ar ou tabela ainda nao criada - o site nunca pode quebrar por causa
    // disso, so' deixa de aplicar as configs especiais nesse ciclo (volta ao padrao do Bling).
    return new Map();
  }
}

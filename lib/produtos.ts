import produtosData from "@/data/produtos.json";

export type Produto = {
  id: string;
  nome: string;
  marca: string;
  preco: number;
  novo: boolean;
  descricao: string;
  tamanhos: string[];
  // caminho local dentro de public/produtos/ (ex: "/produtos/123.jpg"), baixado durante o
  // sync - NAO e' a URL do Bling, que expira em minutos. null quando o produto nao tem foto
  // cadastrada no Bling.
  imagem: string | null;
  // presente so' em produtos vindos do sync real do Bling (scripts/sync-bling.ts) - indica
  // se ALGUM tamanho tem saldo em estoque. Produtos do seed manual nao tem esse campo.
  temEstoque?: boolean;
};

// Fonte de dados hoje: data/produtos.json (seed manual, so' pra desenvolvimento).
// Em producao, npm run sync:bling sobrescreve esse arquivo com o catalogo real do Bling.
//
// Produtos com temEstoque === false (confirmado sem saldo em nenhum tamanho, campo so'
// existe em produtos vindos do sync real) ficam FORA do catalogo publico - decisao do
// Brunno em 22/08/2026, pra nao mostrar peca que o cliente nao consegue comprar. Produtos
// do seed manual (sem esse campo, undefined) continuam aparecendo normalmente.
export function listarProdutos(): Produto[] {
  return (produtosData as Produto[]).filter((p) => p.temEstoque !== false);
}

export function listarPorMarca(marca: string): Produto[] {
  return listarProdutos().filter(
    (p) => p.marca.toLowerCase() === marca.toLowerCase()
  );
}

export function buscarProduto(id: string): Produto | undefined {
  return listarProdutos().find((p) => p.id === id);
}

export function marcasDisponiveis(): string[] {
  return Array.from(new Set(listarProdutos().map((p) => p.marca)));
}

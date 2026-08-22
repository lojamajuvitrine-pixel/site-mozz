import produtosData from "@/data/produtos.json";

export type Produto = {
  id: string;
  nome: string;
  marca: string;
  preco: number;
  novo: boolean;
  descricao: string;
  tamanhos: string[];
  imagem: string | null;
};

// Fonte de dados hoje: data/produtos.json (seed manual, so' pra desenvolvimento).
// Em producao, npm run sync:bling sobrescreve esse arquivo com o catalogo real do Bling.
export function listarProdutos(): Produto[] {
  return produtosData as Produto[];
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

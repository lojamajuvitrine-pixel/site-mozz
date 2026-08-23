import produtosData from "@/data/produtos.json";
import { categoriaDoProduto } from "@/lib/detalhesProduto";

// Uma variacao de COR do produto - cada cor tem suas proprias fotos (pode ser mais de uma,
// quando cadastradas no Bling) e sua propria lista de tamanhos disponiveis.
export type VarianteCor = {
  cor: string;
  // caminhos locais dentro de public/produtos/ (ex: "/produtos/123--branco--0.jpg"),
  // baixados durante o sync - NAO e' a URL do Bling, que expira. Array vazio quando essa
  // cor nao tem foto cadastrada no Bling.
  imagens: string[];
  tamanhos: string[];
};

export type Produto = {
  id: string;
  nome: string;
  marca: string;
  preco: number;
  novo: boolean;
  descricao: string;
  // extraida (quando possivel) da propria descricao do Bling durante o sync - ver
  // lib/detalhesProduto.ts pra como isso e' usado (com fallback quando ausente).
  composicao?: string;
  // opcional por compatibilidade com data/produtos.json de um sync antigo (antes do suporte
  // a cor) - o codigo que le isso sempre trata ausencia/vazio com um fallback pra "Unico".
  cores?: VarianteCor[];
  // foto de capa pra vitrine/card (normalmente a foto da primeira cor que tiver foto) -
  // continua existindo pra nao precisar mexer no ProductCard.
  imagem: string | null;
  // presente so' em produtos vindos do sync real do Bling (scripts/sync-bling.ts) - indica
  // se ALGUM tamanho/cor tem saldo em estoque. Produtos do seed manual nao tem esse campo.
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

// So' os produtos que tem foto - usado nas vitrines de destaque (home) pra nao mostrar o
// placeholder "foto do produto" logo na entrada do site. O catalogo completo (/produtos)
// continua mostrando todo mundo, com ou sem foto.
export function produtosComFoto(): Produto[] {
  return listarProdutos().filter((p) => !!p.imagem);
}

// Sempre usar isso (em vez de produto.cores direto) pra ler as cores de um produto - cobre
// o caso de dado antigo (sync anterior ao suporte a cor) devolvendo um "Unico" de fallback
// com a foto/tamanhos que ja existiam antes.
// "Quem viu tambem gostou" - produtos da mesma categoria de peca (blusa, calca, vestido...)
// e prioriza a mesma marca primeiro, com foto, excluindo o produto atual. Categoria e'
// inferida pelo nome (ver lib/detalhesProduto.ts) ja que o Bling nao devolve categoria
// utilizavel sem chamada extra por produto.
export function produtosRelacionados(produto: Produto, quantidade = 8): Produto[] {
  const categoriaAtual = categoriaDoProduto(produto.nome);
  const candidatos = listarProdutos().filter((p) => p.id !== produto.id && !!p.imagem);

  const mesmaCategoria = candidatos.filter((p) => categoriaDoProduto(p.nome) === categoriaAtual);
  const mesmaMarcaPrimeiro = [
    ...mesmaCategoria.filter((p) => p.marca === produto.marca),
    ...mesmaCategoria.filter((p) => p.marca !== produto.marca)
  ];

  if (mesmaMarcaPrimeiro.length >= quantidade) return mesmaMarcaPrimeiro.slice(0, quantidade);

  // nao teve o suficiente na mesma categoria - completa com outros produtos da mesma marca
  const jaEscolhidos = new Set(mesmaMarcaPrimeiro.map((p) => p.id));
  const complemento = candidatos.filter((p) => p.marca === produto.marca && !jaEscolhidos.has(p.id));
  return [...mesmaMarcaPrimeiro, ...complemento].slice(0, quantidade);
}

export function coresDoProduto(produto: Produto): VarianteCor[] {
  if (produto.cores && produto.cores.length > 0) return produto.cores;
  const legado = produto as unknown as { tamanhos?: string[] };
  return [
    {
      cor: "Único",
      imagens: produto.imagem ? [produto.imagem] : [],
      tamanhos: legado.tamanhos && legado.tamanhos.length > 0 ? legado.tamanhos : ["Único"]
    }
  ];
}

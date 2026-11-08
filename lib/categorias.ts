import { tipoDoProduto } from "@/lib/detalhesProduto";
import { coresDoProduto, tamanhosDisponiveisDoColor, type Produto } from "@/lib/produtos";

// Categorias de peca no PLURAL, como aparecem no menu do topo e no filtro da vitrine (pacote 2,
// aprovado pelo Brunno em 07/11/2026). Parte do tipo que tipoDoProduto (lib/detalhesProduto.ts)
// tira do nome da peca - "Macaquinho" e "Macacão" viram uma categoria so', "Macacões".
const PLURAL_POR_TIPO: Record<string, string> = {
  Macaquinho: "Macacões",
  Macacão: "Macacões",
  Vestido: "Vestidos",
  Top: "Tops",
  Chemise: "Chemises",
  Kaftan: "Kaftans",
  Saia: "Saias",
  Bermuda: "Bermudas",
  Short: "Shorts",
  Calça: "Calças",
  Legging: "Leggings",
  Jaqueta: "Jaquetas",
  Casaco: "Casacos",
  Blazer: "Blazers",
  Cardigan: "Cardigans",
  Moletom: "Moletons",
  Suéter: "Suéteres",
  Colete: "Coletes",
  Polo: "Polos",
  Camiseta: "Camisetas",
  Camisa: "Camisas",
  Cueca: "Cuecas",
  Blusa: "Blusas",
  Regata: "Regatas",
  Body: "Bodies",
  Conjunto: "Conjuntos",
  Biquíni: "Biquínis",
  Maiô: "Maiôs",
  Sandália: "Sandálias",
  Tênis: "Tênis",
  Sapato: "Sapatos",
  Bota: "Botas",
  Cinto: "Cintos",
  Bolsa: "Bolsas",
  Óculos: "Óculos",
  Lenço: "Lenços",
  Chapéu: "Chapéus",
  Boina: "Boinas",
  Carteira: "Carteiras",
  Tricô: "Tricôs"
};

// Peca que nao se encaixa em nenhum tipo conhecido - aparece no filtro (pra nenhuma peca ficar
// impossivel de achar), mas nao no menu do topo.
export const CATEGORIA_OUTRAS = "Outras peças";

export function categoriaDoProduto(produto: Pick<Produto, "nome">): string {
  const tipo = tipoDoProduto(produto.nome);
  if (tipo === "Outros") return CATEGORIA_OUTRAS;
  return PLURAL_POR_TIPO[tipo] ?? tipo;
}

function temEstoque(produto: Produto): boolean {
  return coresDoProduto(produto).some((cor) => tamanhosDisponiveisDoColor(cor).length > 0);
}

// Categorias com pelo menos uma peca em estoque, em ordem alfabetica - usado no painel do menu
// (Feminino / Masculino). "Outras peças" fica de fora do menu.
export function categoriasComEstoque(produtos: Produto[]): string[] {
  const conjunto = new Set<string>();
  for (const produto of produtos) {
    if (!temEstoque(produto)) continue;
    const categoria = categoriaDoProduto(produto);
    if (categoria !== CATEGORIA_OUTRAS) conjunto.add(categoria);
  }
  return Array.from(conjunto).sort((a, b) => a.localeCompare(b, "pt-BR"));
}

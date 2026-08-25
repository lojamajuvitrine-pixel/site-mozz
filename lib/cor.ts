// Mapa best-effort de nome de cor (como cadastrado no Bling, em portugues, texto livre, ex:
// "Azul Marinho", "Verde Militar Escuro") pra uma cor aproximada de bolinha - so' decoracao,
// o nome por extenso sempre aparece do lado, entao nunca fica ambiguo mesmo se a bolinha nao
// for exata. Comparacao e' por "contem a palavra-chave" (nao precisa bater o nome inteiro) e
// ignora acento/maiusculas, pra pegar variacoes tipo "Azul Royal" ou "Verde Oliva". Ordem
// importa: combinacoes mais especificas ficam antes das genericas, pra "Azul Marinho" nao cair
// generico em "azul" antes de checar a combinacao certa.
//
// Usado tanto na pagina do produto (SeletorProduto.tsx) quanto no card do mosaico
// (ProductCard.tsx) - por isso mora aqui em vez de duplicado nos dois.
// Portugues tem concordancia de genero no adjetivo de cor (a peca e' "Camiseta PRETA" mas
// "Vestido PRETO") - o Bling as vezes cadastra a forma feminina. Sem essas variantes, "Preta"
// nao batia com a chave "preto" (o .includes exige a palavra inteira) e caia no cinza generico
// do fallback - bug reportado pelo Brunno em 24/08/2026 (bolinha "khaki" pra uma peca preta).
const CORES_APROX: Array<[string, string]> = [
  ["off white", "#f5f0e6"],
  ["branco", "#ffffff"],
  ["branca", "#ffffff"],
  ["preto", "#111111"],
  ["preta", "#111111"],
  ["cinza mescla", "#9a9994"],
  ["cinza chumbo", "#4a4a48"],
  ["cinza", "#8a8a86"],
  ["azul marinho", "#1c2b4a"],
  ["azul royal", "#1f4fa3"],
  ["azul serenity", "#7d9fc9"],
  ["azul petroleo", "#1f4a4a"],
  ["azul bic", "#2f6fb0"],
  ["azul claro", "#7d9fc9"],
  ["azul", "#2f4a7a"],
  ["indigo", "#35406b"],
  ["jeans", "#4a6a8a"],
  ["denim", "#4a6a8a"],
  ["verde militar", "#4b5320"],
  ["verde oliva", "#556b2f"],
  ["verde musgo", "#4a5a3a"],
  ["verde bandeira", "#2e6b3e"],
  ["verde claro", "#8bb06a"],
  ["verde", "#3d5c34"],
  ["vermelho", "#a02020"],
  ["vermelha", "#a02020"],
  ["bordo", "#5c1f2a"],
  ["vinho", "#5c1f2a"],
  ["amarelo", "#d8b84a"],
  ["amarela", "#d8b84a"],
  ["mostarda", "#b8862f"],
  ["rosa claro", "#e6b8c4"],
  ["rosa bebe", "#e9c3d0"],
  ["rosa", "#d99aa8"],
  ["pink", "#c94f82"],
  ["lilas", "#b9a3d6"],
  ["lavanda", "#b9a3d6"],
  ["roxo", "#5c4478"],
  ["roxa", "#5c4478"],
  ["bege", "#d8c9ae"],
  ["nude", "#c9a988"],
  ["chocolate", "#4a2f1f"],
  ["marrom", "#5c4230"],
  ["caramelo", "#a9682f"],
  ["camel", "#b08355"],
  ["terracota", "#b0562f"],
  ["ferrugem", "#8a4426"],
  ["laranja", "#c9702f"],
  ["areia", "#c9b892"],
  ["dourado", "#b8963f"],
  ["dourada", "#b8963f"],
  ["prata", "#b7b7b2"]
];

// Agrupa os nomes de cor (texto livre do Bling, ex: "Azul Marinho", "Azul Royal", "Verde
// Oliva"...) em FAMILIAS amplas ("Azul", "Verde"...) pra usar no filtro de cor do catalogo -
// filtrar por "Azul" e' o que o cliente espera, nao precisar saber que a peca que ele quer
// esta' cadastrada como "Azul Petroleo" especificamente. Ordem nao importa aqui (diferente de
// CORES_APROX acima) porque so' precisamos da familia, nao da cor exata.
const FAMILIAS_COR: Array<[string, string]> = [
  ["branco", "Branco"],
  ["branca", "Branco"],
  ["off white", "Branco"],
  ["preto", "Preto"],
  ["preta", "Preto"],
  ["cinza", "Cinza"],
  ["azul", "Azul"],
  ["indigo", "Azul"],
  ["jeans", "Azul"],
  ["denim", "Azul"],
  ["verde", "Verde"],
  ["vermelho", "Vermelho"],
  ["vermelha", "Vermelho"],
  ["rosa", "Rosa"],
  ["pink", "Rosa"],
  ["lilas", "Roxo"],
  ["lavanda", "Roxo"],
  ["roxo", "Roxo"],
  ["roxa", "Roxo"],
  ["amarelo", "Amarelo"],
  ["amarela", "Amarelo"],
  ["mostarda", "Amarelo"],
  ["bege", "Bege"],
  ["nude", "Bege"],
  ["areia", "Bege"],
  ["chocolate", "Marrom"],
  ["marrom", "Marrom"],
  ["caramelo", "Marrom"],
  ["camel", "Marrom"],
  ["terracota", "Marrom"],
  ["ferrugem", "Marrom"],
  ["bordo", "Vinho"],
  ["vinho", "Vinho"],
  ["laranja", "Laranja"],
  ["dourado", "Dourado/Prata"],
  ["prata", "Dourado/Prata"]
];

export function familiaDaCor(nomeCor: string): string {
  const normalizado = normalizarTexto(nomeCor);
  const encontrada = FAMILIAS_COR.find(([chave]) => normalizado.includes(chave));
  return encontrada?.[1] ?? "Outras";
}

export function normalizarTexto(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(new RegExp("[\\u0300-\\u036f]", "g"), "")
    .toLowerCase()
    .trim();
}

export function corAproximada(nomeCor: string): string {
  const normalizado = normalizarTexto(nomeCor);
  const encontrada = CORES_APROX.find(([chave]) => normalizado.includes(chave));
  return encontrada?.[1] ?? "#c7c6c0";
}

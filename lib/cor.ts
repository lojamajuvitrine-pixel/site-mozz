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
const CORES_APROX: Array<[string, string]> = [
  ["off white", "#f5f0e6"],
  ["branco", "#ffffff"],
  ["preto", "#111111"],
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
  ["bordo", "#5c1f2a"],
  ["vinho", "#5c1f2a"],
  ["amarelo", "#d8b84a"],
  ["mostarda", "#b8862f"],
  ["rosa claro", "#e6b8c4"],
  ["rosa bebe", "#e9c3d0"],
  ["rosa", "#d99aa8"],
  ["pink", "#c94f82"],
  ["lilas", "#b9a3d6"],
  ["lavanda", "#b9a3d6"],
  ["roxo", "#5c4478"],
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
  ["prata", "#b7b7b2"]
];

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

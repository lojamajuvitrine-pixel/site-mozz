// Helpers de parsing do formato do Bling, compartilhados entre o sync completo
// (scripts/sync-bling.ts) e o sync rapido de estoque (scripts/sync-estoque.ts) - ficam aqui
// pra garantir que os dois calculam disponibilidade por tamanho exatamente da mesma forma.

export function extrairTamanho(nome: string): string | null {
  const m = nome.match(/Tamanho:\s*([^;]+)/i);
  return m ? m[1].trim() : null;
}

export function extrairCor(nome: string): string | null {
  const m = nome.match(/Cor:\s*([^;]+)/i);
  return m ? m[1].trim() : null;
}

// Codigo de colecao que o Bling deixa colado no nome (ex: "INV26" = Inverno/26, "VER26" =
// Verao/26) - faz sentido como organizacao interna, mas fica com cara de erro de digitacao pro
// cliente na vitrine (ainda mais depois que a home passou a falar "Primavera 26" - ver banner
// da home). Removido aqui, na leitura, sem precisar mexer no cadastro no Bling - pedido do
// Brunno em 24/08/2026.
const CODIGO_COLECAO = /\s*\b(INV|VER|PRIM|OUT)\d{2}\b\s*/i;

export function limparNomeBase(nome: string): string {
  return nome
    .replace(/\s*Cor:[^;]+;?/i, "")
    .replace(/\s*Tamanho:[^;]+;?/i, "")
    .replace(CODIGO_COLECAO, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// Tamanhos "letra" reconhecidos no final do NOME DO PRODUTO (diferente de extrairTamanho
// acima, que le "Tamanho:Y" dentro do nome de um SKU/variacao) - ver comentario completo em
// extrairTamanhoDoNomeProduto logo abaixo.
const TAMANHOS_LETRA = new Set(["PP", "P", "M", "G", "GG", "XG", "XGG", "XXG", "U"]);

// Decisao do Brunno em 24/08/2026: algumas pecas (sobretudo Animale) sao cadastradas no Bling
// como um PRODUTO INTEIRO SEPARADO por tamanho - ex: "Mini Saia De Lã Com Cós Marrom Rum - 36"
// e "Mini Saia De Lã Com Cós Marrom Rum - 40" viram dois produtos-pai DISTINTOS no Bling (cada
// um com seu proprio id/estoque/preco), em vez de usar variacao de tamanho dentro de UM
// produto so'. O site nao mexe em nada disso no Bling - em vez disso, o sync (ver
// scripts/sync-bling.ts) RECONHECE esse padrao pelo nome e funde os produtos numa peca so',
// com os tamanhos como opcoes de verdade.
//
// Essa funcao so' reconhece o padrao (nao decide se funde ou nao - isso e' responsabilidade
// de quem chama, que so' funde quando ha' MAIS DE UM produto com a mesma marca+nome-base, pra
// nao fundir por engano um nome que so' coincidentemente termina em algo parecido com
// tamanho). Reconhece dois formatos de sufixo vistos em dados reais (ex: "Blusa Tule Onca
// Suspiro Tam:GG" alem do "Mini Saia De Lã - 36" original) e, dentro de cada um:
// - numero de 2 digitos entre 30 e 56 (cobre toda numeracao BR de roupa/calcado usada hoje)
// - letra de tamanho conhecida (PP, P, M, G, GG, XG, XGG, XXG, U)
export function extrairTamanhoDoNomeProduto(nome: string): { base: string; tamanho: string } | null {
  const mTraco = nome.match(/^(.*)\s-\s*([A-Za-zÀ-ú0-9]{1,4})$/);
  const mTam = !mTraco ? nome.match(/^(.*)\s+Tam:?\s*([A-Za-zÀ-ú0-9]{1,4})$/i) : null;
  const m = mTraco ?? mTam;
  if (!m) return null;
  const base = m[1].trim();
  const tokenBruto = m[2].trim();
  const tokenMaiusculo = tokenBruto.toUpperCase();

  if (/^\d{2}$/.test(tokenBruto)) {
    const numero = Number(tokenBruto);
    return numero >= 30 && numero <= 56 ? { base, tamanho: tokenBruto } : null;
  }
  return TAMANHOS_LETRA.has(tokenMaiusculo) ? { base, tamanho: tokenMaiusculo } : null;
}

export type SkuComEstoque = { nome: string; estoque?: { saldoVirtualTotal: number } };

// Pra uma cor especifica de um produto, calcula quais tamanhos tem saldo em estoque AGORA,
// a partir da lista de SKUs (formato bruto do Bling, "Cor:X;Tamanho:Y" embutido no nome).
// Produto sem variacao de tamanho cadastrada (SKU unico) devolve ["Único"] quando tem saldo,
// ou [] quando esgotou.
export function tamanhosDisponiveisDaCor(cor: string, skusDoGrupo: SkuComEstoque[]): string[] {
  const skusDaCor = skusDoGrupo.filter((s) => (extrairCor(s.nome) ?? "Único") === cor);
  const temTamanhoVariado = skusDaCor.some((s) => !!extrairTamanho(s.nome));

  if (!temTamanhoVariado) {
    const disponivel = skusDaCor.some((s) => (s.estoque?.saldoVirtualTotal ?? 0) > 0);
    return disponivel ? ["Único"] : [];
  }

  return Array.from(
    new Set(
      skusDaCor
        .filter((s) => (s.estoque?.saldoVirtualTotal ?? 0) > 0)
        .map((s) => extrairTamanho(s.nome))
        .filter((t): t is string => !!t)
    )
  );
}

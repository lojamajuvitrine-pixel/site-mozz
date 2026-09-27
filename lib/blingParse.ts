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

// Confere se o NOME CRU (antes de qualquer limpeza) tem o codigo da colecao VER26 colado -
// usado pra marcar a peca com o selo "NOVIDADE" na vitrine (ver produto.novo em lib/produtos.ts
// e o badge em components/ProductCard.tsx). Pedido do Brunno em 27/09/2026, inspirado no selo
// que a Animale usa na loja deles. Tem que rodar em cima do nome CRU, ANTES de limparNomeBase -
// depois de limpo o codigo ja foi removido (ver CODIGO_COLECAO acima) e nao da' mais pra saber.
export function ehColecaoVer26(nomeCru: string): boolean {
  return /\bVER26\b/i.test(nomeCru);
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

// Cor+tamanho no NOME DO PRODUTO - convencao adotada pro cadastro novo da colecao VER26
// (documentado em 25/09/2026): como o Somaplace so' sincroniza produto SIMPLES (ver
// convencao-cadastro-produtos-bling-ver26.md), cada combinacao de cor+tamanho vira um
// produto-pai separado no Bling, com o nome no padrao:
//   "{Nome base} VER26 - {codigo da cor} - {tamanho}"
// Exemplos reais: "Camisa ML Linho Lumiar VER26 - 0013 - GG", "Tshirt Pima Flex Fit VER26 -
// 0001 - P", "Calça Lovani Alfa VER26 - NV439 - 32". O codigo da cor e' um numero de 3 a 6
// digitos, podendo vir com um prefixo curto de letras coladas na frente (a NV usa "NV439",
// "NV032" etc, a Foxton usa so' numero, tipo "0013" ou "32320" - ver codigos-cor-produtos.md)
// - generico de proposito, pra servir qualquer marca nova que apareca com prefixo proprio, sem
// precisar mudar essa regra nunca mais. Sem nome associado por enquanto - o site mostra o
// proprio codigo ate' existir uma tabela codigo->nome de verdade (nomeCorPorCodigo abaixo).
// So' reconhece o padrao (nao decide se funde - responsabilidade de quem chama, igual
// extrairTamanhoDoNomeProduto acima. Precisa rodar ANTES dela na fusao, ver sync-bling.ts,
// senao "- 0013 - GG" seria lido como um sufixo so' e o "- 0013" ficaria preso no nome-base).
// Bug encontrado em 26/09/2026: o limite original era so' 3-4 digitos sem prefixo de letra,
// e' por isso que "Camisa ML Linho Lumiar VER26 - 32320 - GG" (codigo de 5 digitos, Foxton) e
// "Calça Lovani Alfa VER26 - NV439 - 32" (codigo com prefixo de letra, NV) nao fundiam com as
// outras cores da mesma peca - o "- 32320"/"- NV439" caia pro nome-base em vez de virar cor, e
// cada cor virava um produto separado no site (bugs reportados pelo Brunno em 26/09/2026).
export function extrairCorTamanhoDoNomeProduto(
  nome: string
): { base: string; corCodigo: string; tamanho: string } | null {
  const m = nome.match(/^(.*)\s-\s*([A-Za-zÀ-ú]{0,3}\d{3,6})\s-\s*([A-Za-zÀ-ú0-9]{1,4})$/);
  if (!m) return null;

  const tokenBruto = m[3].trim();
  const tokenMaiusculo = tokenBruto.toUpperCase();
  let tamanho: string | null = null;
  if (/^\d{2}$/.test(tokenBruto)) {
    const numero = Number(tokenBruto);
    tamanho = numero >= 30 && numero <= 56 ? tokenBruto : null;
  } else if (TAMANHOS_LETRA.has(tokenMaiusculo)) {
    tamanho = tokenMaiusculo;
  }
  if (!tamanho) return null;

  return {
    base: limparNomeBase(m[1]),
    corCodigo: m[2].trim(),
    tamanho
  };
}

// Tabela codigo->nome de cor, por marca (fonte de verdade: doc "codigos-cor-produtos.md" no
// projeto ADM MOZZ - atualizar os dois juntos quando o Brunno mandar codigo novo). Usada por
// fundirVariantesPorCorETamanho (sync-bling.ts) pra trocar o codigo cru extraido do nome (ex:
// "0013") pelo nome real da cor (ex: "Preto") antes de salvar em data/produtos.json - e' esse
// nome que aparece pro cliente (texto "Cor: ___" e bolinha de cor em SeletorProduto.tsx, via
// corAproximada em lib/cor.ts) em vez do codigo cru. Mesmo numero pode significar cores
// diferentes em marcas diferentes, por isso a chave e' sempre marca+codigo, nunca so' codigo.
// Um codigo que ainda nao esta' aqui simplesmente nao e' trocado (nomeCorPorCodigo devolve o
// proprio codigo de volta) - nao quebra nada, so' continua mostrando o codigo cru ate' alguem
// completar a tabela.
const CODIGOS_COR_POR_MARCA: Record<string, Record<string, string>> = {
  Foxton: {
    "0001": "Branco",
    "5179": "Grafite",
    "0013": "Preto",
    "00409": "Mogno",
    "2119": "Verde Oliva",
    "0278": "Caqui",
    "1605": "Eucalipto",
    "8213": "Aveia",
    "32325": "Vermelho Outono",
    // Confirmado pelo Brunno em 27/09/2026 - antes ficava pendente (ver
    // codigos-cor-produtos.md), nao confundir com "32325" (Vermelho Outono), que e' outro codigo.
    "32320": "Azul Aurora",
    "00416": "Azul Ink",
    "0184": "Azul Marinho",
    "0830": "Verde Oliva",
    // Passados pelo Brunno em 27/09/2026.
    "00735": "Azul Mármore",
    "2216": "Caramelo"
  },
  // Tabela passada pelo Brunno em 26/09/2026 (ver codigos-cor-produtos.md). O "NV" na frente
  // do numero e' parte do proprio codigo (assim que aparece no nome do produto no Bling, ex:
  // "Calça Lovani Alfa VER26 - NV439 - 32") - diferente da Foxton, que usa so' numero.
  NV: {
    "NV010": "Preto",
    "NV020": "Branco",
    "NV030": "Off White",
    "NV463": "Cinza Forest",
    "NV742": "Verde Army",
    "NV110": "Marrom Espresso",
    "NV288": "Areia Claro",
    "NV312": "Camel Médio",
    "NV374": "Bege Dune",
    "NV415": "Marrom Toffee",
    "NV591": "Bege Toast",
    "NV954": "Bege Sugar",
    "NV961": "Bege Sálvia",
    "NV114": "Amarelo Candy",
    "NV151": "Amarelo Dijon",
    "NV204": "Rosa Gum",
    "NV255": "Azul Céu",
    "NV412": "Verde Paradise",
    "NV502": "Rosa Bubble",
    "NV617": "Roxo Violeta",
    "NV709": "Rosa Sienna",
    "NV834": "Vermelho Cabernet",
    // Códigos de multimarcas/parceiros que o Brunno passou sem o prefixo "NV" - mas o produto
    // real ("Calça Lovani Alfa VER26 - NV439 - 32") mostra que o nome no Bling usa "NV439"
    // mesmo, entao a chave aqui tambem leva o prefixo pra bater com o que sai do nome.
    "NV439": "Azul Navy",
    "NV744": "Azul Misty",
    "NV1100": "Azul Sailor",
    "NV1131": "Bege Cotton",
    "NV1186": "Azul Bay",
    "NV1189": "Bege Camel",
    "NV1219": "Bege Creme",
    "NV1262": "Bege Estonado",
    "NV032": "Cinza Mescla",
    "NV952": "Xadrez Multicolor",
    "NV067": "Marinho",
    "NV1185": "Verde Harbor",
    // Regata Dulce (reportado pelo Brunno em 26/09/2026) - o codigo real no Bling tem um zero
    // na frente ("NV089"/"NV080"), diferente do "NV89"/"NV80" que ele passou de cabeca.
    "NV089": "Preto",
    "NV080": "Branco",
    // Reportado pelo Brunno em 27/09/2026 - versao jeans (duas lavagens). Codigo do "Jeans
    // Médio" corrigido no mesmo dia: era "NV170" (digitado de cabeca, errado), o certo e'
    // "NV1070".
    "NV1070": "Jeans Médio",
    "NV880": "Jeans Escuro Vintage",
    // Reportado pelo Brunno em 27/09/2026 - NV1262 (Bege Estonado) ja' existia, so' o
    // NV1263 (Denim Estonado) era novo.
    "NV1263": "Denim Estonado",
    // Levantamento de 27/09/2026: codigos que apareciam sem traducao em produtos.json
    // (extraidos do NOME do produto, convencao VER26) - completados pelo Brunno.
    "NV329": "Multicolors",
    "NV436": "Rosa Ballet",
    "NV534": "Marrom Expresso",
    "NV594": "Rosa Sienna",
    "NV610": "Azul Denim",
    "NV978": "Bege Mescla",
    "NV1168": "Marrom Cognac",
    "NV1170": "Bege Grain",
    "NV1176": "Cinza Onix",
    "NV1182": "Vermelho Rock",
    "NV1192": "Cinza Forest",
    "NV1235": "Vermelho Cabernet"
  }
};

export function nomeCorPorCodigo(marca: string, codigo: string): string {
  return CODIGOS_COR_POR_MARCA[marca]?.[codigo] ?? codigo;
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

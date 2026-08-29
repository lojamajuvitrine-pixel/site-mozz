// Informacoes complementares da pagina do produto (composicao, como cuidar, tabela de
// medidas, categoria) que NAO existem como campo estruturado no Bling - o Bling so tem um
// campo de descricao livre (texto/HTML) por produto, sem composicao/cuidados/medidas
// separados. Por isso essas funcoes usam duas fontes:
// 1. O que a gente conseguir extrair da propria descricao do Bling (ex: se o time escreveu
//    "Composicao: 100% algodao" dentro do texto).
// 2. Um padrao generico por categoria de peca (inferida pelo NOME do produto, com a mesma
//    tecnica ja usada pra cor - ver corAproximada em SeletorProduto.tsx) quando a info
//    especifica nao existe.
//
// Os padroes genericos sao um guia de referencia (medidas/cuidados tipicos do mercado de
// moda BR) - nao sao a medida exata daquela peca especifica, porque o Bling nao guarda isso.
// Se no futuro o time passar a preencher medida/composicao real por produto (ex: num campo
// dedicado no Bling), e' so' trocar aqui pra ler o campo real em vez do padrao.
import type { Produto } from "@/lib/produtos";

function normalizarTexto(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(new RegExp("[\\u0300-\\u036f]", "g"), "")
    .toLowerCase()
    .trim();
}

// Ordem importa: combinacoes mais especificas antes de genericas.
const CATEGORIAS_POR_PALAVRA: Array<[string, string]> = [
  ["macaquinho", "macaquinho"],
  ["macacao", "macacao"],
  ["vestido", "vestido"],
  ["saia", "saia"],
  ["bermuda", "bottom"],
  ["short", "bottom"],
  ["calca", "bottom"],
  ["legging", "bottom"],
  ["jaqueta", "top"],
  ["casaco", "top"],
  ["blazer", "top"],
  ["cardigan", "top"],
  ["trico", "top"],
  ["tricot", "top"],
  ["moletom", "top"],
  ["sueter", "top"],
  ["colete", "top"],
  ["camisa", "top"],
  ["camiseta", "top"],
  ["blusa", "top"],
  ["regata", "top"],
  ["cropped", "top"],
  ["body", "top"],
  ["conjunto", "vestido"],
  ["biquini", "acessorio"],
  ["maio", "acessorio"],
  ["sandalia", "calcado"],
  ["tenis", "calcado"],
  ["sapato", "calcado"],
  ["bota", "calcado"],
  ["cinto", "acessorio"],
  ["bolsa", "acessorio"],
  ["oculos", "acessorio"],
  ["lenco", "acessorio"],
  ["chapeu", "acessorio"],
  ["boina", "acessorio"],
  ["carteira", "acessorio"]
];

export type CategoriaPeca = "top" | "bottom" | "vestido" | "macacao" | "macaquinho" | "calcado" | "acessorio" | "outro";

export function categoriaDoProduto(nomeProduto: string): CategoriaPeca {
  const normalizado = normalizarTexto(nomeProduto);
  const achada = CATEGORIAS_POR_PALAVRA.find(([chave]) => normalizado.includes(chave));
  return (achada?.[1] as CategoriaPeca) ?? "outro";
}

// Tabela de medidas em cm - referencia padrao de mercado por numeracao BR, usada quando o
// produto nao tem medida propria cadastrada (ver medidasCustomizadas em lib/produtos.ts e o
// painel /admin/produtos, onde o Brunno pode cadastrar a medida REAL de uma peca especifica -
// pedido dele em 29/08/2026, ate' entao so' existia essa tabela generica por categoria).
export type TabelaMedidas = { colunas: string[]; linhas: string[][] };

// Grade fixa de medidas por peça, preenchida direto numa tabela no painel /admin/produtos -
// pedido do Brunno em 29/08/2026: sempre essas 7 medidas (busto, cintura, cintura baixa,
// quadril, coxa total, comprimento cintura-ao-chão, comprimento do braço), com a opção de
// usar tamanho por letra (PP a GGG) ou por numeração (34 a 44).
export const SISTEMA_TAMANHO_LETRA = ["PP", "P", "M", "G", "GG", "GGG"] as const;
export const SISTEMA_TAMANHO_NUMERICO = ["34", "36", "38", "40", "42", "44"] as const;
export type SistemaTamanho = "letra" | "numerico";

export const COLUNAS_MEDIDAS = [
  "Busto (cm)",
  "Cintura (cm)",
  "Cintura baixa (cm)",
  "Quadril (cm)",
  "Coxa total (cm)",
  "Comprimento cintura ao chão (cm)",
  "Comprimento do braço (cm)"
];

// Grade vazia (só com os tamanhos preenchidos) pra' comecar a preencher do zero ao trocar de
// sistema de tamanho no painel.
export function tabelaVaziaParaSistema(sistema: SistemaTamanho): TabelaMedidas {
  const tamanhos = sistema === "letra" ? SISTEMA_TAMANHO_LETRA : SISTEMA_TAMANHO_NUMERICO;
  return {
    colunas: ["Tamanho", ...COLUNAS_MEDIDAS],
    linhas: tamanhos.map((tamanho) => [tamanho, "", "", "", "", "", "", ""])
  };
}

// Descobre qual sistema (letra ou numerico) uma tabela ja salva esta' usando, olhando o
// primeiro tamanho da primeira linha - usado pra' pre-selecionar o radio certo no painel.
export function sistemaDaTabela(tabela: TabelaMedidas | null): SistemaTamanho {
  const primeiroTamanho = tabela?.linhas[0]?.[0];
  if (primeiroTamanho && (SISTEMA_TAMANHO_NUMERICO as readonly string[]).includes(primeiroTamanho)) {
    return "numerico";
  }
  return "letra";
}

const TABELA_SUPERIOR_VESTIDO: TabelaMedidas = {
  colunas: ["Tamanho", "Busto (cm)", "Cintura (cm)", "Quadril (cm)"],
  linhas: [
    ["34", "82", "62", "90"],
    ["36", "86", "66", "94"],
    ["38", "90", "70", "98"],
    ["40", "94", "74", "102"],
    ["42", "98", "78", "106"],
    ["44", "102", "82", "110"],
    ["46", "106", "86", "114"]
  ]
};

const TABELA_INFERIOR: TabelaMedidas = {
  colunas: ["Tamanho", "Cintura (cm)", "Quadril (cm)"],
  linhas: [
    ["34", "62", "90"],
    ["36", "66", "94"],
    ["38", "70", "98"],
    ["40", "74", "102"],
    ["42", "78", "106"],
    ["44", "82", "110"],
    ["46", "86", "114"]
  ]
};

const TABELA_CALCADO: TabelaMedidas = {
  colunas: ["Numeração BR"],
  linhas: [["34"], ["35"], ["36"], ["37"], ["38"], ["39"], ["40"]]
};

// Retorna null pra categorias sem tabela de medidas relevante (acessorio, "outro").
export function tabelaDeMedidas(categoria: CategoriaPeca): TabelaMedidas | null {
  switch (categoria) {
    case "top":
    case "vestido":
    case "macacao":
    case "macaquinho":
      return TABELA_SUPERIOR_VESTIDO;
    case "bottom":
      return TABELA_INFERIOR;
    case "calcado":
      return TABELA_CALCADO;
    default:
      return null;
  }
}

// Converte uma tabela de medidas pra texto editavel numa textarea (linha de cabecalho +
// uma linha por tamanho, valores separados por virgula) - usado pra pre-preencher o campo
// no painel /admin/produtos, seja com a tabela customizada ja salva ou com a generica da
// categoria (ponto de partida pra so' trocar os numeros em vez de digitar tudo do zero).
export function tabelaParaCsv(tabela: TabelaMedidas): string {
  return [tabela.colunas.join(", "), ...tabela.linhas.map((linha) => linha.join(", "))].join("\n");
}

// Caminho inverso - le o texto digitado no painel de volta pra uma TabelaMedidas, validando
// que todas as linhas tem o mesmo numero de valores que o cabecalho (senao a tabela sai
// torta na pagina do produto). Aceita virgula ou ponto-e-virgula como separador (fica facil
// colar direto de uma planilha em pt-BR, que costuma usar ; quando o numero tem virgula
// decimal). Linhas em branco sao ignoradas. texto vazio -> sem tabela customizada (volta a
// usar a generica da categoria).
export function csvParaTabela(texto: string): { tabela: TabelaMedidas | null; erro: string | null } {
  const linhasBrutas = texto
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  if (linhasBrutas.length === 0) return { tabela: null, erro: null };
  if (linhasBrutas.length < 2) {
    return { tabela: null, erro: "Precisa de uma linha de cabeçalho e pelo menos uma linha de tamanho" };
  }

  const separador = linhasBrutas[0].includes(";") ? ";" : ",";
  const dividirLinha = (l: string) => l.split(separador).map((v) => v.trim());

  const colunas = dividirLinha(linhasBrutas[0]);
  if (colunas.length < 2) {
    return { tabela: null, erro: "O cabeçalho precisa de pelo menos 2 colunas (ex: Tamanho, Busto)" };
  }

  const linhas = linhasBrutas.slice(1).map(dividirLinha);
  const linhaComTamanhoErrado = linhas.findIndex((l) => l.length !== colunas.length);
  if (linhaComTamanhoErrado !== -1) {
    return {
      tabela: null,
      erro: `A linha "${linhasBrutas[linhaComTamanhoErrado + 1]}" tem ${linhas[linhaComTamanhoErrado].length} valor(es), mas o cabeçalho tem ${colunas.length} coluna(s)`
    };
  }

  return { tabela: { colunas, linhas }, erro: null };
}

// Instrucoes de cuidado - a primeira linha muda conforme o tecido detectado na composicao
// (quando existir), o resto e' um padrao generico e seguro pra qualquer peca de tecido.
export function instrucoesDeCuidado(composicao?: string): string[] {
  const base = [
    "Não usar alvejante ou água sanitária",
    "Secar à sombra, nunca no varal sob sol direto",
    "Não torcer a peça para escorrer água",
    "Passar a ferro em temperatura baixa a média, evitando estampas, bordados e aviamentos"
  ];

  if (!composicao) {
    return ["Lavar à mão ou em ciclo delicado, com água fria", ...base];
  }

  const c = normalizarTexto(composicao);
  if (c.includes("couro") || c.includes("suede") || c.includes("camurca")) {
    return [
      "Não lavar com água - usar produto específico para couro/camurça",
      "Guardar longe de umidade e luz solar direta",
      "Higienizar com pano seco ou escova apropriada"
    ];
  }
  if (c.includes("seda")) {
    return [
      "Preferencialmente lavagem a seco (lavanderia)",
      "Se lavar em casa: à mão, água fria, sem esfregar",
      ...base
    ];
  }
  if (c.includes("la") || c.includes("wool") || c.includes("tricot") || c.includes("trico")) {
    return [
      "Lavar à mão, água fria, sem torcer nem esfregar",
      "Secar deitada sobre uma toalha, nunca pendurada",
      ...base
    ];
  }
  if (c.includes("linho")) {
    return ["Lavar à máquina em ciclo delicado, água fria", "Passar ainda levemente úmida para facilitar", ...base];
  }
  if (c.includes("algodao") || c.includes("cotton")) {
    return ["Lavar à máquina em ciclo delicado ou à mão, água fria", ...base];
  }
  return ["Lavar à mão ou em ciclo delicado, com água fria", ...base];
}

// Composicao tipica por tipo de peca (mix de tecido mais comum do mercado de moda BR pra
// cada categoria) - usada como fallback quando o Bling nao trouxe a composicao real dessa
// peca especifica (a maioria do catalogo hoje, ja que o fornecedor raramente preenche esse
// campo). Ordem importa: combinacoes mais especificas antes de genericas.
const COMPOSICOES_TIPICAS: Array<[string, string]> = [
  ["jaqueta jeans", "98% Algodão, 2% Elastano"],
  ["jaqueta couro", "100% Poliuretano (couro ecológico)"],
  ["jaqueta", "100% Poliéster"],
  ["casaco", "70% Poliéster, 30% Lã"],
  ["moletom", "60% Algodão, 40% Poliéster"],
  ["tricot", "70% Acrílico, 30% Poliamida"],
  ["trico", "70% Acrílico, 30% Poliamida"],
  ["sueter", "70% Acrílico, 30% Poliamida"],
  ["cardigan", "70% Acrílico, 30% Poliamida"],
  ["jeans", "98% Algodão, 2% Elastano"],
  ["denim", "98% Algodão, 2% Elastano"],
  ["legging", "88% Poliamida, 12% Elastano"],
  ["camisa", "100% Algodão"],
  ["camiseta", "100% Algodão"],
  ["regata", "95% Algodão, 5% Elastano"],
  ["cropped", "95% Algodão, 5% Elastano"],
  ["body", "92% Poliamida, 8% Elastano"],
  ["blazer", "68% Poliéster, 30% Viscose, 2% Elastano"],
  ["colete", "100% Poliéster"],
  ["blusa", "97% Viscose, 3% Elastano"],
  ["vestido", "95% Viscose, 5% Elastano"],
  ["macaquinho", "95% Viscose, 5% Elastano"],
  ["macacao", "95% Viscose, 5% Elastano"],
  ["saia", "97% Poliéster, 3% Elastano"],
  ["bermuda", "98% Algodão, 2% Elastano"],
  ["short", "98% Algodão, 2% Elastano"],
  ["calca", "97% Algodão, 3% Elastano"]
];
const COMPOSICAO_PADRAO = "95% Algodão, 5% Elastano";

function composicaoTipica(nomeProduto: string): string {
  const normalizado = normalizarTexto(nomeProduto);
  const achada = COMPOSICOES_TIPICAS.find(([chave]) => normalizado.includes(chave));
  return achada?.[1] ?? COMPOSICAO_PADRAO;
}

// Composicao a mostrar na pagina, em ordem de prioridade: (1) a customizada, cadastrada a
// mao no painel /admin/produtos - a mais confiavel, ja que foi digitada de proposito pra
// aquela peca (pedido do Brunno em 29/08/2026, porque a extracao do Bling abaixo e' fragil e
// nem sempre funciona); (2) a que o Bling trouxe (extraida da descricao no sync, so' quando
// o time escreveu "Composição: ..." dentro do texto); (3) quando nenhuma das duas existe,
// a composicao tipica dessa categoria de peca (mix de tecido mais usado nesse tipo de
// produto no mercado) em vez de deixar em branco - decisao do Brunno em 23/08/2026.
export function composicaoDoProduto(produto: Produto): string {
  return produto.composicaoCustomizada?.trim() || produto.composicao?.trim() || composicaoTipica(produto.nome);
}

// Descricoes curtas por categoria pra compor o texto de fallback quando o Bling nao tem
// descricao cadastrada (a maioria do catalogo hoje).
const DESCRITOR_POR_CATEGORIA: Record<CategoriaPeca, string> = {
  top: "peça moderna, com caimento confortável e acabamento cuidadoso",
  bottom: "peça versátil, pensada pra ir do dia a dia a produções mais elaboradas",
  vestido: "peça de caimento fluido, feita pra ser a protagonista do look",
  macacao: "peça prática e cheia de atitude, num corte único",
  macaquinho: "peça prática e cheia de atitude, num corte único",
  calcado: "peça confortável e cheia de estilo, pra completar qualquer produção",
  acessorio: "peça que dá o toque final em qualquer produção",
  outro: "peça atemporal, com a identidade autoral da marca"
};

// Algumas descricoes do Bling vem com a propria palavra "Descrição" (ou "Descrição:") como
// primeira linha, cadastrada junto do texto - isso duplicava o titulo, ja que o acordeao do
// site ja mostra "Descrição" como cabecalho da secao (bug visto ao vivo em 24/08/2026).
// Removida aqui, na leitura, pra nao precisar mexer no dado bruto do Bling.
const PREFIXO_DESCRICAO_DUPLICADO = /^descri[cç][aã]o:?\s*\n?/i;

// Um numero pequeno de pecas tem esse campo preenchido so' com a composicao do tecido (ex:
// "73% Algodão 26% Poliester 1% Elastano") em vez de uma descricao de verdade - depois de
// remover o prefixo duplicado acima, o que sobra e' curto demais e so' tem % de tecido, entao
// cai no texto gerado (mesma logica de quando o campo esta' vazio).
function pareceSoComposicao(texto: string): boolean {
  return texto.length < 60 && /^\d{1,3}%\s*[A-Za-zÀ-ú]/.test(texto);
}

export function textoDescricao(produto: Produto): string {
  const bruto = produto.descricao?.trim();
  const real = bruto?.replace(PREFIXO_DESCRICAO_DUPLICADO, "").trim();
  if (real && !pareceSoComposicao(real)) return real;
  const categoria = categoriaDoProduto(produto.nome);
  const descritor = DESCRITOR_POR_CATEGORIA[categoria];
  return `${produto.nome}, da ${produto.marca} — ${descritor}.`;
}

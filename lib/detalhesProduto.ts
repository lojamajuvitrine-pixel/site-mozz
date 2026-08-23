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
// produto nao tem medida propria cadastrada.
type TabelaMedidas = { colunas: string[]; linhas: Array<[string, ...string[]]> };

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

// Composicao a mostrar na pagina - usa a do produto se o Bling trouxe (extraida da
// descricao no sync), senao mostra um aviso honesto em vez de inventar um tecido.
export function composicaoOuAviso(produto: Produto): string {
  return produto.composicao?.trim() || "Composição não informada pelo fornecedor para esta peça específica.";
}

export function textoDescricao(produto: Produto): string {
  return produto.descricao?.trim() || `${produto.nome} - ${produto.marca}.`;
}

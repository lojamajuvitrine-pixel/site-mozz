import { normalizarTexto } from "@/lib/cor";
import { nomeCorPorCodigo } from "@/lib/blingParse";

// Familias de cor do filtro da vitrine (ajuste de 08/11/2026 no pacote 2). A primeira versao
// usava so' familiaDaCor (lib/cor.ts) e quase metade das cores com estoque caia em "Outras
// cores": nomes que ela nao conhece (Marinho, Militar, Fuligem, Aveia, Magenta, Khaki...), cor
// combinada ("PRETO/BRANCO" ia so' pra Branco) e cor que no Bling ainda e' so' codigo ("07708")
// ou "Único". Agora:
//  1. reconhece muito mais nomes (lista abaixo), escolhendo a palavra que aparece PRIMEIRO no
//     nome ("Laranja Ferrugem" = Laranja, "Cinza Azulado" = Cinza);
//  2. cor com "/" entra nas duas familias ("Preto/Branco" aparece em Preto e em Branco);
//  3. se o nome da cor nao diz nada (codigo, "Único"), procura a cor no NOME DA PECA
//     ("Vestido Curto Marrom" = Marrom);
//  4. o que sobrar fica em "Outras cores".

// Codigos de cor da Animale e da Farm que ainda chegam crus do Bling (ex.: "0005"), com a cor
// confirmada no site oficial de cada marca, onde o codigo e' o final do endereco da peca
// (ex.: animale.com.br/vestido-de-couro-midi-preto-07-20-7836-0005/p = Preto). Pesquisa de
// 08/11/2026. So' alimenta o FILTRO - o nome exibido na peca continua o que vem do Bling.
const CODIGOS_COR_PESQUISADOS: Record<string, Record<string, string>> = {
  Animale: {
    "0005": "Preto",
    "0003": "Off White",
    "0022": "Cinza Escuro",
    "0105": "Jeans Médio",
    "0200": "Azul",
    "0600": "Marrom",
    "0800": "Bege Madeira",
    "1530": "Jeans Claro",
    "1531": "Jeans Escuro",
    "1802": "Caramelo",
    "5199": "Laranja Brick",
    "5457": "Branco Nata",
    "6223": "Verde Éden",
    "6260": "Amarelo Apricot",
    "6262": "Amarelo Golden",
    "07509": "Marrom Sépia",
    "07705": "Bege Pétala",
    "07707": "Marrom Azeitona",
    "07708": "Marrom Castanha",
    "07717": "Vinho Safra",
    "09253": "Verde Encanto",
    "10056": "Marrom Biscoito"
  },
  Farm: {
    "0005": "Preto",
    "0013": "Preto",
    "0101": "Jeans Claro",
    "07448": "Off White",
    "07738": "Verde Arruda",
    "07742": "Vermelho Amapola",
    "07806": "Marrom Ébano",
    "07821": "Caramelo Salgado",
    "10066": "Branco Tela",
    "42205": "Estampa Tapete de Flor"
  }
};

function traduzirCodigo(marca: string, codigo: string): string | null {
  const pesquisado = CODIGOS_COR_PESQUISADOS[marca]?.[codigo];
  if (pesquisado) return pesquisado;
  const daTabelaDoSite = nomeCorPorCodigo(marca, codigo);
  return daTabelaDoSite !== codigo ? daTabelaDoSite : null;
}

// Nome da cor para MOSTRAR a cliente (09/11/2026, pedido do Brunno): troca o codigo cru que vem
// do Bling ("0013") pelo nome pesquisado ("Preto"). E' so' exibicao - o codigo continua sendo a
// chave da cor no carrinho, no estoque e no pedido do Bling. Sem traducao conhecida, devolve
// a cor como veio.
export function nomeDaCorParaExibir(cor: string, marca = ""): string {
  const limpa = (cor || "").trim();
  if (!/^[A-Za-z]{0,3}\d{3,5}$/.test(limpa)) return cor;
  return traduzirCodigo(marca, limpa.toUpperCase()) ?? cor;
}

export const FAMILIA_OUTRAS = "Outras cores";
export const FAMILIA_ESTAMPADO = "Estampado";

// Palavra (sem acento, minuscula) -> familia. Palavra de estampa vem antes de tudo.
const PALAVRAS_ESTAMPADO = [
  "estampado",
  "estampada",
  "estampa",
  "estamp",
  "print",
  "floral",
  "florido",
  "onca",
  "listrado",
  "listrada",
  "listras",
  "listra",
  "riscas",
  "xadrez",
  "poa",
  "pois",
  "flor",
  "flores",
  "tie dye",
  "animal print",
  "multicolors",
  "multicolor",
  "multicor",
  "bicolor",
  "bandanas",
  "bandana",
  "patchwork",
  "camuflado"
];

const PALAVRAS_POR_FAMILIA: Array<[string, string[]]> = [
  ["Preto", ["preto", "preta", "black", "noir"]],
  ["Branco", ["branco", "branca", "off white", "offwhite", "gelo", "neve", "white"]],
  ["Cinza", ["cinza", "grafite", "chumbo", "fuligem", "prata velha", "concreto", "mescla", "melange"]],
  ["Bege", ["bege", "nude", "areia", "caqui", "khaki", "aveia", "creme", "sisal", "marfim", "perola", "baunilha", "cotton", "natural"]],
  ["Marrom", ["marrom", "chocolate", "mogno", "caramelo", "camelo", "camel", "terracota", "ferrugem", "cognac", "toffee", "espresso", "expresso", "cafe", "tabaco", "havana", "castanho", "cobre", "palha", "demerara"]],
  ["Azul", ["azul", "marinho", "navy", "indigo", "jeans", "denim", "klein", "anil", "turquesa", "petroleo"]],
  ["Verde", ["verde", "militar", "army", "oliva", "eucalipto", "salvia", "musgo", "esmeralda", "menta", "pistache"]],
  ["Vermelho", ["vermelho", "vermelha", "red", "cereja", "rubi"]],
  ["Vinho", ["vinho", "bordo", "bordeaux", "marsala", "cabernet", "burgundy"]],
  ["Rosa", ["rosa", "pink", "magenta", "fucsia", "pessego", "salmao", "blush"]],
  ["Roxo", ["roxo", "roxa", "lilas", "lavanda", "violeta", "uva", "berinjela", "ameixa"]],
  ["Amarelo", ["amarelo", "amarela", "mostarda", "dijon", "ouro velho", "manteiga"]],
  ["Laranja", ["laranja", "coral", "tangerina", "abobora"]],
  ["Dourado/Prata", ["dourado", "dourada", "prata", "metalizado", "metalizada"]]
];

// Palavras que no NOME DA PECA costumam ser tecido/modelo, nao cor - so' valem no nome da cor.
// ("jeans"/"denim" no nome da peca valem como Azul: e' a cor da grande maioria das pecas jeans.)
const SO_NO_NOME_DA_COR = new Set(["natural", "cotton", "palha", "mescla", "cobre", "red", "black", "white", "noir"]);

type Achado = { familia: string; posicao: number; tamanho: number };

function achar(texto: string, palavra: string): number {
  // palavra inteira: " azul " dentro de " vestido azul marinho "
  return ` ${texto} `.indexOf(` ${palavra} `);
}

function familiaNoTexto(textoNormalizado: string, ehNomeDaPeca: boolean): string | null {
  const texto = textoNormalizado.replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
  if (!texto) return null;
  for (const palavra of PALAVRAS_ESTAMPADO) if (achar(texto, palavra) >= 0) return FAMILIA_ESTAMPADO;

  let melhor: Achado | null = null;
  for (const [familia, palavras] of PALAVRAS_POR_FAMILIA) {
    for (const palavra of palavras) {
      if (ehNomeDaPeca && SO_NO_NOME_DA_COR.has(palavra)) continue;
      const posicao = achar(texto, palavra);
      if (posicao < 0) continue;
      if (!melhor || posicao < melhor.posicao || (posicao === melhor.posicao && palavra.length > melhor.tamanho)) {
        melhor = { familia, posicao, tamanho: palavra.length };
      }
    }
  }
  return melhor?.familia ?? null;
}

// Familias de uma cor da peca (normalmente 1; cor combinada "Preto/Branco" da' 2).
// Farm e Animale: cor com codigo de 5 digitos 55xxx-58xxx e' a ESTAMPA (o nome dela vem no nome
// da peca, ex.: "Vestido Longo Jardim Sereno - 58924", "Camisa Chiffon Liberty Babados" = 57560)
// - ver codigos-cor-produtos.md no projeto.
const CODIGO_ESTAMPA = /^5[5-8]\d{3}$/;

export function familiasDaCor(nomeCor: string, nomePeca: string, marca = ""): string[] {
  // Cor que e' so' codigo ("0005"): troca pelo nome pesquisado antes de tudo.
  const codigoTraduzido = /^[A-Za-z]{0,3}\d{3,5}$/.test(nomeCor.trim())
    ? traduzirCodigo(marca, nomeCor.trim().toUpperCase())
    : null;
  const normalizada = normalizarTexto(codigoTraduzido ?? nomeCor);
  const familias = new Set<string>();

  const partes = normalizada.split(/\s*\/\s*/).filter(Boolean);
  for (const parte of partes) {
    const familia = familiaNoTexto(parte, false);
    if (familia) familias.add(familia);
  }
  if (familias.size > 0) return Array.from(familias);

  // Nome da cor nao diz nada (codigo do Bling, "Único", nome desconhecido). Primeiro: codigo de
  // cor no fim do nome da peca ("Trench Couro Edith Curto - Nv089" = NV089 = Preto, pela tabela
  // de codigos de lib/blingParse.ts); depois: palavra de cor no nome da peca.
  const codigoNoNome = nomePeca.match(/-\s*([A-Za-z]{0,3}\d{3,5})\s*$/)?.[1]?.toUpperCase();
  if (codigoNoNome) {
    const nomeTraduzido = traduzirCodigo(marca, codigoNoNome);
    const familia = nomeTraduzido ? familiaNoTexto(normalizarTexto(nomeTraduzido), false) : null;
    if (familia) return [familia];
  }
  const pelaPeca = familiaNoTexto(normalizarTexto(nomePeca), true);
  if (pelaPeca) return [pelaPeca];
  const codigoDaEstampa = CODIGO_ESTAMPA.test(nomeCor.trim()) ? nomeCor.trim() : codigoNoNome ?? "";
  if (CODIGO_ESTAMPA.test(codigoDaEstampa)) return [FAMILIA_ESTAMPADO];
  return [FAMILIA_OUTRAS];
}

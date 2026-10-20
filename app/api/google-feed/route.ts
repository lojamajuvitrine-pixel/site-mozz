import { NextResponse } from "next/server";
import { listarProdutos, coresDoProduto, idVarianteProduto, type Produto } from "@/lib/produtos";
import { textoDescricao, tipoDoProduto } from "@/lib/detalhesProduto";
import { SITE_URL as siteUrl } from "@/lib/site";

// Feed de catalogo pro Google Merchant Center (Google Shopping / listagens gratuitas) - fica
// publico em /api/google-feed, sem autenticacao (o Google busca isso sozinho via "busca
// agendada"), e sem nada cadastrado na mao: reflete direto o mesmo catalogo que ja alimenta
// o site (lib/produtos.ts) e o feed irmao da Meta (app/api/meta-feed/route.ts), sync
// automatico com o Bling.
//
// Mesma decisao do feed da Meta (27/08/2026): uma linha por VARIACAO vendavel (cor+tamanho),
// nao uma linha por produto - "item_group_id" = produto.id agrupa as variacoes do mesmo
// produto, formato padrao do Google pra roupa com variacao.
//
// Arquivo separado do /api/meta-feed de proposito, mesmo com logica quase identica - pra nao
// acoplar as duas plataformas nem arriscar quebrar o feed da Meta (ja em producao) ao mexer
// nesse aqui.

export const revalidate = 300; // 5 min - alinhado com o ciclo do sync automatico de estoque

const COLUNAS = [
  "id",
  "item_group_id",
  "title",
  "description",
  "availability",
  "condition",
  "price",
  "sale_price",
  "link",
  "image_link",
  "brand",
  "gtin",
  "mpn",
  "identifier_exists",
  "gender",
  "age_group",
  "color",
  "size",
  "size_system",
  "size_type",
  "additional_image_link",
  "google_product_category",
  "product_type",
  "shipping_weight",
  "custom_label_0",
  "custom_label_1",
  "custom_label_2",
  "custom_label_3",
  "custom_label_4"
] as const;

type Coluna = (typeof COLUNAS)[number];

// Bling nao guarda genero/faixa etaria por peca - mesmo mapa por marca usado no feed da Meta
// (confirmado pelo Brunno em 27/08/2026). Farm adicionada em 28/09/2026; "Farm Beachwear" nao
// precisa de entrada propria aqui - o sync ja funde ela em "Farm" (mesma marca pro site).
const GENERO_POR_MARCA: Record<string, "female" | "male" | "unisex"> = {
  Animale: "female",
  Reserva: "male",
  Foxton: "male",
  NV: "female",
  Farm: "female"
};

// Titulo do Google (09/10/2026, aprovado pelo Brunno): "Nome da peca + Marca + Cor + Feminino/Masculino".
// So muda o titulo que vai pro Google - o nome no site, no Bling e no feed da Meta continua igual.
// Tira tamanho e codigo de cor cru do nome ("- M - 58920", "- Nv089", "Preto:44"), corrige
// grafias comuns do Bling (Calca -> Calça, Tshirt -> T-shirt, Ml -> Manga Longa), poe a cor da
// variacao (sem repetir se o nome ja tem a cor) e o genero concordando com a peca.
const PALAVRAS_MINUSCULAS = new Set(["de", "da", "do", "das", "dos", "e", "com", "em", "na", "no", "para"]);
const CORRECOES_NOME: Record<string, string> = {
  calca: "Calça",
  basica: "Básica",
  basico: "Básico",
  classica: "Clássica",
  classico: "Clássico",
  algodao: "Algodão",
  tshirt: "T-shirt",
  "t-shirt": "T-shirt",
  ml: "Manga Longa",
  mc: "Manga Curta"
};
const PALAVRAS_FEMININAS_EXTRA = new Set(["t-shirt", "tshirt", "necessaire"]);

function semAcento(texto: string): string {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function limparNomeParaTitulo(nome: string): string {
  const limpo = nome
    .replace(/:\s*\d+\b/g, "")
    .replace(/\s+-\s+[A-Za-z]{0,3}\d{3,6}\b/g, "")
    .replace(/\s+-\s+(PP|P|M|G|GG|XG|XGG|EG|U|UN|Único|Unico|\d{2})\s*$/i, "")
    .replace(/\b(VER|INV)\s?\d{2}\b/gi, "")
    .replace(/\s+-\s+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return limpo
    .split(" ")
    .map((palavra, i) => {
      const minuscula = palavra.toLowerCase();
      if (CORRECOES_NOME[minuscula]) return CORRECOES_NOME[minuscula];
      if (i > 0 && PALAVRAS_MINUSCULAS.has(minuscula)) return minuscula;
      return palavra;
    })
    .join(" ");
}

function corEmTitulo(cor: string): string {
  return cor
    .toLowerCase()
    .split(" ")
    .map((palavra, i) =>
      i > 0 && PALAVRAS_MINUSCULAS.has(palavra)
        ? palavra
        : palavra
            .split("/")
            .map((parte) => parte.charAt(0).toUpperCase() + parte.slice(1))
            .join("/")
    )
    .join(" ");
}

function montarTitulo(produto: Produto, corDaVariacao: string): string {
  let nome = limparNomeParaTitulo(produto.nome);
  const palavras = nome.split(" ");
  let palavraBase = palavras[0] ?? "";
  if (/^(maxi|mini)$/i.test(palavraBase) && palavras[1]) palavraBase = palavras[1];
  const base = semAcento(palavraBase);
  const feminina = base.endsWith("a") || PALAVRAS_FEMININAS_EXTRA.has(base);
  if (palavras[0] === "T-shirt") nome = `Camiseta ${nome}`;

  let cor = corDaVariacao ? corEmTitulo(corDaVariacao) : "";
  if (cor) {
    const nomeSemAcento = semAcento(nome);
    const palavrasCor = semAcento(cor)
      .split(/[\s/]+/)
      .filter((p) => p.length > 2);
    if (palavrasCor.length > 0 && palavrasCor.every((p) => nomeSemAcento.includes(p))) cor = "";
  }

  const genero = GENERO_POR_MARCA[produto.marca] ?? "unisex";
  const generoTexto =
    genero === "female" ? (feminina ? "Feminina" : "Feminino") : genero === "male" ? (feminina ? "Masculina" : "Masculino") : "";

  return limparTexto([nome, produto.marca, cor, generoTexto].filter(Boolean).join(" "), 150);
}

// ---- Campos extras do Google Shopping (20/10/2026, aprovados pelo Brunno) ----

// Categoria do Google (numero da taxonomia oficial) por tipo de peca - o tipo vem do nome, igual ao
// filtro do catalogo (tipoDoProduto em lib/detalhesProduto.ts). Ids conferidos na taxonomia do
// Google em 20/10/2026. Tipo desconhecido cai em "Roupas" (1604) em vez de ficar sem categoria.
const CATEGORIA_GOOGLE_POR_TIPO: Record<string, string> = {
  Vestido: "2271",
  Chemise: "2271",
  Macacão: "5250",
  Macaquinho: "5250",
  Saia: "1581",
  Bermuda: "207",
  Short: "207",
  Calça: "204",
  Legging: "204",
  Jaqueta: "5598",
  Casaco: "5598",
  Blazer: "5598",
  Colete: "1831",
  Polo: "212",
  Camiseta: "212",
  Camisa: "212",
  Blusa: "212",
  Regata: "212",
  Body: "212",
  Top: "212",
  Cardigan: "212",
  Moletom: "212",
  Suéter: "212",
  Tricô: "212",
  Cueca: "2562",
  Biquíni: "211",
  Maiô: "211",
  Bolsa: "6551"
};

// Cor lida do NOME da peca, so' quando o cadastro nao trouxe nome de cor (codigo cru ou "Unico").
// Lista de cores comuns; frase mais longa primeiro ("azul marinho" antes de "azul").
// Nao inventa nada: se o nome nao tem cor, continua vazio.
const CORES_NO_NOME = [
  "off white", "azul marinho", "azul royal", "azul claro", "azul escuro", "verde oliva", "verde militar",
  "verde agua", "preto", "preta", "branco", "branca", "cru", "azul", "verde", "vermelho", "vermelha",
  "rosa", "amarelo", "amarela", "laranja", "roxo", "roxa", "lilas", "marrom", "bege", "cinza",
  "caramelo", "nude", "dourado", "dourada", "prateado", "prateada", "vinho", "caqui", "grafite",
  "creme", "areia", "camel", "bordo", "terracota", "mostarda", "turquesa", "marinho"
];

function corNoNomeDaPeca(nome: string): string {
  const texto = ` ${semAcento(nome)} `;
  for (const cor of CORES_NO_NOME) {
    if (texto.includes(` ${cor} `)) return corEmTitulo(cor === "lilas" ? "lilás" : cor === "bordo" ? "bordô" : cor);
  }
  return "";
}

function faixaDePreco(preco: number): string {
  if (preco <= 200) return "Até R$ 200";
  if (preco <= 400) return "R$ 200 a 400";
  if (preco <= 800) return "R$ 400 a 800";
  if (preco <= 1500) return "R$ 800 a 1500";
  return "Acima de R$ 1500";
}

function rotuloEstoque(tamanhosDisponiveis: number): string {
  if (tamanhosDisponiveis <= 1) return "1 tamanho em estoque";
  if (tamanhosDisponiveis >= 6) return "6 ou mais tamanhos em estoque";
  return `${tamanhosDisponiveis} tamanhos em estoque`;
}

// Mesmo peso medio por peca que o site usa pra cotar o frete (PESO_MEDIO_POR_PECA_KG em lib/frete.ts).
const PESO_ENVIO = "0.3 kg";

function csvEscape(valor: string): string {
  if (/[",\n\r]/.test(valor)) {
    return `"${valor.replace(/"/g, '""')}"`;
  }
  return valor;
}

function limparTexto(texto: string, limite: number): string {
  return texto.replace(/\s+/g, " ").trim().slice(0, limite);
}

function corValidaParaFeed(cor: string): string {
  const limpa = cor.trim();
  if (!limpa || limpa === "Único" || limpa === "Unico") return "";
  if (/^\d+$/.test(limpa)) return "";
  return limpa;
}

function corasMescladas(produto: Produto): Array<{ cor: string; imagens: string[]; tamanhos: string[]; disponiveis: Set<string> }> {
  const porChave = new Map<string, { cor: string; imagens: string[]; tamanhos: string[]; disponiveis: Set<string> }>();

  for (const cor of coresDoProduto(produto)) {
    const chave = corValidaParaFeed(cor.cor) ? cor.cor.trim().toLowerCase() : "";
    const disponiveisDessaEntrada = new Set(cor.tamanhosDisponiveis ?? cor.tamanhos);
    const existente = porChave.get(chave);
    if (!existente) {
      porChave.set(chave, {
        cor: cor.cor.trim(),
        imagens: cor.imagens,
        tamanhos: [...cor.tamanhos],
        disponiveis: disponiveisDessaEntrada
      });
      continue;
    }
    if (/[a-z]/.test(cor.cor) && !/[a-z]/.test(existente.cor)) existente.cor = cor.cor.trim();
    if (existente.imagens.length === 0) existente.imagens = cor.imagens;
    for (const tamanho of cor.tamanhos) {
      if (!existente.tamanhos.includes(tamanho)) existente.tamanhos.push(tamanho);
    }
    for (const tamanho of disponiveisDessaEntrada) existente.disponiveis.add(tamanho);
  }

  return Array.from(porChave.values());
}

function linhasDoProduto(produto: Produto): Array<Record<Coluna, string>> {
  const temOferta = typeof produto.precoOriginal === "number" && produto.precoOriginal > produto.preco;
  const precoCheio = (produto.precoOriginal ?? produto.preco).toFixed(2);
  const precoAtual = produto.preco.toFixed(2);
  const genero = GENERO_POR_MARCA[produto.marca] ?? "unisex";
  const descricao = limparTexto(textoDescricao(produto), 5000);
  const linkProduto = `${siteUrl}/produto/${produto.id}`;

  const linhas: Array<Record<Coluna, string>> = [];
  const idsVistos = new Set<string>();

  const tipo = tipoDoProduto(produto.nome);
  const categoriaGoogle = CATEGORIA_GOOGLE_POR_TIPO[tipo] ?? "1604";
  const generoTexto = genero === "male" ? "Masculino" : genero === "female" ? "Feminino" : "Unissex";
  const tipoProduto = `${generoTexto} > ${tipo} > ${produto.marca}`;
  const curadoria = produto.outlet ? "outlet" : produto.destaque ? "destaque" : "normal";

  for (const cor of corasMescladas(produto)) {
    const imagemCor = cor.imagens[0] ?? produto.imagem ?? "";
    // fotos extras da MESMA cor (ate 9 alem da capa; o Google aceita no maximo 10 no total)
    const fotosExtras = cor.imagens
      .slice(1, 10)
      .map((img) => `${siteUrl}${img}`)
      .join(",");
    // cor do cadastro; se vier vazia/codigo cru, tenta ler do nome da peca
    const corParaFeed = corValidaParaFeed(cor.cor) || corNoNomeDaPeca(produto.nome);
    const disponiveisAgora = cor.disponiveis;
    const tamanhosEmEstoque = cor.tamanhos.filter((t) => disponiveisAgora.has(t)).length;

    for (const tamanho of cor.tamanhos) {
      // Variacao esgotada nao vai pro feed (nao gasta clique em tamanho que nao da' pra comprar)
      if (!disponiveisAgora.has(tamanho)) continue;
      const id = idVarianteProduto(produto.id, cor.cor, tamanho);
      if (idsVistos.has(id)) continue;
      idsVistos.add(id);

      linhas.push({
        id,
        item_group_id: produto.id,
        title: montarTitulo(produto, corParaFeed),
        description: descricao,
        availability: "in stock",
        condition: "new",
        price: `${precoCheio} BRL`,
        sale_price: temOferta ? `${precoAtual} BRL` : "",
        link: linkProduto,
        image_link: imagemCor ? `${siteUrl}${imagemCor}` : "",
        brand: produto.marca,
        gtin: "",
        mpn: "",
        identifier_exists: "no",
        gender: genero,
        age_group: "adult",
        color: corParaFeed,
        size: tamanho === "Único" ? "" : tamanho,
        size_system: "BR",
        size_type: "regular",
        additional_image_link: fotosExtras,
        google_product_category: categoriaGoogle,
        product_type: tipoProduto,
        shipping_weight: PESO_ENVIO,
        custom_label_0: produto.marca,
        custom_label_1: faixaDePreco(produto.preco),
        custom_label_2: rotuloEstoque(tamanhosEmEstoque),
        custom_label_3: curadoria,
        custom_label_4: produto.novo ? "novidade" : "linha"
      });
    }
  }

  return linhas;
}

export async function GET() {
  const produtos = await listarProdutos();
  const linhas = produtos.filter((produto) => !!produto.imagem).flatMap(linhasDoProduto);

  const csv =
    [COLUNAS.join(","), ...linhas.map((linha) => COLUNAS.map((coluna) => csvEscape(linha[coluna])).join(","))].join(
      "\r\n"
    ) + "\r\n";

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=300, stale-while-revalidate=60"
    }
  });
}

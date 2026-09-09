import { NextResponse } from "next/server";
import { listarProdutos, coresDoProduto, idVarianteProduto, type Produto } from "@/lib/produtos";
import { textoDescricao } from "@/lib/detalhesProduto";
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
  "size"
] as const;

type Coluna = (typeof COLUNAS)[number];

// Bling nao guarda genero/faixa etaria por peca - mesmo mapa por marca usado no feed da Meta
// (confirmado pelo Brunno em 27/08/2026).
const GENERO_POR_MARCA: Record<string, "female" | "male" | "unisex"> = {
  Animale: "female",
  Reserva: "male",
  Foxton: "male",
  NV: "female"
};

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

  for (const cor of corasMescladas(produto)) {
    const imagemCor = cor.imagens[0] ?? produto.imagem ?? "";
    const corParaFeed = corValidaParaFeed(cor.cor);
    const disponiveisAgora = cor.disponiveis;

    for (const tamanho of cor.tamanhos) {
      const id = idVarianteProduto(produto.id, cor.cor, tamanho);
      if (idsVistos.has(id)) continue;
      idsVistos.add(id);

      linhas.push({
        id,
        item_group_id: produto.id,
        title: limparTexto(`${produto.nome} — ${produto.marca}`, 150),
        description: descricao,
        availability: disponiveisAgora.has(tamanho) ? "in stock" : "out of stock",
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
        size: tamanho === "Único" ? "" : tamanho
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

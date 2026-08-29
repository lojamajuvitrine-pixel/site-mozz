import { NextResponse } from "next/server";
import { listarProdutos, coresDoProduto, idVarianteProduto, type Produto } from "@/lib/produtos";
import { textoDescricao } from "@/lib/detalhesProduto";
import { SITE_URL as siteUrl } from "@/lib/site";

// Feed de catalogo pro Meta Commerce Manager (Facebook/Instagram Shop, Dynamic Ads,
// Advantage+ Catalog Ads) - fica publico em /api/meta-feed, sem autenticacao (a Meta precisa
// buscar isso periodicamente sozinha) e sem nada cadastrado na mao: reflete direto o mesmo
// catalogo que ja alimenta o site (lib/produtos.ts), sync automatico com o Bling.
//
// DECISAO REVISADA (27/08/2026, a pedido do Brunno apos revisar a 1a versao): uma linha por
// VARIACAO vendavel (cor+tamanho), nao uma linha por produto. Cada linha usa
// idVarianteProduto(produto.id, cor, tamanho) (definido em lib/produtos.ts) como "id", com
// "item_group_id" = produto.id agrupando as variacoes do mesmo produto - formato padrao da
// Meta pra roupa com variacao. O Pixel (lib/tracking.ts, chamado de lib/cart-context.tsx,
// app/carrinho/page.tsx e app/checkout/sucesso/page.tsx) foi atualizado no mesmo pacote pra
// mandar esse MESMO id no content_ids de AddToCart/InitiateCheckout/Purchase - sem isso o
// feed e o Pixel nao bateriam mais (ver analise completa passada pro Brunno).
//
// IMPORTANTE: idVarianteProduto NAO e' um id real do Bling por variacao (esse dado e'
// descartado no sync atual - ver comentario completo na propria funcao). E' um id CONSTRUIDO
// deterministico. Trade-off aceito pra nao precisar mexer no pipeline de sync nem rodar sync
// completo de novo; documentado assim de proposito.
//
// So' entra no feed produto que JA aparece no site (listarProdutos() - mesmo filtro de marca
// ativa, foto e preco > 0 usado em todo lugar). Produto sem estoque nenhum hoje nao tem
// pagina propria (buscarProduto tambem usa listarProdutos() e da' 404) - decisao confirmada
// com o Brunno em 27/08/2026: manter assim (zero mudanca de comportamento do site) - dentro
// de um produto que TEM pagina, uma variacao (cor+tamanho) especifica sem saldo agora entra
// mesmo assim, marcada "out of stock" (o link continua valido - e' a mesma pagina do
// produto, so' que aquele tamanho/cor aparece indisponivel no seletor).

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

// Bling nao guarda genero/faixa etaria por peca - o catalogo sincronizado nao tem esse
// campo. Mapa por marca CONFIRMADO pelo Brunno em 27/08/2026 - esses 4 sao as unicas marcas
// ativas (MARCAS_ATIVAS em lib/produtos.ts). Só mexer aqui se ele avisar de mudanca de marca
// ativa ou linha de produto (ex: Reserva lancar uma linha feminina de verdade).
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

// "Único" e' o valor de RESERVA que o parser usa quando a peca nao tem cor de verdade
// cadastrada no Bling (ver extrairCor em lib/blingParse.ts) - nao e' uma cor. E cerca de 44
// SKUs da Animale tem um CODIGO INTERNO (ex: "55911") no campo "Cor:" do Bling por erro de
// cadastro, nao uma cor de verdade - mandar isso pra Meta como "color" seria mais errado que
// deixar vazio. Nos dois casos, omite o campo em vez de mandar lixo.
function corValidaParaFeed(cor: string): string {
  const limpa = cor.trim();
  if (!limpa || limpa === "Único" || limpa === "Unico") return "";
  if (/^\d+$/.test(limpa)) return ""; // codigo interno usado por engano como "Cor" no Bling
  return limpa;
}

// Junta cores que so' diferem por maiuscula/acento/espaco (ex: "MILITAR" e "Militar" no
// mesmo produto - erro de cadastro real encontrado no Bling em 27/08/2026, SKU 16454980335)
// ANTES de gerar as linhas - sem isso, duas entradas "iguais" geram o MESMO
// idVarianteProduto (que normaliza do mesmo jeito) só que com availability conflitante, e
// uma delas fica de fora silenciosamente. Preserva a versao do nome mais "arrumada"
// (Title Case) pra mostrar no campo color, e faz a UNIAO dos tamanhos/disponibilidade das
// duas entradas (mais correto que escolher uma e descartar a outra).
function corasMescladas(produto: Produto): Array<{ cor: string; imagens: string[]; tamanhos: string[]; disponiveis: Set<string> }> {
  const porChave = new Map<
    string,
    { cor: string; imagens: string[]; tamanhos: string[]; disponiveis: Set<string> }
  >();

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
    // prefere o nome com mais letra maiuscula-minuscula misturada (Title Case) em vez de
    // TUDO MAIUSCULO, so' pra ficar mais apresentavel no feed - nao muda a logica de estoque.
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
    // TODOS os tamanhos ja cadastrados dessa cor (nao so' os disponiveis agora) - respeita o
    // estoque de CADA variacao individualmente no availability, em vez de esconder a
    // variacao esgotada (ver pedido do Brunno de 27/08/2026, item 2 e 4).
    const disponiveisAgora = cor.disponiveis;

    for (const tamanho of cor.tamanhos) {
      const id = idVarianteProduto(produto.id, cor.cor, tamanho);
      if (idsVistos.has(id)) continue; // defesa contra tamanho duplicado dentro da mesma cor
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
        // Bling nao guarda GTIN/EAN nem MPN por peca no sync atual - sem os dois, a Meta
        // pede identifier_exists=no em vez de deixar sem explicacao (evita o item ser
        // sinalizado como "faltando identificador" no Commerce Manager). Ver observacao
        // passada ao Brunno sobre investigar se o Bling tem esse campo cadastrado.
        gtin: "",
        mpn: "",
        identifier_exists: "no",
        gender: genero,
        age_group: "adult",
        color: corParaFeed,
        size: tamanho === "Único" ? "" : tamanho // "tamanho unico" tambem nao e' um tamanho de verdade pra Meta
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

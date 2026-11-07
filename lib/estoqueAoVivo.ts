// Estoque "ao vivo" (07/11/2026, pedido do Brunno) - o saldo de cada variacao do Bling fica numa
// tabela do Supabase (estoque_bling) que e' atualizada por 3 caminhos:
//   1) o proprio Bling avisa o site na hora que o estoque muda (app/api/bling/webhook);
//   2) quando uma venda do site e' aprovada, o webhook do Mercado Pago ja' baixa a peca na hora;
//   3) o sync de 5 em 5 minutos (scripts/sync-estoque.ts) grava o retrato completo, como rede de
//      seguranca caso algum aviso do Bling se perca.
// O catalogo (lib/produtos.ts) le essa tabela e recalcula, por cima do data/produtos.json, quais
// tamanhos tem saldo e QUANTAS unidades tem de cada um - sem precisar esperar o sync gravar o
// JSON e a Vercel publicar o site de novo (o que levava de 5 a 8 minutos).
//
// A regra de "qual SKU do Bling e' qual cor/tamanho do site" e' a MESMA do scripts/sync-estoque.ts
// (que continua cuidando de preco e do JSON) - aqui so' mexe em estoque, nunca em preco.
// Se o Supabase falhar ou a tabela estiver vazia, o site continua com o estoque do JSON.
import { clientePublico } from "@/lib/supabase/publico";
import { SUPABASE_CONFIGURADO } from "@/lib/supabase/config";
import { extrairCor, extrairTamanho } from "@/lib/blingParse";
import type { Produto, VarianteCor } from "@/lib/produtos";

export type SkuEstoque = { id: number; nome: string; saldo: number };
// chave = id do produto-pai no Bling (ou o proprio id, quando e' produto simples) - mesmo
// agrupamento do scripts/sync-estoque.ts.
export type EstoqueAoVivo = Map<number, SkuEstoque[]>;

// Quanto tempo o mesmo retrato do estoque vale dentro de um servidor antes de buscar de novo.
// As paginas ja' se atualizam a cada 30s (revalidate) - 10s aqui so' evita buscar a tabela
// varias vezes numa mesma montagem de pagina.
const VALIDADE_MS = 10_000;

let retrato: { carregadoEm: number; dados: EstoqueAoVivo | null } | null = null;
let emAndamento: Promise<EstoqueAoVivo | null> | null = null;

async function buscarNoBanco(): Promise<EstoqueAoVivo | null> {
  if (!SUPABASE_CONFIGURADO) return null;
  try {
    // RPC devolve tudo numa chamada so' (lista compacta [id, id_pai, nome, saldo]) - a leitura
    // direta da tabela pararia em 1000 linhas.
    const { data, error } = await clientePublico().rpc("estoque_site");
    if (error || !Array.isArray(data) || data.length === 0) return null;
    const grupos: EstoqueAoVivo = new Map();
    for (const linha of data as unknown[]) {
      if (!Array.isArray(linha)) continue;
      const [id, idPai, nome, saldo] = linha as [unknown, unknown, unknown, unknown];
      const idNumero = Number(id);
      if (!Number.isFinite(idNumero)) continue;
      const chave = Number(idPai) || idNumero;
      if (!grupos.has(chave)) grupos.set(chave, []);
      grupos.get(chave)!.push({
        id: idNumero,
        nome: typeof nome === "string" ? nome : "",
        saldo: Math.max(0, Math.floor(Number(saldo) || 0))
      });
    }
    return grupos.size > 0 ? grupos : null;
  } catch {
    return null;
  }
}

// fresco=true ignora o retrato guardado (usado no pagamento e na conferencia do carrinho, que
// precisam do saldo de agora).
export async function carregarEstoqueAoVivo(fresco = false): Promise<EstoqueAoVivo | null> {
  if (!fresco && retrato && Date.now() - retrato.carregadoEm < VALIDADE_MS) return retrato.dados;
  if (!fresco && emAndamento) return emAndamento;
  const promessa = buscarNoBanco().then((dados) => {
    retrato = { carregadoEm: Date.now(), dados };
    return dados;
  });
  if (!fresco) {
    emAndamento = promessa;
    promessa.finally(() => {
      if (emAndamento === promessa) emAndamento = null;
    });
  }
  return promessa;
}

function melhorSku(skus: SkuEstoque[]): number | undefined {
  return (skus.find((s) => s.saldo > 0) ?? skus[0])?.id;
}

// Recalcula uma cor: quais tamanhos tem saldo, quantas unidades de cada e qual SKU do Bling
// representa cada tamanho (o que tiver saldo, de preferencia) - esse ultimo vai no pedido do
// Bling, pra baixar o estoque da variacao certa (antes ia o codigo geral do produto).
function montarCor(cor: VarianteCor, tamanhos: string[], skusDoTamanho: (tamanho: string) => SkuEstoque[]): VarianteCor {
  const estoquePorTamanho: Record<string, number> = {};
  const idsBlingPorTamanho: Record<string, number> = {};
  const disponiveis: string[] = [];
  for (const tamanho of tamanhos) {
    const skus = skusDoTamanho(tamanho);
    if (skus.length === 0) continue;
    const id = melhorSku(skus);
    if (id) idsBlingPorTamanho[tamanho] = id;
    const total = skus.reduce((soma, s) => soma + s.saldo, 0);
    estoquePorTamanho[tamanho] = total;
    if (total > 0) disponiveis.push(tamanho);
  }
  return { ...cor, tamanhosDisponiveis: disponiveis, estoquePorTamanho, idsBlingPorTamanho };
}

function comCores(produto: Produto, cores: VarianteCor[]): Produto {
  return { ...produto, cores, temEstoque: cores.some((c) => (c.tamanhosDisponiveis ?? []).length > 0) };
}

function algumIdConhecido(grupos: EstoqueAoVivo, listas: string[][]): boolean {
  return listas.some((ids) => ids.some((id) => grupos.has(Number(id))));
}

// Devolve uma COPIA do produto com o estoque de agora. Produto que nao aparece na tabela (nunca
// sincronizado, ou inativado no Bling) volta como estava no JSON.
export function aplicarEstoqueAoVivo(produto: Produto, grupos: EstoqueAoVivo): Produto {
  const skusDosIds = (ids: string[]) => ids.flatMap((id) => grupos.get(Number(id)) ?? []);

  // Produto fundido por COR + tamanho (convencao VER26) - ver atualizarProdutoFundidoPorCor
  if (produto.gruposBlingPorCorTamanho) {
    const mapa = produto.gruposBlingPorCorTamanho;
    if (!algumIdConhecido(grupos, Object.values(mapa).flatMap((porTamanho) => Object.values(porTamanho)))) {
      return produto;
    }
    const cores = (produto.cores ?? []).map((cor) => {
      const porTamanho = mapa[cor.cor] ?? {};
      return montarCor(cor, Object.keys(porTamanho), (t) => skusDosIds(porTamanho[t] ?? []));
    });
    return comCores(produto, cores);
  }

  // Produto fundido so' por tamanho (uma cor) - ver atualizarProdutoFundido
  if (produto.gruposBlingPorTamanho) {
    const mapa = produto.gruposBlingPorTamanho;
    if (!algumIdConhecido(grupos, Object.values(mapa))) return produto;
    const cores = (produto.cores ?? []).map((cor, indice) =>
      indice === 0 ? montarCor(cor, Object.keys(mapa), (t) => skusDosIds(mapa[t] ?? [])) : cor
    );
    return comCores(produto, cores);
  }

  // Produto normal: as variacoes (SKUs) trazem "Cor:X;Tamanho:Y" no nome
  const skus = grupos.get(Number(produto.id));
  if (!skus || skus.length === 0) return produto;
  const cores = (produto.cores ?? []).map((cor) => {
    // Peca simples cujo tamanho veio do NOME do produto (ex: "Calca ... - 32") - mesmo caso
    // especial do sync rapido: usa o saldo geral do produto pra esse tamanho.
    const tamanhoUnicoDoNome =
      cor.tamanhos.length === 1 && cor.tamanhos[0] !== "Único" && !skus.some((s) => !!extrairTamanho(s.nome))
        ? cor.tamanhos[0]
        : null;
    if (tamanhoUnicoDoNome) return montarCor(cor, [tamanhoUnicoDoNome], () => skus);

    const skusDaCor = skus.filter((s) => (extrairCor(s.nome) ?? "Único") === cor.cor);
    const temTamanhoVariado = skusDaCor.some((s) => !!extrairTamanho(s.nome));
    if (!temTamanhoVariado) return montarCor(cor, ["Único"], () => skusDaCor);

    const tamanhos = Array.from(
      new Set(skusDaCor.map((s) => extrairTamanho(s.nome)).filter((t): t is string => !!t))
    );
    return montarCor(cor, tamanhos, (t) => skusDaCor.filter((s) => extrairTamanho(s.nome) === t));
  });
  return comCores(produto, cores);
}

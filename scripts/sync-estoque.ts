// Versao LEVE do sync (comparar com scripts/sync-bling.ts) - so' atualiza PRECO e
// DISPONIBILIDADE (temEstoque) de produtos que ja existem em data/produtos.json, sem baixar
// foto nem buscar marca/descricao (isso so precisa ser feito uma vez por produto, nunca
// muda com uma venda). Preco e estoque vem de graca na propria LISTA do Bling (GET
// /produtos), sem precisar de uma chamada de detalhe por produto - por isso roda rapido
// (poucos segundos pra todo o catalogo) e da pra agendar com frequencia.
//
// E' esse script que roda automaticamente via GitHub Actions (.github/workflows/
// sync-estoque.yml) pra refletir no site vendas feitas na loja fisica (ou qualquer ajuste de
// estoque feito direto no Bling), sem precisar do Brunno rodar nada na mao. Ver
// PROXIMOS_PASSOS.md pra configurar os secrets do GitHub necessarios.
//
// Uso manual: npm run sync:estoque
import { config as carregarEnv } from "dotenv";
carregarEnv({ path: ".env.local" });

import { readFileSync, writeFileSync } from "fs";
import { listarProdutosBling } from "../lib/bling";
import { tamanhosDisponiveisDaCor } from "../lib/blingParse";
import type { Produto } from "../lib/produtos";

const PAUSA_ENTRE_PAGINAS_MS = 350;

function dormir(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type ProdutoBlingLista = {
  id: number;
  idProdutoPai?: number;
  nome: string; // traz "Cor:X;Tamanho:Y" embutido - usado pra recalcular tamanhosDisponiveis
  preco: number;
  estoque?: { saldoVirtualTotal: number };
  situacao: string;
  formato: string; // "S" = simples/variacao, "V" = variavel (produto-pai, sem estoque proprio)
};

async function listarTodosProdutos(): Promise<ProdutoBlingLista[]> {
  const todos: ProdutoBlingLista[] = [];
  let pagina = 1;
  for (;;) {
    const resposta = await listarProdutosBling(pagina);
    const lote = (resposta.data ?? []) as ProdutoBlingLista[];
    if (lote.length === 0) break;
    todos.push(...lote);
    if (lote.length < 100) break;
    pagina++;
    await dormir(PAUSA_ENTRE_PAGINAS_MS);
  }
  return todos;
}

async function main() {
  console.log("Sync rapido de preco/estoque (sem fotos/marca/descricao)...");

  const todos = await listarTodosProdutos();
  const ativos = todos.filter((p) => p.situacao === "A");
  console.log(`${ativos.length} produtos ativos encontrados no Bling.`);

  // agrupa por produto-pai (mesma logica do sync completo) pra decidir preco/estoque por
  // GRUPO (produto do site), nao por SKU individual.
  const grupos = new Map<number, ProdutoBlingLista[]>();
  for (const p of ativos) {
    if (p.formato === "V") continue;
    const chave = p.idProdutoPai ?? p.id;
    if (!grupos.has(chave)) grupos.set(chave, []);
    grupos.get(chave)!.push(p);
  }

  const atual = JSON.parse(readFileSync("data/produtos.json", "utf-8")) as Produto[];
  let atualizados = 0;
  let naoEncontrados = 0;

  for (const produto of atual) {
    const skus = grupos.get(Number(produto.id));
    if (!skus) {
      // produto nao apareceu na lista de ativos agora (pode ter sido inativado no Bling) -
      // por seguranca, so marca como fora de estoque em vez de mexer em mais nada.
      if (produto.temEstoque !== false) {
        produto.temEstoque = false;
        atualizados++;
      }
      naoEncontrados++;
      continue;
    }
    const precoNovo = skus[0].preco;
    const temEstoqueNovo = skus.some((s) => (s.estoque?.saldoVirtualTotal ?? 0) > 0);
    let mudou = false;

    if (produto.preco !== precoNovo) {
      produto.preco = precoNovo;
      mudou = true;
    }
    if (produto.temEstoque !== temEstoqueNovo) {
      produto.temEstoque = temEstoqueNovo;
      mudou = true;
    }

    // recalcula, por cor, quais tamanhos ainda tem saldo - e' isso que impede o site de
    // deixar escolher um tamanho que acabou de esgotar entre um sync e outro.
    for (const cor of produto.cores ?? []) {
      const disponivelNovo = tamanhosDisponiveisDaCor(cor.cor, skus).sort();
      const disponivelAtual = [...(cor.tamanhosDisponiveis ?? cor.tamanhos)].sort();
      if (JSON.stringify(disponivelAtual) !== JSON.stringify(disponivelNovo)) {
        cor.tamanhosDisponiveis = disponivelNovo;
        mudou = true;
      }
    }

    if (mudou) atualizados++;
  }

  writeFileSync("data/produtos.json", JSON.stringify(atual, null, 2));
  console.log(`Pronto! ${atualizados} produto(s) com preço/estoque atualizado.`);
  if (naoEncontrados > 0) {
    console.log(`Atenção: ${naoEncontrados} produto(s) do site não apareceram como ativos no Bling agora.`);
  }
}

main().catch((erro) => {
  console.error(erro);
  process.exit(1);
});

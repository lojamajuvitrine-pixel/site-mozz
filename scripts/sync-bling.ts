// Script standalone (npm run sync:bling) que puxa o catalogo REAL do Bling e sobrescreve
// data/produtos.json - assim o site builda com o catalogo atualizado sem precisar de banco
// de dados pra uma loja desse tamanho. Roda localmente (precisa das credenciais no .env.local).
//
// Descobertas sobre a API do Bling (confirmadas com produtos reais da MOZZ em 22/08/2026):
// - GET /produtos (lista, paginado) NAO traz o campo "marca" - so' id, nome, codigo, preco,
//   precoCusto, estoque.saldoVirtualTotal, situacao, formato, idProdutoPai.
// - GET /produtos/{id} (detalhe, UM produto por vez) traz "marca" (string, ex: "Reserva"),
//   junto com categoria.id e variacao.nome (ex: "Tamanho:G").
// - Produtos com variacao de tamanho/cor viram varias linhas na lista (formato "S", todas
//   apontando pro mesmo idProdutoPai). O produto "pai" (formato "V") e' so' uma casca, sem
//   preco/estoque proprio.
// - Por isso: 1 chamada de detalhe por GRUPO de variacoes (nao por SKU) e' o suficiente pra
//   pegar a marca - dá pra economizar bastante chamada num catalogo com milhares de SKUs.
//
// Uso: npm run sync:bling            -> roda o catalogo inteiro (pode levar alguns minutos)
//      npm run sync:bling -- --limite=20   -> roda só os 20 primeiros grupos, pra testar rápido
// Esse script roda fora do Next.js (via tsx direto), entao o .env.local NAO e' carregado
// sozinho como acontece com "next dev"/"next build" - precisa carregar na mao aqui.
import { config as carregarEnv } from "dotenv";
carregarEnv({ path: ".env.local" });

import { writeFileSync } from "fs";
import { listarProdutosBling, buscarProdutoDetalheBling } from "../lib/bling";

type ProdutoBlingLista = {
  id: number;
  idProdutoPai?: number;
  nome: string;
  codigo: string;
  preco: number;
  precoCusto?: number;
  estoque?: { saldoVirtualTotal: number };
  situacao: string;
  formato: string; // "S" = simples/variacao, "V" = variavel (produto-pai, sem estoque proprio)
};

const PAUSA_ENTRE_CHAMADAS_MS = 350; // respeita o limite de requisicoes por segundo da API

function dormir(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function listarTodosProdutos(): Promise<ProdutoBlingLista[]> {
  const todos: ProdutoBlingLista[] = [];
  let pagina = 1;
  for (;;) {
    const resposta = await listarProdutosBling(pagina);
    const lote = (resposta.data ?? []) as ProdutoBlingLista[];
    if (lote.length === 0) break;
    todos.push(...lote);
    console.log(`  pagina ${pagina}: ${lote.length} produtos (total ate agora: ${todos.length})`);
    if (lote.length < 100) break; // ultima pagina (limite=100 por pagina)
    pagina++;
    await dormir(PAUSA_ENTRE_CHAMADAS_MS);
  }
  return todos;
}

function extrairTamanho(nome: string): string | null {
  const m = nome.match(/Tamanho:\s*([^;]+)/i);
  return m ? m[1].trim() : null;
}

function limparNomeBase(nome: string): string {
  return nome
    .replace(/\s*Cor:[^;]+;?/i, "")
    .replace(/\s*Tamanho:[^;]+;?/i, "")
    .trim();
}

async function main() {
  const limiteArg = process.argv.find((a) => a.startsWith("--limite="));
  const limite = limiteArg ? Number(limiteArg.split("=")[1]) : null;

  console.log("Buscando lista completa de produtos no Bling...");
  const todos = await listarTodosProdutos();
  const ativos = todos.filter((p) => p.situacao === "A");
  console.log(`${ativos.length} produtos ativos (de ${todos.length} no total).`);

  // Agrupa variacoes de tamanho/cor pelo produto-pai. Formato "V" (a casca do pai) e' pulado
  // aqui - ele nao carrega preco/estoque proprio, so' serve de referencia de agrupamento.
  const grupos = new Map<number, ProdutoBlingLista[]>();
  for (const p of ativos) {
    if (p.formato === "V") continue;
    const chaveGrupo = p.idProdutoPai ?? p.id;
    if (!grupos.has(chaveGrupo)) grupos.set(chaveGrupo, []);
    grupos.get(chaveGrupo)!.push(p);
  }

  let entradas = Array.from(grupos.entries());
  if (limite) {
    entradas = entradas.slice(0, limite);
    console.log(`Modo teste: processando so' os primeiros ${limite} produtos (de ${grupos.size} no total).`);
  } else {
    console.log(`${grupos.size} produtos distintos (agrupando variacoes de tamanho/cor).`);
  }
  console.log("Buscando a marca de cada produto (1 chamada por produto, com pausa entre elas - pode demorar)...");

  const produtosMapeados: Array<{
    id: string;
    nome: string;
    marca: string;
    preco: number;
    novo: boolean;
    descricao: string;
    tamanhos: string[];
    imagem: string | null;
    temEstoque: boolean;
  }> = [];

  let processados = 0;
  let semMarca = 0;

  for (const [chaveGrupo, variacoes] of entradas) {
    processados++;
    let marca = "";
    let nomeBase = limparNomeBase(variacoes[0].nome);

    try {
      const detalhe = (await buscarProdutoDetalheBling(chaveGrupo)) as {
        data: { marca?: string; nome?: string };
      };
      marca = detalhe.data.marca ?? "";
      if (detalhe.data.nome) nomeBase = limparNomeBase(detalhe.data.nome);
    } catch {
      // chaveGrupo pode ser o id de um item sem produto-pai proprio (grupo de 1 SKU) -
      // nesse caso ela JA e' o id do proprio produto, entao o try acima deveria ter funcionado;
      // se cair aqui mesmo assim, so' registra como "sem marca" pra revisao manual depois.
      semMarca++;
      console.warn(`  aviso: nao achei marca do produto ${chaveGrupo} ("${nomeBase}")`);
    }

    const tamanhos = Array.from(
      new Set(variacoes.map((v) => extrairTamanho(v.nome)).filter((t): t is string => !!t))
    );

    const temEstoque = variacoes.some((v) => (v.estoque?.saldoVirtualTotal ?? 0) > 0);

    produtosMapeados.push({
      id: String(chaveGrupo),
      nome: nomeBase,
      marca: marca || "Sem marca",
      preco: variacoes[0].preco,
      novo: false,
      descricao: "",
      tamanhos: tamanhos.length > 0 ? tamanhos : ["Único"],
      imagem: null,
      temEstoque
    });

    if (processados % 20 === 0) {
      console.log(`  ${processados}/${entradas.length} processados...`);
    }
    await dormir(PAUSA_ENTRE_CHAMADAS_MS);
  }

  writeFileSync("data/produtos.json", JSON.stringify(produtosMapeados, null, 2));
  console.log(`\nPronto! data/produtos.json atualizado com ${produtosMapeados.length} produtos.`);
  if (semMarca > 0) {
    console.log(`Atencao: ${semMarca} produto(s) ficaram sem marca identificada - revisar manualmente no arquivo.`);
  }
}

main().catch((erro) => {
  console.error(erro);
  process.exit(1);
});

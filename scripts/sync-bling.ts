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
// - IMPORTANTE (descoberto em 22/08/2026): o "imagemURL" que a lista (GET /produtos) devolve
//   e' na verdade a MINIATURA (confirmado: e' o mesmo valor de "linkMiniatura" do detalhe,
//   ~70x70px) e com validade de poucos MINUTOS - por isso as fotos apareciam quebradas/nao
//   apareciam. A foto em resolucao de verdade fica em outro lugar: GET /produtos/{id} (detalhe)
//   -> data.midia.imagens.internas[].link (validade de alguns DIAS, bem maior que a miniatura).
//   Por isso o sync usa o "link" do detalhe pra imagem, nao o "imagemURL" da lista.
//   De qualquer forma, seja qual for a validade, a URL do Bling expira em algum momento -
//   a foto e' BAIXADA aqui mesmo durante o sync e salva em public/produtos/, e o produtos.json
//   guarda so' o caminho local (ex: "/produtos/123.jpg") - que nao expira nunca, porque a foto
//   passa a ser servida pelo proprio site, nao pelo Bling.
//
// Uso: npm run sync:bling                    -> roda o catalogo inteiro. Da segunda vez em
//        diante e' RAPIDO: so' busca marca/nome de produto NOVO e so' baixa foto que ainda
//        nao tem local (preco/estoque sempre atualizam, isso vem de graca na lista).
//      npm run sync:bling -- --limite=20      -> roda só os 20 primeiros grupos, pra testar
//      npm run sync:bling -- --completo       -> ignora o cache, busca marca/nome de TODOS de
//        novo (use se corrigiu marca de varios produtos direto no Bling)
//      npm run sync:bling -- --forcar-fotos   -> baixa TODAS as fotos de novo, mesmo as que
//        ja existem localmente (use se trocou foto de produto que ja tinha foto)
// Esse script roda fora do Next.js (via tsx direto), entao o .env.local NAO e' carregado
// sozinho como acontece com "next dev"/"next build" - precisa carregar na mao aqui.
import { config as carregarEnv } from "dotenv";
carregarEnv({ path: ".env.local" });

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "fs";
import * as path from "path";
import { listarProdutosBling, buscarProdutoDetalheBling } from "../lib/bling";

// Pasta publica do Next.js - tudo aqui dentro fica acessivel direto por URL (ex:
// public/produtos/123.jpg vira https://.../produtos/123.jpg), sem precisar de rota de API.
const PASTA_IMAGENS = path.join(process.cwd(), "public", "produtos");
if (!existsSync(PASTA_IMAGENS)) mkdirSync(PASTA_IMAGENS, { recursive: true });

// Fotos ja baixadas em syncs anteriores (nome do arquivo = "<id>.<extensao>") - usado pra NAO
// baixar de novo em toda sincronizacao, so' os produtos novos que ainda nao tem foto local.
// Isso e' o que faz o sync do dia-a-dia ficar rapido depois da primeira carga completa.
const FOTOS_EXISTENTES = new Set(existsSync(PASTA_IMAGENS) ? readdirSync(PASTA_IMAGENS) : []);
function fotoLocalExistente(idProduto: string): string | null {
  const achado = Array.from(FOTOS_EXISTENTES).find((nome) => nome.startsWith(`${idProduto}.`));
  return achado ? `/produtos/${achado}` : null;
}

// Baixa a foto do S3 do Bling enquanto a URL assinada ainda e' valida e salva localmente em
// public/produtos/. Retorna o caminho local (pra guardar no produtos.json) ou null se falhar.
async function baixarImagem(url: string, idProduto: string): Promise<string | null> {
  try {
    const resposta = await fetch(url);
    if (!resposta.ok) return null;
    const tipo = resposta.headers.get("content-type") ?? "";
    const extensao = tipo.includes("png") ? "png" : tipo.includes("webp") ? "webp" : "jpg";
    const nomeArquivo = `${idProduto}.${extensao}`;
    const bytes = Buffer.from(await resposta.arrayBuffer());
    writeFileSync(path.join(PASTA_IMAGENS, nomeArquivo), bytes);
    return `/produtos/${nomeArquivo}`;
  } catch {
    return null;
  }
}

// Cache do produtos.json da rodada anterior, indexado por id - usado pra pular a chamada de
// detalhe (marca/nome) em produtos que a gente ja processou antes. Marca praticamente nunca
// muda depois de cadastrada, entao isso e' seguro e economiza a maior parte do tempo do sync
// no dia-a-dia (so' produto NOVO no Bling precisa de chamada de detalhe).
type CacheProduto = { marca: string; nome: string };
function carregarCache(): Map<string, CacheProduto> {
  const cache = new Map<string, CacheProduto>();
  try {
    const anterior = JSON.parse(readFileSync("data/produtos.json", "utf-8")) as Array<{
      id: string;
      nome: string;
      marca: string;
    }>;
    for (const p of anterior) cache.set(p.id, { marca: p.marca, nome: p.nome });
  } catch {
    // primeira vez rodando, ou arquivo corrompido - sem problema, so' processa tudo do zero
  }
  return cache;
}

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
  // A lista tambem devolve isso, mas e' so' a MINIATURA (ver comentario no topo do arquivo) -
  // nao usamos mais esse campo pra foto, so' fica aqui documentado pra nao reintroduzir o bug.
  imagemURL?: string;
};

// Foto em resolucao de verdade, vinda do detalhe (GET /produtos/{id}) - ver comentario no
// topo do arquivo sobre a diferenca entre isso e a miniatura da lista.
type ImagemDetalheBling = { link?: string };
type DetalheBling = {
  data: {
    marca?: string;
    nome?: string;
    midia?: { imagens?: { internas?: ImagemDetalheBling[] } };
  };
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

// O campo "marca" no Bling e' texto livre, digitado a cada cadastro - por isso a mesma marca
// aparece com grafias diferentes (ex: "Animale", "ANIMALE"; "Slywear", "SLYWEAR"). Essa funcao
// padroniza CAPITALIZACAO e tambem funde apelidos conhecidos da mesma marca (confirmado com o
// Brunno em 22/08/2026: "Sly" e "Slywear" sao a mesma marca, so' grafia diferente).
const MARCAS_SIGLA = new Set(["nv"]); // marcas que devem ficar em maiusculo (siglas curtas)
const MARCAS_APELIDOS: Record<string, string> = {
  sly: "Slywear",
  // erros de digitacao encontrados no sync de 22/08/2026 (catalogo com 1.966 produtos)
  iodioce: "Iodice",
  animalet: "Animale",
  animaleq: "Animale"
};
function normalizarMarca(marca: string): string {
  const limpo = marca.trim();
  if (!limpo) return "Sem marca";
  const chave = limpo.toLowerCase();
  if (MARCAS_APELIDOS[chave]) return MARCAS_APELIDOS[chave];
  if (MARCAS_SIGLA.has(chave)) return limpo.toUpperCase();
  return limpo.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

async function main() {
  const limiteArg = process.argv.find((a) => a.startsWith("--limite="));
  const limite = limiteArg ? Number(limiteArg.split("=")[1]) : null;
  // --completo ignora o cache e busca marca/nome de novo pra TODOS os produtos (util se voce
  // corrigiu marca de varios produtos direto no Bling e quer que o site reflita isso agora).
  const completo = process.argv.includes("--completo");
  // --forcar-fotos rebaixa TODAS as fotos de novo, mesmo as que ja existem localmente (util
  // se voce trocou a foto de produtos que ja tinham foto cadastrada antes).
  const forcarFotos = process.argv.includes("--forcar-fotos");

  const cache = completo ? new Map<string, CacheProduto>() : carregarCache();
  if (cache.size > 0) {
    console.log(
      `Cache de ${cache.size} produto(s) do sync anterior carregado - so' vou buscar marca/nome` +
        ` de produtos novos (use --completo pra ignorar o cache e buscar tudo de novo).`
    );
  }

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
  let novos = 0;
  let fotosBaixadasAgora = 0;
  let fotosReaproveitadas = 0;

  for (const [chaveGrupo, variacoes] of entradas) {
    processados++;
    const idStr = String(chaveGrupo);
    let nomeBase = limparNomeBase(variacoes[0].nome);
    let marcaFinal: string;

    const doCache = cache.get(idStr);
    const fotoJaSalva = !forcarFotos ? fotoLocalExistente(idStr) : null;
    // so' chama o detalhe (mais lento - 1 chamada por produto) quando falta marca/nome no
    // cache OU falta foto local - as duas coisas vem do mesmo endpoint, entao uma chamada
    // resolve as duas. Se ja tem as duas, pula e nem gasta tempo de rede.
    const precisaDetalhe = !doCache || !fotoJaSalva;

    let imagem: string | null = fotoJaSalva;
    if (fotoJaSalva) fotosReaproveitadas++;

    if (!precisaDetalhe && doCache) {
      marcaFinal = doCache.marca;
      if (doCache.nome) nomeBase = doCache.nome;
    } else {
      if (!doCache) novos++;
      let marca = doCache?.marca ?? "";
      let marcaJaNormalizada = !!doCache;
      try {
        const detalhe = (await buscarProdutoDetalheBling(chaveGrupo)) as DetalheBling;
        if (!doCache) {
          marca = detalhe.data.marca ?? "";
          marcaJaNormalizada = false;
          if (detalhe.data.nome) nomeBase = limparNomeBase(detalhe.data.nome);
        }
        if (!fotoJaSalva) {
          const linkFoto = detalhe.data.midia?.imagens?.internas?.[0]?.link;
          imagem = linkFoto ? await baixarImagem(linkFoto, idStr) : null;
          if (imagem) fotosBaixadasAgora++;
        }
      } catch {
        // chaveGrupo pode ser o id de um item sem produto-pai proprio (grupo de 1 SKU) -
        // nesse caso ela JA e' o id do proprio produto, entao o try acima deveria ter funcionado;
        // se cair aqui mesmo assim, so' registra como "sem marca" pra revisao manual depois.
        if (!doCache) {
          semMarca++;
          console.warn(`  aviso: nao achei marca/foto do produto ${chaveGrupo} ("${nomeBase}")`);
        }
      }
      marcaFinal = marcaJaNormalizada ? marca : normalizarMarca(marca);
      await dormir(PAUSA_ENTRE_CHAMADAS_MS); // so' pausa quando realmente chamou a API
    }

    const tamanhos = Array.from(
      new Set(variacoes.map((v) => extrairTamanho(v.nome)).filter((t): t is string => !!t))
    );

    const temEstoque = variacoes.some((v) => (v.estoque?.saldoVirtualTotal ?? 0) > 0);

    produtosMapeados.push({
      id: idStr,
      nome: nomeBase,
      marca: marcaFinal,
      preco: variacoes[0].preco,
      novo: false,
      descricao: "",
      tamanhos: tamanhos.length > 0 ? tamanhos : ["Único"],
      imagem,
      temEstoque
    });

    if (processados % 100 === 0) {
      console.log(`  ${processados}/${entradas.length} processados...`);
    }
  }

  writeFileSync("data/produtos.json", JSON.stringify(produtosMapeados, null, 2));
  const comFoto = produtosMapeados.filter((p) => p.imagem).length;
  console.log(`\nPronto! data/produtos.json atualizado com ${produtosMapeados.length} produtos.`);
  console.log(`Produtos novos (buscaram marca na API agora): ${novos}.`);
  console.log(
    `Fotos: ${comFoto} de ${produtosMapeados.length} com foto` +
      ` (${fotosBaixadasAgora} baixada(s) agora, ${fotosReaproveitadas} reaproveitada(s) de antes).`
  );
  if (semMarca > 0) {
    console.log(`Atencao: ${semMarca} produto(s) ficaram sem marca identificada - revisar manualmente no arquivo.`);
  }

  const marcas = Array.from(new Set(produtosMapeados.map((p) => p.marca))).sort();
  console.log(`\nMarcas encontradas (${marcas.length}): ${marcas.join(", ")}`);
  console.log(
    "Confere essa lista: se aparecerem duas entradas parecidas (ex: 'Sly' e 'Slywear') que na" +
      " verdade sao a mesma marca escrita diferente no Bling, me avisa qual e' o nome certo" +
      " que eu ajusto o de-para no script."
  );
}

main().catch((erro) => {
  console.error(erro);
  process.exit(1);
});

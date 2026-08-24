// Script standalone (npm run sync:bling) que puxa o catalogo REAL do Bling e sobrescreve
// data/produtos.json - assim o site builda com o catalogo atualizado sem precisar de banco
// de dados pra uma loja desse tamanho. Roda localmente (precisa das credenciais no .env.local).
//
// Descobertas sobre a API do Bling (confirmadas com produtos reais da MOZZ em 22-23/08/2026):
// - GET /produtos (lista, paginado) NAO traz o campo "marca" - so' id, nome, codigo, preco,
//   precoCusto, estoque.saldoVirtualTotal, situacao, formato, idProdutoPai. O "nome" de cada
//   VARIACAO (formato "S") vem com "Cor:X;Tamanho:Y" embutido - e' dali que a gente tira cor
//   e tamanho de cada SKU, sem precisar de chamada extra.
// - GET /produtos/{id} (detalhe, UM produto por vez) traz "marca" (string, ex: "Reserva") no
//   nivel do produto-pai, e tambem devolve o array "variacoes" completo de novo - so' que
//   dessa vez com "midia.imagens.internas[].link" por SKU (a foto de verdade, ver abaixo).
// - Produtos com variacao de tamanho/cor viram varias linhas na lista (formato "S", todas
//   apontando pro mesmo idProdutoPai). O produto "pai" (formato "V") e' so' uma casca, sem
//   preco/estoque proprio.
// - Por isso: 1 chamada de detalhe por GRUPO de variacoes (nao por SKU) e' o suficiente pra
//   pegar a marca e as fotos - da' pra economizar bastante chamada num catalogo com milhares
//   de SKUs.
// - IMPORTANTE: o "imagemURL" que a lista (GET /produtos) devolve e' na verdade a MINIATURA
//   (~70x70px) e com validade de poucos MINUTOS - nao usamos mais esse campo. A foto de
//   verdade fica em data.midia.imagens.internas[] no endpoint de DETALHE (pode ter MAIS DE
//   UMA foto por cor - o array vem completo), com validade de dias. Cada variacao (SKU) do
//   detalhe tem a SUA PROPRIA midia - ou seja, cada COR pode ter fotos diferentes, e e' assim
//   que a gente monta a selecao de cor com carrossel de fotos correspondente no site. De
//   qualquer forma, seja qual for a validade, a URL do Bling expira em algum momento - as
//   fotos sao BAIXADAS aqui mesmo durante o sync e salvas em public/produtos/ (um arquivo por
//   FOTO, nome "<idGrupo>--<cor>--<indice>.jpg"), e o produtos.json guarda so' os caminhos
//   locais, que nao expiram nunca.
//
// Uso: npm run sync:bling                    -> roda o catalogo inteiro. Da segunda vez em
//        diante e' RAPIDO: so' busca marca/nome/foto de produto NOVO ou cor sem foto local
//        (preco/estoque/tamanho sempre atualizam, isso vem de graca na lista).
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
import sharp from "sharp";
import { listarProdutosBling, buscarProdutoDetalheBling } from "../lib/bling";
import {
  extrairCor,
  extrairTamanho,
  extrairTamanhoDoNomeProduto,
  limparNomeBase,
  tamanhosDisponiveisDaCor
} from "../lib/blingParse";

// Pasta publica do Next.js - tudo aqui dentro fica acessivel direto por URL (ex:
// public/produtos/123--branco.jpg vira https://.../produtos/123--branco.jpg).
const PASTA_IMAGENS = path.join(process.cwd(), "public", "produtos");
if (!existsSync(PASTA_IMAGENS)) mkdirSync(PASTA_IMAGENS, { recursive: true });

// Fotos ja baixadas em syncs anteriores (nome do arquivo = "<idGrupo>--<corSlug>--<indice>.jpg",
// uma por foto - cada cor pode ter varias) - usado pra NAO baixar de novo em toda
// sincronizacao, so' o que ainda falta. E' o que faz o sync do dia-a-dia ficar rapido
// depois da primeira carga completa.
const FOTOS_EXISTENTES = new Set(existsSync(PASTA_IMAGENS) ? readdirSync(PASTA_IMAGENS) : []);
// Todas as fotos ja baixadas de uma cor especifica, em ordem (0, 1, 2...).
function fotosLocaisDaCor(idBase: string): string[] {
  const prefixo = `${idBase}--`;
  return Array.from(FOTOS_EXISTENTES)
    .filter((nome) => nome.startsWith(prefixo))
    .sort((a, b) => {
      const numA = Number(a.slice(prefixo.length).split(".")[0]);
      const numB = Number(b.slice(prefixo.length).split(".")[0]);
      return numA - numB;
    })
    .map((nome) => `/produtos/${nome}`);
}

// Baixa a foto do S3 do Bling enquanto a URL assinada ainda e' valida, redimensiona e
// recomprime, e salva localmente em public/produtos/. Retorna o caminho local (pra guardar
// no produtos.json) ou null se falhar.
//
// As fotos originais do Bling vem PESADAS (as vezes 1-2MB, algumas em PNG - que nao
// comprime foto bem). Aqui a gente guarda um "mestre" em boa qualidade (nunca aumenta, so'
// diminui se for maior que 1600px de largura - da' resolucao de sobra ate' pra tela grande/
// retina - e recomprime como JPEG qualidade 85, que ainda e' bem nitido).
//
// A velocidade no MOSAICO (varios produtos na mesma tela) nao vem de degradar esse arquivo -
// vem do proprio Next.js: o componente <Image> do site pede uma qualidade BAIXA (60) so' pro
// card pequeno da vitrine (components/ProductCard.tsx) e ALTA (90) pra foto grande da pagina
// do produto (components/SeletorProduto.tsx), e o Next gera e serve automaticamente o
// tamanho certo pra cada caso a partir desse mesmo arquivo mestre - nao precisa guardar dois
// arquivos por foto.
async function baixarImagem(url: string, idArquivo: string): Promise<string | null> {
  try {
    const resposta = await fetch(url);
    if (!resposta.ok) return null;
    const bytesOriginais = Buffer.from(await resposta.arrayBuffer());
    const bytesOtimizados = await sharp(bytesOriginais)
      .resize({ width: 1600, withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();
    const nomeArquivo = `${idArquivo}.jpg`;
    writeFileSync(path.join(PASTA_IMAGENS, nomeArquivo), bytesOtimizados);
    return `/produtos/${nomeArquivo}`;
  } catch {
    return null;
  }
}

// Vira parte de nome de arquivo: sem acento, minusculo, so' letra/numero/hifen.
function corSlug(cor: string): string {
  const limpo = cor
    .normalize("NFD")
    .replace(new RegExp("[\\u0300-\\u036f]", "g"), "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-+|-+$)/g, "");
  return limpo || "unico";
}

// Cache do produtos.json da rodada anterior, indexado por id - usado pra pular a chamada de
// detalhe (marca/nome/descricao) em produtos que a gente ja processou antes. Marca e
// descricao praticamente nunca mudam depois de cadastradas, entao isso e' seguro e economiza
// a maior parte do tempo do sync no dia-a-dia (so' produto NOVO no Bling, ou sem foto ainda,
// precisa de chamada de detalhe).
type CacheProduto = { marca: string; nome: string; descricao: string; composicao?: string };
function carregarCache(): Map<string, CacheProduto> {
  const cache = new Map<string, CacheProduto>();
  try {
    const anterior = JSON.parse(readFileSync("data/produtos.json", "utf-8")) as Array<{
      id: string;
      nome: string;
      marca: string;
      descricao?: string;
      composicao?: string;
    }>;
    for (const p of anterior) {
      cache.set(p.id, { marca: p.marca, nome: p.nome, descricao: p.descricao ?? "", composicao: p.composicao });
    }
  } catch {
    // primeira vez rodando, ou arquivo corrompido - sem problema, so' processa tudo do zero
  }
  return cache;
}

// O Bling guarda a descricao do produto como HTML livre (o texto que o time digita na tela
// de cadastro) - aqui a gente tira as tags e sobra so' o texto corrido, pra exibir simples no
// site sem precisar renderizar HTML (e sem risco de HTML quebrado vindo do Bling).
function textoSemHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n")
    .split("\n")
    .map((linha) => linha.trim())
    .filter(Boolean)
    .join("\n")
    .trim();
}

// Best-effort: se o time escreveu uma linha tipo "Composição: 100% algodão" dentro da
// descricao do Bling, a gente extrai so' essa parte pra mostrar separada na pagina do
// produto. Se nao achar esse padrao, composicao fica undefined (a pagina mostra um aviso
// honesto em vez de inventar tecido - ver lib/detalhesProduto.ts).
function extrairComposicao(descricaoPlana: string): string | undefined {
  const m = descricaoPlana.match(/composi[cç][aã]o[:\s-]+([^\n]+)/i);
  return m ? m[1].trim() : undefined;
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
};

// Foto em resolucao de verdade, vinda do detalhe (GET /produtos/{id}) - ver comentario no
// topo do arquivo sobre a diferenca entre isso e a miniatura da lista.
type ImagemDetalheBling = { link?: string };
type VariacaoDetalheBling = {
  variacao?: { nome?: string };
  midia?: { imagens?: { internas?: ImagemDetalheBling[] } };
};
type DetalheBling = {
  data: {
    marca?: string;
    nome?: string;
    // nomes de campo nao confirmados 100% em producao (o sandbox aqui nao tem rede pra
    // testar contra a API real) - por isso tenta os dois nomes conhecidos da doc da API v3
    // do Bling; se nenhum vier preenchido, descricao so fica vazia (sem quebrar nada).
    descricaoCurta?: string;
    descricaoComplementar?: string;
    // midia do PRODUTO em si (nao de uma variacao especifica) - existe sempre, mas so' e'
    // usada como fallback (ver comentario onde e' lida abaixo).
    midia?: { imagens?: { internas?: ImagemDetalheBling[] } };
    variacoes?: VariacaoDetalheBling[];
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

// Decisao do Brunno em 23/08/2026: por enquanto o site trabalha SO' com essas 4 marcas -
// mesma lista de lib/produtos.ts (nao da' pra importar direto de la' porque esse script roda
// fora do Next.js). Produto de marca fora dessa lista e' pulado ANTES de baixar foto (a parte
// mais lenta do sync) - ainda gasta 1 chamada de detalhe pra produto NOVO (e' o unico jeito de
// descobrir a marca dele), mas produto ja conhecido do cache nem chega a chamar a API.
// Pra voltar a sincronizar alguma marca, e' so' adicionar ela aqui E em lib/produtos.ts.
const MARCAS_ATIVAS = new Set(["Animale", "NV", "Foxton", "Reserva"]);

type VarianteCorSaida = { cor: string; imagens: string[]; tamanhos: string[]; tamanhosDisponiveis: string[] };

type ProdutoSaida = {
  id: string;
  nome: string;
  marca: string;
  preco: number;
  novo: boolean;
  descricao: string;
  composicao?: string;
  cores: VarianteCorSaida[];
  imagem: string | null;
  temEstoque: boolean;
  gruposBlingPorTamanho?: Record<string, string[]>;
};

// Ordem de exibicao dos tamanhos-letra (numero e' sempre ordenado numericamente, nao precisa
// de lista) - usado so' na fusao abaixo, pra pecas fundidas mostrarem os tamanhos em ordem
// (PP, P, M...) em vez da ordem em que apareceram na lista do Bling.
const ORDEM_TAMANHOS_LETRA = ["PP", "P", "M", "G", "GG", "XG", "XGG", "XXG", "U"];
function compararTamanhos(a: string, b: string): number {
  const numA = Number(a);
  const numB = Number(b);
  if (!Number.isNaN(numA) && !Number.isNaN(numB)) return numA - numB;
  return ORDEM_TAMANHOS_LETRA.indexOf(a) - ORDEM_TAMANHOS_LETRA.indexOf(b);
}

// Funde produtos que sao a MESMA peca cadastrada como um produto-pai SEPARADO por tamanho no
// Bling (ver comentario completo em extrairTamanhoDoNomeProduto, lib/blingParse.ts). So' funde
// quando ha' 2+ produtos com a mesma marca+nome-base E cada um deles e' um produto "simples"
// (so' 1 cor) - produto com variacao de cor de verdade fica de fora por seguranca, e um nome
// sozinho no padrao (sem "irmao" de outro tamanho) fica como esta', com o sufixo no nome, ja
// que nao da' pra ter certeza se e' mesmo um tamanho isolado ou coincidencia.
function fundirVariantesPorTamanho(produtos: ProdutoSaida[]): ProdutoSaida[] {
  type Membro = ProdutoSaida & { _tamanho: string; _base: string };
  const grupos = new Map<string, Membro[]>();
  const resultado: ProdutoSaida[] = [];

  for (const p of produtos) {
    const extraido = p.cores.length === 1 ? extrairTamanhoDoNomeProduto(p.nome) : null;
    if (!extraido) {
      resultado.push(p);
      continue;
    }
    const chave = `${p.marca}||${extraido.base}`;
    if (!grupos.has(chave)) grupos.set(chave, []);
    grupos.get(chave)!.push({ ...p, _tamanho: extraido.tamanho, _base: extraido.base });
  }

  for (const membros of grupos.values()) {
    if (membros.length === 1) {
      const { _tamanho, _base, ...original } = membros[0];
      resultado.push(original);
      continue;
    }

    // o mesmo tamanho pode aparecer em MAIS DE UM membro (peca cadastrada em duplicidade no
    // Bling, visto em dados reais) - agrupa por tamanho antes de montar o produto final, pra
    // nao mostrar "36" duas vezes na lista de tamanhos.
    const porTamanho = new Map<string, Membro[]>();
    for (const m of membros) {
      if (!porTamanho.has(m._tamanho)) porTamanho.set(m._tamanho, []);
      porTamanho.get(m._tamanho)!.push(m);
    }

    const tamanhos = Array.from(porTamanho.keys()).sort(compararTamanhos);
    const tamanhosDisponiveis = tamanhos.filter((t) => porTamanho.get(t)!.some((m) => m.temEstoque));
    const gruposBlingPorTamanho: Record<string, string[]> = {};
    for (const [tamanho, ms] of porTamanho) gruposBlingPorTamanho[tamanho] = ms.map((m) => m.id);

    // preco: o da(s) unidade(s) realmente em estoque agora (menor valor, se houver mais de
    // um) - sem nada em estoque no momento, usa o menor preco entre todos mesmo assim (so'
    // pra ter um valor coerente caso volte a ter saldo antes do proximo sync).
    const precosEmEstoque = membros.filter((m) => m.temEstoque).map((m) => m.preco);
    const preco =
      precosEmEstoque.length > 0 ? Math.min(...precosEmEstoque) : Math.min(...membros.map((m) => m.preco));

    // imagem: usa a primeira que tiver foto de verdade (normalmente e' a mesma foto em todo
    // tamanho, ja que e' a mesma peca).
    const membroComFoto = membros.find((m) => m.cores[0]?.imagens.length > 0) ?? membros[0];
    const membroComDescricao = membros.find((m) => m.descricao) ?? membros[0];
    // id estavel: o menor id numerico entre os membros atuais - so' muda entre syncs se esse
    // tamanho especifico sair do catalogo (raro, e' um trade-off aceitavel dado que o Bling
    // nao tem um id "de verdade" pra peca fundida).
    const idEstavel = [...membros].sort((a, b) => Number(a.id) - Number(b.id))[0].id;

    resultado.push({
      id: idEstavel,
      nome: membros[0]._base,
      marca: membros[0].marca,
      preco,
      novo: false,
      descricao: membroComDescricao.descricao,
      composicao: membroComDescricao.composicao,
      cores: [
        {
          cor: "Único",
          imagens: membroComFoto.cores[0]?.imagens ?? [],
          tamanhos,
          tamanhosDisponiveis
        }
      ],
      imagem: membroComFoto.cores[0]?.imagens[0] ?? null,
      temEstoque: membros.some((m) => m.temEstoque),
      gruposBlingPorTamanho
    });
  }

  return resultado;
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
  console.log("Processando produtos (marca/foto so' quando necessario - pode demorar na primeira vez)...");

  const produtosMapeados: ProdutoSaida[] = [];

  let processados = 0;
  let semMarca = 0;
  let novos = 0;
  let fotosBaixadasAgora = 0;
  let fotosReaproveitadas = 0;
  let marcasFiltradas = 0; // produtos pulados por serem de marca fora de MARCAS_ATIVAS

  for (const [chaveGrupo, skus] of entradas) {
    processados++;
    const idStr = String(chaveGrupo);
    let nomeBase = limparNomeBase(skus[0].nome);

    // cada SKU da lista ja traz "Cor:X;Tamanho:Y" no nome - agrupa por cor sem precisar de
    // chamada extra. Produto sem cor cadastrada cai tudo numa cor so' ("Único").
    const skusComCorTamanho = skus.map((sku) => ({
      sku,
      cor: extrairCor(sku.nome) ?? "Único",
      tamanho: extrairTamanho(sku.nome)
    }));
    const coresUnicas = Array.from(new Set(skusComCorTamanho.map((s) => s.cor)));

    const doCache = cache.get(idStr);

    // ja tem foto(s) local(is) dessa cor (de um sync anterior)? guarda o que ja existe e so'
    // marca como "falta" quem realmente falta (ou tudo, se --forcar-fotos).
    const imagensPorCor = new Map<string, string[]>();
    for (const cor of coresUnicas) {
      const existentes = !forcarFotos ? fotosLocaisDaCor(`${idStr}--${corSlug(cor)}`) : [];
      if (existentes.length > 0) {
        imagensPorCor.set(cor, existentes);
        fotosReaproveitadas += existentes.length;
      }
    }
    const coresSemFoto = coresUnicas.filter((cor) => !imagensPorCor.has(cor));

    // so' chama o detalhe (mais lento - 1 chamada por produto) quando falta marca/nome no
    // cache OU falta foto local de alguma cor - as duas coisas vem do mesmo endpoint.
    const precisaDetalhe = !doCache || coresSemFoto.length > 0;

    // Fora da lista de marcas ativas (produto ja conhecido do cache)? pula sem nem chamar a
    // API - nao precisa gastar chamada de detalhe pra confirmar marca que a gente ja sabe.
    if (doCache && !MARCAS_ATIVAS.has(doCache.marca)) {
      marcasFiltradas++;
      continue;
    }

    let marcaFinal: string;
    let descricaoFinal = doCache?.descricao ?? "";
    let composicaoFinal = doCache?.composicao;
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

        // produto NOVO de marca fora da lista ativa: agora que a gente sabe a marca, pula
        // ANTES de baixar qualquer foto (a parte lenta) - so' a chamada de detalhe acima (que
        // era o unico jeito de descobrir a marca) foi gasta.
        const marcaNormalizadaAgora = marcaJaNormalizada ? marca : normalizarMarca(marca);
        if (!MARCAS_ATIVAS.has(marcaNormalizadaAgora)) {
          marcasFiltradas++;
          await dormir(PAUSA_ENTRE_CHAMADAS_MS);
          continue;
        }

        const descricaoHtml = detalhe.data.descricaoCurta || detalhe.data.descricaoComplementar || "";
        if (descricaoHtml) {
          descricaoFinal = textoSemHtml(descricaoHtml);
          composicaoFinal = extrairComposicao(descricaoFinal) ?? composicaoFinal;
        }
        // monta cor -> LINKS de foto (pode ser mais de uma por cor - o Bling deixa cadastrar
        // varias fotos da mesma peca/cor) usando as variacoes do PROPRIO detalhe (cada uma
        // tem sua midia) - so' baixa quem realmente falta. Produto SEM variacao de tamanho/
        // cor (SKU unico, comum em marcas menores como a NV) as vezes nao devolve "variacoes"
        // nenhuma no detalhe - nesse caso cai no fallback da midia do produto em si (mesmo
        // campo, um nivel acima). E' esse fallback que faltava e deixava produto sem foto
        // mesmo quando ela existia no Bling.
        const variacoesDetalhe = detalhe.data.variacoes ?? [];
        const linksFallbackProduto = (detalhe.data.midia?.imagens?.internas ?? [])
          .map((im) => im.link)
          .filter((l): l is string => !!l);
        for (const cor of coresSemFoto) {
          const match = variacoesDetalhe.find((v) => {
            const corDaVariacao = extrairCor(v.variacao?.nome ?? "") ?? "Único";
            return corDaVariacao === cor;
          });
          const linksVariacao = (match?.midia?.imagens?.internas ?? [])
            .map((im) => im.link)
            .filter((l): l is string => !!l);
          const links = linksVariacao.length > 0 ? linksVariacao : linksFallbackProduto;

          const caminhosBaixados: string[] = [];
          for (let i = 0; i < links.length; i++) {
            const caminho = await baixarImagem(links[i], `${idStr}--${corSlug(cor)}--${i}`);
            if (caminho) caminhosBaixados.push(caminho);
          }
          if (caminhosBaixados.length > 0) {
            imagensPorCor.set(cor, caminhosBaixados);
            fotosBaixadasAgora += caminhosBaixados.length;
          }
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

    // rede de seguranca: cobre o caso raro de erro na chamada de detalhe (bloco catch acima)
    // deixando marcaFinal como "Sem marca" pra um produto novo - nao entra no catalogo do
    // site de qualquer forma, entao nem vale a pena montar cores/imagem pra ele.
    if (!MARCAS_ATIVAS.has(marcaFinal)) {
      marcasFiltradas++;
      continue;
    }

    // monta a lista final de cores com tamanhos + fotos - cor com foto vem primeiro, pra foto
    // de capa (card de vitrine) ser sempre de uma cor que tem foto quando possivel.
    const cores: VarianteCorSaida[] = coresUnicas
      .map((cor) => {
        const tamanhosCor = Array.from(
          new Set(
            skusComCorTamanho
              .filter((s) => s.cor === cor)
              .map((s) => s.tamanho)
              .filter((t): t is string => !!t)
          )
        );
        return {
          cor,
          imagens: imagensPorCor.get(cor) ?? [],
          tamanhos: tamanhosCor.length > 0 ? tamanhosCor : ["Único"],
          // quais desses tamanhos tem saldo em estoque AGORA - usado pra desabilitar tamanho
          // esgotado no site em vez de deixar o cliente escolher e so' descobrir no checkout.
          tamanhosDisponiveis: tamanhosDisponiveisDaCor(cor, skus)
        };
      })
      .sort((a, b) => (a.imagens.length > 0 ? 0 : 1) - (b.imagens.length > 0 ? 0 : 1));

    const temEstoque = skus.some((s) => (s.estoque?.saldoVirtualTotal ?? 0) > 0);
    const imagemCapa = cores.find((c) => c.imagens.length > 0)?.imagens[0] ?? null;

    produtosMapeados.push({
      id: idStr,
      nome: nomeBase,
      marca: marcaFinal,
      preco: skus[0].preco,
      novo: false,
      descricao: descricaoFinal,
      composicao: composicaoFinal,
      cores,
      imagem: imagemCapa,
      temEstoque
    });

    if (processados % 100 === 0) {
      console.log(`  ${processados}/${entradas.length} processados...`);
    }
  }

  // PASSO EXTRA (24/08/2026): funde produtos que na verdade sao a MESMA peca cadastrada como
  // um produto-pai SEPARADO por tamanho no Bling (ver comentario completo em
  // extrairTamanhoDoNomeProduto, lib/blingParse.ts) - reconhece pelo nome, nao mexe em nada
  // do lado do Bling.
  const produtosFinais = fundirVariantesPorTamanho(produtosMapeados);
  const qtdFundidos = produtosMapeados.length - produtosFinais.length;

  writeFileSync("data/produtos.json", JSON.stringify(produtosFinais, null, 2));
  const comFoto = produtosFinais.filter((p) => p.imagem).length;
  const totalCores = produtosFinais.reduce((soma, p) => soma + p.cores.length, 0);
  console.log(`\nPronto! data/produtos.json atualizado com ${produtosFinais.length} produtos.`);
  console.log(
    `Fora do catalogo por marca (so' trabalhamos com ${Array.from(MARCAS_ATIVAS).join(", ")} por` +
      ` enquanto): ${marcasFiltradas} produto(s).`
  );
  console.log(`Produtos novos (buscaram marca na API agora): ${novos}.`);
  console.log(
    `Pecas fundidas (cadastradas como produto separado por tamanho no Bling, unificadas aqui): ` +
      `${qtdFundidos} produto(s) a menos no catalogo final.`
  );
  console.log(`Variacoes de cor no total: ${totalCores}.`);
  console.log(
    `Fotos: ${comFoto} de ${produtosFinais.length} produtos com pelo menos uma foto` +
      ` (${fotosBaixadasAgora} foto(s) baixada(s) agora, ${fotosReaproveitadas} reaproveitada(s) de antes).`
  );
  if (semMarca > 0) {
    console.log(`Atencao: ${semMarca} produto(s) ficaram sem marca identificada - revisar manualmente no arquivo.`);
  }

  const marcas = Array.from(new Set(produtosFinais.map((p) => p.marca))).sort();
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

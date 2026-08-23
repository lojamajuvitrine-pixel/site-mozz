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
//   verdade fica em data.midia.imagens.internas[].link no endpoint de DETALHE, com validade
//   de dias. Cada variacao (SKU) do detalhe tem a SUA PROPRIA midia - ou seja, cada COR pode
//   ter uma foto diferente, e e' assim que a gente monta a selecao de cor com foto
//   correspondente no site. De qualquer forma, seja qual for a validade, a URL do Bling
//   expira em algum momento - a foto e' BAIXADA aqui mesmo durante o sync e salva em
//   public/produtos/ (um arquivo por COR, nome "<idGrupo>--<cor>.ext"), e o produtos.json
//   guarda so' o caminho local, que nao expira nunca.
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

// Pasta publica do Next.js - tudo aqui dentro fica acessivel direto por URL (ex:
// public/produtos/123--branco.jpg vira https://.../produtos/123--branco.jpg).
const PASTA_IMAGENS = path.join(process.cwd(), "public", "produtos");
if (!existsSync(PASTA_IMAGENS)) mkdirSync(PASTA_IMAGENS, { recursive: true });

// Fotos ja baixadas em syncs anteriores (nome do arquivo = "<idGrupo>--<corSlug>.<extensao>")
// - usado pra NAO baixar de novo em toda sincronizacao, so' o que ainda falta. E' o que faz
// o sync do dia-a-dia ficar rapido depois da primeira carga completa.
const FOTOS_EXISTENTES = new Set(existsSync(PASTA_IMAGENS) ? readdirSync(PASTA_IMAGENS) : []);
function fotoLocalExistente(idArquivo: string): string | null {
  const achado = Array.from(FOTOS_EXISTENTES).find((nome) => nome.startsWith(`${idArquivo}.`));
  return achado ? `/produtos/${achado}` : null;
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

function extrairTamanho(nome: string): string | null {
  const m = nome.match(/Tamanho:\s*([^;]+)/i);
  return m ? m[1].trim() : null;
}

function extrairCor(nome: string): string | null {
  const m = nome.match(/Cor:\s*([^;]+)/i);
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

type VarianteCorSaida = { cor: string; imagem: string | null; tamanhos: string[] };

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

  const produtosMapeados: Array<{
    id: string;
    nome: string;
    marca: string;
    preco: number;
    novo: boolean;
    descricao: string;
    cores: VarianteCorSaida[];
    imagem: string | null;
    temEstoque: boolean;
  }> = [];

  let processados = 0;
  let semMarca = 0;
  let novos = 0;
  let fotosBaixadasAgora = 0;
  let fotosReaproveitadas = 0;

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

    // ja tem foto local dessa cor (de um sync anterior)? guarda o que ja existe e so' marca
    // como "falta" quem realmente falta (ou tudo, se --forcar-fotos).
    const imagensPorCor = new Map<string, string | null>();
    for (const cor of coresUnicas) {
      const existente = !forcarFotos ? fotoLocalExistente(`${idStr}--${corSlug(cor)}`) : null;
      if (existente) {
        imagensPorCor.set(cor, existente);
        fotosReaproveitadas++;
      }
    }
    const coresSemFoto = coresUnicas.filter((cor) => !imagensPorCor.has(cor));

    // so' chama o detalhe (mais lento - 1 chamada por produto) quando falta marca/nome no
    // cache OU falta foto local de alguma cor - as duas coisas vem do mesmo endpoint.
    const precisaDetalhe = !doCache || coresSemFoto.length > 0;

    let marcaFinal: string;
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
        // monta cor -> link de foto usando as variacoes do PROPRIO detalhe (cada uma tem sua
        // midia) - so' baixa quem realmente falta. Produto SEM variacao de tamanho/cor (SKU
        // unico, comum em marcas menores como a NV) as vezes nao devolve "variacoes" nenhuma
        // no detalhe - nesse caso cai no fallback da midia do produto em si (mesmo campo,
        // um nivel acima). E' esse fallback que faltava e deixava produto sem foto mesmo
        // quando ela existia no Bling.
        const variacoesDetalhe = detalhe.data.variacoes ?? [];
        const linkFallbackProduto = detalhe.data.midia?.imagens?.internas?.[0]?.link;
        for (const cor of coresSemFoto) {
          const match = variacoesDetalhe.find((v) => {
            const corDaVariacao = extrairCor(v.variacao?.nome ?? "") ?? "Único";
            return corDaVariacao === cor && v.midia?.imagens?.internas?.[0]?.link;
          });
          const link = match?.midia?.imagens?.internas?.[0]?.link ?? linkFallbackProduto;
          if (link) {
            const caminho = await baixarImagem(link, `${idStr}--${corSlug(cor)}`);
            if (caminho) {
              imagensPorCor.set(cor, caminho);
              fotosBaixadasAgora++;
            }
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

    // monta a lista final de cores com tamanhos + foto - cor com foto vem primeiro, pra foto
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
          imagem: imagensPorCor.get(cor) ?? null,
          tamanhos: tamanhosCor.length > 0 ? tamanhosCor : ["Único"]
        };
      })
      .sort((a, b) => (a.imagem ? 0 : 1) - (b.imagem ? 0 : 1));

    const temEstoque = skus.some((s) => (s.estoque?.saldoVirtualTotal ?? 0) > 0);
    const imagemCapa = cores.find((c) => c.imagem)?.imagem ?? null;

    produtosMapeados.push({
      id: idStr,
      nome: nomeBase,
      marca: marcaFinal,
      preco: skus[0].preco,
      novo: false,
      descricao: "",
      cores,
      imagem: imagemCapa,
      temEstoque
    });

    if (processados % 100 === 0) {
      console.log(`  ${processados}/${entradas.length} processados...`);
    }
  }

  writeFileSync("data/produtos.json", JSON.stringify(produtosMapeados, null, 2));
  const comFoto = produtosMapeados.filter((p) => p.imagem).length;
  const totalCores = produtosMapeados.reduce((soma, p) => soma + p.cores.length, 0);
  console.log(`\nPronto! data/produtos.json atualizado com ${produtosMapeados.length} produtos.`);
  console.log(`Produtos novos (buscaram marca na API agora): ${novos}.`);
  console.log(`Variacoes de cor no total: ${totalCores}.`);
  console.log(
    `Fotos: ${comFoto} de ${produtosMapeados.length} produtos com pelo menos uma foto` +
      ` (${fotosBaixadasAgora} foto(s) baixada(s) agora, ${fotosReaproveitadas} reaproveitada(s) de antes).`
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

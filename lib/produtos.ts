import { cache } from "react";
import produtosData from "@/data/produtos.json";
import { categoriaDoProduto } from "@/lib/detalhesProduto";
import { buscarConfigProdutos, type ConfigProduto } from "@/lib/produtoConfig";

// Uma variacao de COR do produto - cada cor tem suas proprias fotos (pode ser mais de uma,
// quando cadastradas no Bling) e sua propria lista de tamanhos disponiveis.
export type VarianteCor = {
  cor: string;
  // caminhos locais dentro de public/produtos/ (ex: "/produtos/123--branco--0.jpg"),
  // baixados durante o sync - NAO e' a URL do Bling, que expira. Array vazio quando essa
  // cor nao tem foto cadastrada no Bling.
  imagens: string[];
  // TODOS os tamanhos ja cadastrados dessa cor no Bling, com ou sem saldo agora.
  tamanhos: string[];
  // subconjunto de "tamanhos" que tem saldo em estoque no momento do ultimo sync - opcional
  // por compatibilidade com dado antigo (sync anterior a esse controle); nesse caso o site
  // trata ausencia como "todos disponiveis" (ver tamanhosDisponiveisDoColor abaixo).
  tamanhosDisponiveis?: string[];
};

// Sempre usar isso (em vez de cor.tamanhosDisponiveis direto) pra saber quais tamanhos de
// uma cor ainda podem ser comprados - cobre o caso de dado de um sync anterior a esse
// controle (sem o campo), assumindo "todos disponiveis" em vez de quebrar/esconder tudo.
export function tamanhosDisponiveisDoColor(cor: VarianteCor): string[] {
  return cor.tamanhosDisponiveis ?? cor.tamanhos;
}

// Ordem "natural" de tamanho (numero em ordem numerica, letra na ordem de tamanho real) -
// o Bling nao garante nenhuma ordem no cadastro (normalmente e' ordem de criacao do SKU), e
// sem isso os tamanhos apareciam fora de ordem tanto no seletor da pagina do produto quanto
// no card da vitrine (ex: "GG, P, 38, M, 36" em vez de "P, M, GG" ou "36, 38"). Bug reportado
// pelo Brunno em 25/08/2026 - corrigido AQUI (uma vez so', no catalogo) em vez de em cada
// componente que exibe tamanho, pra cobrir SeletorProduto, ProductCard e o filtro do
// GradeProdutos de uma vez. Cobre as variacoes de grafia reais encontradas no catalogo
// (ex: "3G"/"GGg" como sinonimos de "GGG", "Unico" sem acento) alem da lista padrao.
const ORDEM_TAMANHO_LETRA = ["PP", "P", "M", "G", "GG", "GGG", "3G", "XG", "XGG", "XXG", "U", "UNICO", "ÚNICO"];
export function compararTamanhos(a: string, b: string): number {
  const numA = Number(a);
  const numB = Number(b);
  if (!Number.isNaN(numA) && !Number.isNaN(numB) && a.trim() !== "" && b.trim() !== "") {
    return numA - numB;
  }
  const posA = ORDEM_TAMANHO_LETRA.indexOf(a.toUpperCase());
  const posB = ORDEM_TAMANHO_LETRA.indexOf(b.toUpperCase());
  if (posA !== -1 && posB !== -1) return posA - posB;
  if (posA !== -1) return -1; // tamanho conhecido vem antes de um rotulo estranho/nao mapeado
  if (posB !== -1) return 1;
  return a.localeCompare(b);
}

function ordenarTamanhosDoProduto(produto: Produto): Produto {
  if (!produto.cores || produto.cores.length === 0) return produto;
  return {
    ...produto,
    cores: produto.cores.map((cor) => ({
      ...cor,
      tamanhos: [...cor.tamanhos].sort(compararTamanhos),
      tamanhosDisponiveis: cor.tamanhosDisponiveis
        ? [...cor.tamanhosDisponiveis].sort(compararTamanhos)
        : undefined
    }))
  };
}

// Devolve o id do produto NO BLING (numerico) que corresponde a um tamanho especifico -
// necessario pra criar o pedido de venda no Bling (ver lib/mercadopago.ts e o webhook do
// Mercado Pago) porque produtos "fundidos" no sync (ver gruposBlingPorTamanho em
// lib/blingParse.ts) nao tem mais um produto.id proprio por tamanho: o produto.id do site e'
// so' um id "representante" do grupo fundido. Pra peca NAO fundida (sem gruposBlingPorTamanho),
// produto.id ja e' o id real do Bling. Resolvido no momento da compra (nao no webhook, que
// pode rodar bem depois) pra garantir que o pedido no Bling aponta pro produto certo mesmo se
// o catalogo mudar entre a compra e a confirmacao do pagamento.
export function resolverProdutoIdBling(produto: Produto, tamanho: string): number {
  const idsDoTamanho = produto.gruposBlingPorTamanho?.[tamanho];
  const idBruto = idsDoTamanho && idsDoTamanho.length > 0 ? idsDoTamanho[0] : produto.id;
  const id = Number(idBruto);
  if (!Number.isFinite(id)) {
    throw new Error(`Nao foi possivel resolver o id Bling do produto ${produto.id} (tamanho ${tamanho})`);
  }
  return id;
}

export type Produto = {
  id: string;
  nome: string;
  marca: string;
  preco: number;
  novo: boolean;
  descricao: string;
  // extraida (quando possivel) da propria descricao do Bling durante o sync - ver
  // lib/detalhesProduto.ts pra como isso e' usado (com fallback quando ausente).
  composicao?: string;
  // opcional por compatibilidade com data/produtos.json de um sync antigo (antes do suporte
  // a cor) - o codigo que le isso sempre trata ausencia/vazio com um fallback pra "Unico".
  cores?: VarianteCor[];
  // foto de capa pra vitrine/card (normalmente a foto da primeira cor que tiver foto) -
  // continua existindo pra nao precisar mexer no ProductCard.
  imagem: string | null;
  // presente so' em produtos vindos do sync real do Bling (scripts/sync-bling.ts) - indica
  // se ALGUM tamanho/cor tem saldo em estoque. Produtos do seed manual nao tem esse campo.
  temEstoque?: boolean;
  // So' presente em produtos "fundidos" no sync - varios produtos-pai do Bling que na
  // verdade sao a MESMA peca, um produto por tamanho (ver extrairTamanhoDoNomeProduto em
  // lib/blingParse.ts). Mapeia cada tamanho pros id(s) do(s) grupo(s) Bling ORIGINAIS que o
  // representam (pode ser mais de um id pro mesmo tamanho, quando a peca foi cadastrada em
  // duplicidade no Bling) - e' assim que scripts/sync-estoque.ts sabe onde buscar o
  // saldo/preco atualizado de cada tamanho, ja que nao existe mais um produto.id proprio por
  // tamanho depois da fusao.
  gruposBlingPorTamanho?: Record<string, string[]>;
  // Preco de venda ORIGINAL do Bling - so' vem preenchido quando "preco" acima foi
  // substituido por um preco especial cadastrado no painel /admin/produtos (ver
  // lib/produtoConfig.ts). Usado pra mostrar o "de/por" riscado no card e na pagina do
  // produto. Ausente = "preco" ja e' o preco normal do Bling, sem oferta ativa.
  precoOriginal?: number;
  // Configs "so' do site" (painel /admin/produtos), sem nada equivalente no Bling.
  destaque?: boolean;
  outlet?: boolean;
};

// Decisao do Brunno em 23/08/2026: por enquanto o site trabalha SO' com essas 4 marcas
// (as "principais" do portfolio) - as marcas menores (Slywear, Puramania, Iodice, My Place,
// Open, Ents, etc.) ficam de fora do catalogo publico ate' segunda ordem, mesmo que ja
// tenham produtos sincronizados do Bling em data/produtos.json. Pra voltar a mostrar
// alguma marca, e' so' adicionar ela nessa lista - nao precisa rodar sync de novo.
const MARCAS_ATIVAS = new Set(["Animale", "NV", "Foxton", "Reserva"]);

// Busca as configs especiais (preco/destaque/outlet) UMA vez por requisicao - React cache()
// dedupe chamadas identicas dentro do mesmo ciclo de renderizacao no servidor, entao mesmo
// chamando listarProdutos() varias vezes numa mesma pagina (ex: a home chama listarPorMarca
// quatro vezes) so' bate no Supabase uma unica vez.
const buscarConfigProdutosCache = cache(buscarConfigProdutos);

function aplicarConfigEspecial(produto: Produto, config: ConfigProduto | undefined): Produto {
  if (!config) return produto;
  const comFlags: Produto = { ...produto, destaque: config.destaque, outlet: config.outlet };
  if (config.precoEspecial !== null && config.precoEspecial !== produto.preco) {
    return { ...comFlags, preco: config.precoEspecial, precoOriginal: produto.preco };
  }
  return comFlags;
}

// Fonte de dados hoje: data/produtos.json (seed manual, so' pra desenvolvimento).
// Em producao, npm run sync:bling sobrescreve esse arquivo com o catalogo real do Bling.
//
// Produtos com temEstoque === false (confirmado sem saldo em nenhum tamanho, campo so'
// existe em produtos vindos do sync real) ficam FORA do catalogo publico - decisao do
// Brunno em 22/08/2026, pra nao mostrar peca que o cliente nao consegue comprar. Produtos
// do seed manual (sem esse campo, undefined) continuam aparecendo normalmente.
//
// Produto SEM NENHUMA foto (p.imagem null - nenhuma cor tem foto cadastrada no Bling) tambem
// fica FORA do catalogo publico por padrao - decisao do Brunno em 25/08/2026: peca sem foto
// nao vende e passa impressao ruim, entao fica desativada ate' alguem subir a foto no Bling
// (proximo sync ja reativa sozinho, sem precisar mexer em nada aqui - e' so' um filtro sobre
// o dado atual, nao uma flag manual). Passe { incluirSemFoto: true } pra ver TODOS os
// produtos mesmo sem foto - usado so' no painel /admin/produtos, pra poder preparar preco
// especial/destaque/outlet ANTES da foto existir.
//
// Async desde 23/08/2026: alem do catalogo estatico do Bling, aplica por cima as configs
// especiais so' do site (preco especial/destaque/outlet, cadastradas em /admin/produtos e
// guardadas no Supabase) - ver lib/produtoConfig.ts. Se o Supabase estiver fora do ar ou sem
// nenhuma config cadastrada, o catalogo continua funcionando normal com o preco do Bling.
export async function listarProdutos(opcoes?: { incluirSemFoto?: boolean }): Promise<Produto[]> {
  const config = await buscarConfigProdutosCache();
  const produtos = (produtosData as Produto[])
    .filter((p) => p.temEstoque !== false && MARCAS_ATIVAS.has(p.marca))
    .filter((p) => opcoes?.incluirSemFoto || !!p.imagem)
    .map((p) => aplicarConfigEspecial(p, config.get(p.id)))
    .map(ordenarTamanhosDoProduto);
  // prioriza quem tem foto - so' importa mais quando incluirSemFoto=true (no catalogo publico
  // normal ninguem mais chega aqui sem foto); sort e' estavel, entao dentro de cada grupo a
  // ordem original do Bling e' mantida.
  return [...produtos].sort((a, b) => (a.imagem ? 0 : 1) - (b.imagem ? 0 : 1));
}

export async function listarPorMarca(marca: string): Promise<Produto[]> {
  const produtos = await listarProdutos();
  return produtos.filter((p) => p.marca.toLowerCase() === marca.toLowerCase());
}

export async function buscarProduto(id: string): Promise<Produto | undefined> {
  const produtos = await listarProdutos();
  return produtos.find((p) => p.id === id);
}

export async function marcasDisponiveis(): Promise<string[]> {
  const produtos = await listarProdutos();
  return Array.from(new Set(produtos.map((p) => p.marca)));
}

// So' os produtos que tem foto - usado nas vitrines de destaque (home) pra nao mostrar o
// placeholder "foto do produto" logo na entrada do site. O catalogo completo (/produtos)
// continua mostrando todo mundo, com ou sem foto.
export async function produtosComFoto(): Promise<Produto[]> {
  const produtos = await listarProdutos();
  return produtos.filter((p) => !!p.imagem);
}

// Pecas marcadas como "outlet" no painel /admin/produtos - aparecem na aba /outlet, ALEM de
// continuarem aparecendo normalmente na marca/catalogo de origem (outlet e' uma curadoria
// cruzada, nao uma remocao).
export async function listarOutlet(): Promise<Produto[]> {
  const produtos = await listarProdutos();
  return produtos.filter((p) => p.outlet);
}

// Pecas marcadas como "destaque" no painel /admin/produtos - usado pra priorizar a vitrine
// "Novidades" da home (ver app/page.tsx) em vez do fallback automatico (so' foto + ordem do
// Bling).
export async function listarDestaques(): Promise<Produto[]> {
  const produtos = await listarProdutos();
  return produtos.filter((p) => p.destaque);
}

// Sempre usar isso (em vez de produto.cores direto) pra ler as cores de um produto - cobre
// o caso de dado antigo (sync anterior ao suporte a cor) devolvendo um "Unico" de fallback
// com a foto/tamanhos que ja existiam antes.
// "Quem viu tambem gostou" - produtos da mesma categoria de peca (blusa, calca, vestido...)
// e prioriza a mesma marca primeiro, com foto, excluindo o produto atual. Categoria e'
// inferida pelo nome (ver lib/detalhesProduto.ts) ja que o Bling nao devolve categoria
// utilizavel sem chamada extra por produto.
export async function produtosRelacionados(produto: Produto, quantidade = 8): Promise<Produto[]> {
  const categoriaAtual = categoriaDoProduto(produto.nome);
  const todos = await listarProdutos();
  const candidatos = todos.filter((p) => p.id !== produto.id && !!p.imagem);

  const mesmaCategoria = candidatos.filter((p) => categoriaDoProduto(p.nome) === categoriaAtual);
  const mesmaMarcaPrimeiro = [
    ...mesmaCategoria.filter((p) => p.marca === produto.marca),
    ...mesmaCategoria.filter((p) => p.marca !== produto.marca)
  ];

  if (mesmaMarcaPrimeiro.length >= quantidade) return mesmaMarcaPrimeiro.slice(0, quantidade);

  // nao teve o suficiente na mesma categoria - completa com outros produtos da mesma marca
  const jaEscolhidos = new Set(mesmaMarcaPrimeiro.map((p) => p.id));
  const complemento = candidatos.filter((p) => p.marca === produto.marca && !jaEscolhidos.has(p.id));
  return [...mesmaMarcaPrimeiro, ...complemento].slice(0, quantidade);
}

export function coresDoProduto(produto: Produto): VarianteCor[] {
  if (produto.cores && produto.cores.length > 0) return produto.cores;
  const legado = produto as unknown as { tamanhos?: string[] };
  const tamanhos = legado.tamanhos && legado.tamanhos.length > 0 ? legado.tamanhos : ["Único"];
  return [
    {
      cor: "Único",
      imagens: produto.imagem ? [produto.imagem] : [],
      tamanhos,
      tamanhosDisponiveis: tamanhos
    }
  ];
}

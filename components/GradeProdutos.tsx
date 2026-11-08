"use client";

import { useEffect, useMemo, useState } from "react";
import ProductCard from "./ProductCard";
import { coresDoProduto, tamanhosDisponiveisDoColor, compararTamanhos, type Produto } from "@/lib/produtos";
import { normalizarTexto } from "@/lib/cor";
import { categoriaDoProduto, CATEGORIA_OUTRAS } from "@/lib/categorias";
import { familiasDaCor, FAMILIA_ESTAMPADO, FAMILIA_OUTRAS } from "@/lib/coresFiltro";

type Ordenacao = "relevancia" | "menor-preco" | "maior-preco";
// Quantas colunas por linha no desktop - pedido do Brunno em 27/09/2026, inspirado no seletor
// de densidade que a Animale usa. No celular continua sempre 2 colunas.
type Densidade = 4 | 6;

// Quantidade de pecas mostradas por vez - o resto so' aparece clicando "Carregar mais pecas"
// (Core Web Vitals, auditoria de UX de 29/08/2026). Filtro/busca/ordenacao rodam sobre a lista
// INTEIRA - so' o que e' EXIBIDO e' limitado.
const QUANTIDADE_POR_PAGINA = 24;

// ---------------------------------------------------------------------------------------------
// Filtros da vitrine (pacote 2, aprovado pelo Brunno em 07/11/2026): coluna fixa a' esquerda no
// computador e painel que abre pela esquerda no celular (botao "Filtrar"), com MARCA, CATEGORIA,
// TAMANHO e COR - varias opcoes marcaveis em cada um, cada opcao com a quantidade de pecas.
// A quantidade de cada opcao considera os OUTROS filtros ja' marcados (ex.: com "Animale"
// marcado, "Vestidos (28)" conta so' vestidos Animale) - assim nunca aparece opcao que leva a
// lista vazia sem avisar.
//
// COR volta agrupada por familia (o filtro de cor tinha saido em 27/09 porque o Bling tem 100+
// nomes de cor) - regras em lib/coresFiltro.ts. Com filtro de cor marcado, o card ja' abre na
// foto da cor que bateu (corInicial do ProductCard).
// ---------------------------------------------------------------------------------------------

type Filtros = {
  marcas: string[];
  categorias: string[];
  tamanhos: string[];
  cores: string[];
};

type Faceta = keyof Filtros;

const FILTROS_VAZIOS: Filtros = { marcas: [], categorias: [], tamanhos: [], cores: [] };

// Ordem e bolinha de cor de cada familia no filtro.
const FAMILIAS: Array<{ nome: string; amostra: string }> = [
  { nome: "Preto", amostra: "#111111" },
  { nome: "Branco", amostra: "#ffffff" },
  { nome: "Cinza", amostra: "#8a8a86" },
  { nome: "Bege", amostra: "#d8c9ae" },
  { nome: "Marrom", amostra: "#5c4230" },
  { nome: "Azul", amostra: "#2f4a7a" },
  { nome: "Verde", amostra: "#3d5c34" },
  { nome: "Vermelho", amostra: "#a02020" },
  { nome: "Vinho", amostra: "#5c1f2a" },
  { nome: "Rosa", amostra: "#d99aa8" },
  { nome: "Roxo", amostra: "#5c4478" },
  { nome: "Amarelo", amostra: "#d8b84a" },
  { nome: "Laranja", amostra: "#c9702f" },
  { nome: "Dourado/Prata", amostra: "linear-gradient(135deg, #b8963f 50%, #b7b7b2 50%)" },
  { nome: FAMILIA_ESTAMPADO, amostra: "conic-gradient(#d99aa8, #d8b84a, #3d5c34, #2f4a7a, #d99aa8)" },
  { nome: FAMILIA_OUTRAS, amostra: "#c7c6c0" }
];
const ORDEM_FAMILIA = new Map(FAMILIAS.map((f, i) => [f.nome, i]));
const AMOSTRA_FAMILIA = new Map(FAMILIAS.map((f) => [f.nome, f.amostra]));

// Resumo de cada peca calculado uma vez so' (a contagem de cada opcao roda o filtro varias vezes).
type Variante = { cor: string; familias: string[]; tamanhos: string[] };
type PecaResumo = { produto: Produto; categoria: string; variantes: Variante[] };

function resumir(produto: Produto): PecaResumo {
  const variantes = coresDoProduto(produto)
    .map((cor) => ({
      cor: cor.cor,
      familias: familiasDaCor(cor.cor, produto.nome, produto.marca),
      tamanhos: tamanhosDisponiveisDoColor(cor)
    }))
    .filter((variante) => variante.tamanhos.length > 0);
  return { produto, categoria: categoriaDoProduto(produto), variantes };
}

// Tamanho e cor sao conferidos na MESMA cor da peca: "Azul" + "M" so' passa se a peca tem M
// disponivel na cor azul (e nao azul no P e M so' no preto).
function passa(peca: PecaResumo, filtros: Filtros, ignorar?: Faceta): boolean {
  if (ignorar !== "marcas" && filtros.marcas.length > 0 && !filtros.marcas.includes(peca.produto.marca)) return false;
  if (ignorar !== "categorias" && filtros.categorias.length > 0 && !filtros.categorias.includes(peca.categoria)) {
    return false;
  }
  const usaTamanho = ignorar !== "tamanhos" && filtros.tamanhos.length > 0;
  const usaCor = ignorar !== "cores" && filtros.cores.length > 0;
  if (!usaTamanho && !usaCor) return true;
  return peca.variantes.some((variante) => varianteServe(variante, filtros, usaCor, usaTamanho));
}

function varianteServe(variante: Variante, filtros: Filtros, usaCor: boolean, usaTamanho: boolean): boolean {
  return (
    (!usaCor || variante.familias.some((familia) => filtros.cores.includes(familia))) &&
    (!usaTamanho || variante.tamanhos.some((t) => filtros.tamanhos.includes(t)))
  );
}

// Cor que o card deve abrir quando ha' filtro de cor: a primeira cor da peca que bate.
function corQueBate(peca: PecaResumo, filtros: Filtros): string | undefined {
  if (filtros.cores.length === 0) return undefined;
  return peca.variantes.find((variante) => varianteServe(variante, filtros, true, filtros.tamanhos.length > 0))?.cor;
}

function valoresDaPeca(peca: PecaResumo, faceta: Faceta, filtros: Filtros): string[] {
  if (faceta === "marcas") return [peca.produto.marca];
  if (faceta === "categorias") return [peca.categoria];
  // Tamanho/cor: so' conta valores das cores que passam no OUTRO filtro (mesma regra de passa()).
  const valores = new Set<string>();
  for (const variante of peca.variantes) {
    if (faceta === "tamanhos") {
      if (filtros.cores.length > 0 && !variante.familias.some((familia) => filtros.cores.includes(familia))) continue;
      variante.tamanhos.forEach((t) => valores.add(t));
    } else {
      if (filtros.tamanhos.length > 0 && !variante.tamanhos.some((t) => filtros.tamanhos.includes(t))) continue;
      variante.familias.forEach((familia) => valores.add(familia));
    }
  }
  return Array.from(valores);
}

type Opcao = { valor: string; quantidade: number };

function opcoesDaFaceta(pecas: PecaResumo[], filtros: Filtros, faceta: Faceta): Opcao[] {
  const contagem = new Map<string, number>();
  for (const peca of pecas) {
    if (!passa(peca, filtros, faceta)) continue;
    for (const valor of valoresDaPeca(peca, faceta, filtros)) contagem.set(valor, (contagem.get(valor) ?? 0) + 1);
  }
  // Opcao ja' marcada continua aparecendo mesmo se a contagem zerar (pra poder desmarcar).
  for (const marcado of filtros[faceta]) if (!contagem.has(marcado)) contagem.set(marcado, 0);

  const opcoes = Array.from(contagem, ([valor, quantidade]) => ({ valor, quantidade }));
  if (faceta === "tamanhos") return opcoes.sort((a, b) => compararTamanhos(a.valor, b.valor));
  if (faceta === "cores") {
    return opcoes.sort((a, b) => (ORDEM_FAMILIA.get(a.valor) ?? 99) - (ORDEM_FAMILIA.get(b.valor) ?? 99));
  }
  return opcoes.sort((a, b) => {
    // "Outras peças" sempre por ultimo
    if (a.valor === CATEGORIA_OUTRAS) return 1;
    if (b.valor === CATEGORIA_OUTRAS) return -1;
    return a.valor.localeCompare(b.valor, "pt-BR");
  });
}

// ---------------------------------------------------------------------------------------------
// Pecas visuais
// ---------------------------------------------------------------------------------------------

function IconeGrade4({ ativo }: { ativo: boolean }) {
  return (
    <svg viewBox="0 0 20 20" width="17" height="17" fill={ativo ? "white" : "currentColor"}>
      <rect x="1" y="1" width="8" height="8" />
      <rect x="11" y="1" width="8" height="8" />
      <rect x="1" y="11" width="8" height="8" />
      <rect x="11" y="11" width="8" height="8" />
    </svg>
  );
}

function IconeGrade6({ ativo }: { ativo: boolean }) {
  return (
    <svg viewBox="0 0 20 20" width="17" height="17" fill={ativo ? "white" : "currentColor"}>
      <rect x="1" y="1" width="5" height="8" />
      <rect x="7.5" y="1" width="5" height="8" />
      <rect x="14" y="1" width="5" height="8" />
      <rect x="1" y="11" width="5" height="8" />
      <rect x="7.5" y="11" width="5" height="8" />
      <rect x="14" y="11" width="5" height="8" />
    </svg>
  );
}

function IconeFiltro() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" width="16" height="16">
      <line x1="4" y1="7" x2="20" y2="7" strokeLinecap="round" />
      <line x1="7" y1="12" x2="17" y2="12" strokeLinecap="round" />
      <line x1="10" y1="17" x2="14" y2="17" strokeLinecap="round" />
    </svg>
  );
}

function IconeFechar() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" width="22" height="22">
      <path d="M6 6l12 12M6 18L18 6" strokeLinecap="round" />
    </svg>
  );
}

function Caixinha({ marcada }: { marcada: boolean }) {
  return (
    <span
      className={`w-4 h-4 shrink-0 border flex items-center justify-center ${
        marcada ? "bg-mozz-black border-mozz-black" : "border-black/30 bg-white"
      }`}
    >
      {marcada && (
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="white" strokeWidth="3">
          <path d="M5 12l5 5 9-10" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </span>
  );
}

const LIMITE_LISTA = 8;

function SecaoLista({
  titulo,
  opcoes,
  marcados,
  aoAlternar,
  comAmostra = false
}: {
  titulo: string;
  opcoes: Opcao[];
  marcados: string[];
  aoAlternar: (valor: string) => void;
  comAmostra?: boolean;
}) {
  const [verTodas, setVerTodas] = useState(false);
  // Cor mostra sempre todas as familias (sao no maximo 16); marca/categoria recolhem lista longa.
  const longa = !comAmostra && opcoes.length > LIMITE_LISTA + 2;
  // Lista recolhida mostra as primeiras opcoes + qualquer opcao ja' marcada (ex.: "Vestidos"
  // vindo do menu do topo nao pode ficar escondida dentro do "Ver mais").
  const visiveis =
    longa && !verTodas ? opcoes.filter((opcao, i) => i < LIMITE_LISTA || marcados.includes(opcao.valor)) : opcoes;

  return (
    <div className="py-5 border-b border-black/10">
      <p className="text-[12px] font-bold uppercase tracking-widest mb-3">{titulo}</p>
      <ul className="space-y-2">
        {visiveis.map((opcao) => {
          const marcada = marcados.includes(opcao.valor);
          return (
            <li key={opcao.valor}>
              <button
                type="button"
                onClick={() => aoAlternar(opcao.valor)}
                aria-pressed={marcada}
                className="flex items-center gap-2.5 w-full text-left text-[14px] text-mozz-black hover:opacity-70"
              >
                <Caixinha marcada={marcada} />
                {comAmostra && (
                  <span
                    className="w-3.5 h-3.5 rounded-full border border-black/15 shrink-0"
                    style={{ background: AMOSTRA_FAMILIA.get(opcao.valor) ?? "#c7c6c0" }}
                  />
                )}
                <span className={marcada ? "font-semibold" : ""}>
                  {opcao.valor} <span className="text-mozz-gray font-normal">({opcao.quantidade})</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {longa && (
        <button
          type="button"
          onClick={() => setVerTodas((v) => !v)}
          className="mt-3 text-[13px] underline underline-offset-4 text-mozz-black"
        >
          {verTodas ? "Ver menos" : `Ver mais (${opcoes.length - visiveis.length})`}
        </button>
      )}
    </div>
  );
}

function SecaoTamanhos({
  opcoes,
  marcados,
  aoAlternar
}: {
  opcoes: Opcao[];
  marcados: string[];
  aoAlternar: (valor: string) => void;
}) {
  return (
    <div className="py-5 border-b border-black/10">
      <p className="text-[12px] font-bold uppercase tracking-widest mb-3">Tamanho</p>
      <div className="flex flex-wrap gap-2">
        {opcoes.map((opcao) => {
          const marcado = marcados.includes(opcao.valor);
          return (
            <button
              key={opcao.valor}
              type="button"
              onClick={() => aoAlternar(opcao.valor)}
              aria-pressed={marcado}
              title={`${opcao.quantidade} peça(s)`}
              className={`min-w-[44px] h-9 px-2 border text-[13px] transition-colors ${
                marcado
                  ? "bg-mozz-black border-mozz-black text-white"
                  : "border-black/25 text-mozz-black hover:border-mozz-black"
              }`}
            >
              {opcao.valor}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Grade
// ---------------------------------------------------------------------------------------------

// Usada em /feminino, /masculino, /marca/[slug], /black-november, /outlet e /produtos.
// "marcas" so' vem do /produtos (catalogo completo): la' aparece tambem o campo de busca por
// nome dentro da vitrine, que recebe o termo vindo da busca do menu (buscaInicial).
export default function GradeProdutos({
  produtos,
  marcas,
  buscaInicial
}: {
  produtos: Produto[];
  marcas?: string[];
  buscaInicial?: string;
}) {
  const mostrarBusca = marcas !== undefined || buscaInicial !== undefined;
  const [busca, setBusca] = useState(buscaInicial ?? "");
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_VAZIOS);
  const [ordenacao, setOrdenacao] = useState<Ordenacao>("relevancia");
  const [densidade, setDensidade] = useState<Densidade>(4);
  const [quantidadeVisivel, setQuantidadeVisivel] = useState(QUANTIDADE_POR_PAGINA);
  const [painelAberto, setPainelAberto] = useState(false);

  const pecas = useMemo(() => produtos.map(resumir), [produtos]);

  // Categoria vinda do menu do topo (/feminino?categoria=Vestidos) - lida da URL ao abrir a
  // pagina (o menu usa link comum, entao a pagina sempre abre do zero).
  useEffect(() => {
    const categoria = new URLSearchParams(window.location.search).get("categoria");
    if (categoria && pecas.some((peca) => peca.categoria === categoria)) {
      setFiltros((atual) => ({ ...atual, categorias: [categoria] }));
    }
  }, [pecas]);

  // Painel do celular aberto: a pagina por tras nao rola e Esc fecha.
  useEffect(() => {
    if (!painelAberto) return;
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const aoApertarTecla = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") setPainelAberto(false);
    };
    window.addEventListener("keydown", aoApertarTecla);
    return () => {
      document.body.style.overflow = overflowAnterior;
      window.removeEventListener("keydown", aoApertarTecla);
    };
  }, [painelAberto]);

  // Busca por texto vale antes dos filtros (as quantidades de cada opcao ja' respeitam a busca).
  const pecasDaBusca = useMemo(() => {
    const termo = normalizarTexto(busca.trim());
    if (!termo) return pecas;
    return pecas.filter(
      (peca) => normalizarTexto(peca.produto.nome).includes(termo) || normalizarTexto(peca.produto.marca).includes(termo)
    );
  }, [pecas, busca]);

  const opcoes = useMemo(
    () => ({
      marcas: opcoesDaFaceta(pecasDaBusca, filtros, "marcas"),
      categorias: opcoesDaFaceta(pecasDaBusca, filtros, "categorias"),
      tamanhos: opcoesDaFaceta(pecasDaBusca, filtros, "tamanhos"),
      cores: opcoesDaFaceta(pecasDaBusca, filtros, "cores")
    }),
    [pecasDaBusca, filtros]
  );

  const listaFiltrada = useMemo(() => {
    const lista = pecasDaBusca.filter((peca) => passa(peca, filtros));
    // produto com foto sempre antes de produto sem foto, mesmo ordenando por preco.
    return [...lista].sort((pecaA, pecaB) => {
      const a = pecaA.produto;
      const b = pecaB.produto;
      const temFotoA = a.imagem ? 0 : 1;
      const temFotoB = b.imagem ? 0 : 1;
      if (temFotoA !== temFotoB) return temFotoA - temFotoB;
      if (ordenacao === "menor-preco") return a.preco - b.preco;
      if (ordenacao === "maior-preco") return b.preco - a.preco;
      return 0;
    });
  }, [pecasDaBusca, filtros, ordenacao]);

  useEffect(() => {
    setQuantidadeVisivel(QUANTIDADE_POR_PAGINA);
  }, [filtros, ordenacao, busca]);

  function alternar(faceta: Faceta, valor: string) {
    setFiltros((atual) => {
      const lista = atual[faceta];
      return {
        ...atual,
        [faceta]: lista.includes(valor) ? lista.filter((v) => v !== valor) : [...lista, valor]
      };
    });
  }

  const totalMarcados =
    filtros.marcas.length + filtros.categorias.length + filtros.tamanhos.length + filtros.cores.length;
  const limpar = () => setFiltros(FILTROS_VAZIOS);
  const textoPecas = `${listaFiltrada.length} ${listaFiltrada.length === 1 ? "peça" : "peças"}`;

  const conteudoFiltros = (
    <>
      {totalMarcados > 0 && (
        <button
          type="button"
          onClick={limpar}
          className="mt-1 text-[13px] underline underline-offset-4 text-mozz-black"
        >
          Limpar filtros
        </button>
      )}
      {opcoes.marcas.length > 1 && (
        <SecaoLista
          titulo="Marca"
          opcoes={opcoes.marcas}
          marcados={filtros.marcas}
          aoAlternar={(v) => alternar("marcas", v)}
        />
      )}
      {opcoes.categorias.length > 0 && (
        <SecaoLista
          titulo="Categoria"
          opcoes={opcoes.categorias}
          marcados={filtros.categorias}
          aoAlternar={(v) => alternar("categorias", v)}
        />
      )}
      {opcoes.tamanhos.length > 0 && (
        <SecaoTamanhos opcoes={opcoes.tamanhos} marcados={filtros.tamanhos} aoAlternar={(v) => alternar("tamanhos", v)} />
      )}
      {opcoes.cores.length > 0 && (
        <SecaoLista
          titulo="Cor"
          opcoes={opcoes.cores}
          marcados={filtros.cores}
          aoAlternar={(v) => alternar("cores", v)}
          comAmostra
        />
      )}
    </>
  );

  const produtosVisiveis = listaFiltrada.slice(0, quantidadeVisivel);
  const temMaisPraCarregar = quantidadeVisivel < listaFiltrada.length;

  return (
    <div className="md:flex md:gap-10">
      {/* Coluna de filtros - computador */}
      <aside className="hidden md:block w-[220px] shrink-0" aria-label="Filtros">
        {/* top-[140px]: abaixo do cabecalho fixo (faixa do cupom + menu, ~123px no computador) */}
        <div className="sticky top-[140px] max-h-[calc(100vh-160px)] overflow-y-auto pr-2">
          <p className="text-[15px] font-bold">Filtrar</p>
          {conteudoFiltros}
        </div>
      </aside>

      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <button
            type="button"
            onClick={() => setPainelAberto(true)}
            className="md:hidden flex items-center gap-2 border border-mozz-black px-4 py-2 text-[14px] font-semibold"
          >
            <IconeFiltro />
            Filtrar{totalMarcados > 0 ? ` (${totalMarcados})` : ""}
          </button>
          {mostrarBusca && (
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome ou marca..."
              className="border border-black/20 px-3 py-2 text-[14.5px] flex-1 min-w-[180px]"
            />
          )}
          <select
            value={ordenacao}
            onChange={(e) => setOrdenacao(e.target.value as Ordenacao)}
            aria-label="Ordenar"
            className="border border-black/20 px-3 py-2 text-[14px] bg-white"
          >
            <option value="relevancia">Ordenar por relevância</option>
            <option value="menor-preco">Preço: menor para maior</option>
            <option value="maior-preco">Preço: maior para menor</option>
          </select>
          <span className="text-[13.5px] text-mozz-gray ml-auto">{textoPecas}</span>

          {/* Seletor de densidade - so' faz diferenca no computador. */}
          <div className="hidden md:flex border border-black/20">
            <button
              onClick={() => setDensidade(4)}
              aria-label="Mostrar 4 peças por linha"
              aria-pressed={densidade === 4}
              className={`w-8 h-8 flex items-center justify-center ${
                densidade === 4 ? "bg-mozz-black text-white" : "text-mozz-black"
              }`}
            >
              <IconeGrade4 ativo={densidade === 4} />
            </button>
            <button
              onClick={() => setDensidade(6)}
              aria-label="Mostrar 6 peças por linha"
              aria-pressed={densidade === 6}
              className={`w-8 h-8 flex items-center justify-center border-l border-black/20 ${
                densidade === 6 ? "bg-mozz-black text-white" : "text-mozz-black"
              }`}
            >
              <IconeGrade6 ativo={densidade === 6} />
            </button>
          </div>
        </div>

        {totalMarcados > 0 && (
          <div className="flex flex-wrap items-center gap-2 -mt-2 mb-6">
            {(Object.keys(filtros) as Faceta[]).flatMap((faceta) =>
              filtros[faceta].map((valor) => (
                <button
                  key={`${faceta}-${valor}`}
                  type="button"
                  onClick={() => alternar(faceta, valor)}
                  aria-label={`Tirar o filtro ${valor}`}
                  className="flex items-center gap-1.5 border border-black/20 px-3 py-1 text-[13px] hover:border-mozz-black"
                >
                  {valor}
                  <span aria-hidden="true" className="text-[15px] leading-none">×</span>
                </button>
              ))
            )}
            <button type="button" onClick={limpar} className="text-[13px] underline underline-offset-4 ml-1">
              Limpar filtros
            </button>
          </div>
        )}

        {listaFiltrada.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-[14.5px] text-mozz-gray">Nenhuma peça encontrada com esse filtro.</p>
            {totalMarcados > 0 && (
              <button type="button" onClick={limpar} className="mt-3 text-[14px] underline underline-offset-4">
                Limpar filtros
              </button>
            )}
          </div>
        ) : (
          <>
            <div
              className={
                densidade === 6
                  ? "grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3 md:gap-4"
                  : "grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6"
              }
            >
              {produtosVisiveis.map((peca) => {
                const corInicial = corQueBate(peca, filtros);
                return (
                  <ProductCard
                    key={`${peca.produto.id}-${corInicial ?? ""}`}
                    produto={peca.produto}
                    corInicial={corInicial}
                  />
                );
              })}
            </div>
            {temMaisPraCarregar && (
              <div className="flex justify-center mt-8">
                <button
                  onClick={() => setQuantidadeVisivel((atual) => atual + QUANTIDADE_POR_PAGINA)}
                  className="text-[14.5px] px-6 py-3 border border-mozz-black hover:bg-mozz-black hover:text-white transition-colors"
                >
                  Carregar mais peças
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Painel de filtros - celular: abre pela esquerda; o resto da tela escurece e tocar fecha. */}
      <div className={`md:hidden fixed inset-0 z-[60] ${painelAberto ? "" : "pointer-events-none"}`} aria-hidden={!painelAberto}>
        <div
          onClick={() => setPainelAberto(false)}
          className={`absolute inset-0 bg-black/40 transition-opacity duration-300 ${painelAberto ? "opacity-100" : "opacity-0"}`}
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Filtros"
          className={`absolute left-0 top-0 bottom-0 w-[85%] max-w-[360px] bg-white shadow-xl flex flex-col transition-transform duration-300 ease-out ${
            painelAberto ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-black/10">
            <span className="text-[16px] font-bold">Filtrar</span>
            <button type="button" onClick={() => setPainelAberto(false)} aria-label="Fechar filtros" className="p-1 -mr-1">
              <IconeFechar />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-5">{conteudoFiltros}</div>
          <div className="px-5 py-4 border-t border-black/10">
            <button
              type="button"
              onClick={() => setPainelAberto(false)}
              className="w-full bg-mozz-black text-white py-3 text-[14.5px] font-semibold"
            >
              Ver {textoPecas}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

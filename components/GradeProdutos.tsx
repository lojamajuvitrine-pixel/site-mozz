"use client";

import { useMemo, useState } from "react";
import ProductCard from "./ProductCard";
import { coresDoProduto, tamanhosDisponiveisDoColor, type Produto } from "@/lib/produtos";
import { familiaDaCor, normalizarTexto } from "@/lib/cor";

type Ordenacao = "relevancia" | "menor-preco" | "maior-preco";

// Ordem "natural" de tamanho pro filtro (numero em ordem numerica, letra na ordem de
// tamanho real) - sem isso a lista sairia em ordem alfabetica (ex: "10, 12, 36, 38, 40, G, M,
// P" em vez de "P, M, G" ou "36, 38, 40"). So' usado aqui no filtro; a ordem de exibicao dos
// tamanhos DENTRO de um produto (SeletorProduto/ProductCard) ja vem correta do sync.
const ORDEM_LETRA = ["PP", "P", "M", "G", "GG", "XG", "XGG", "XXG", "U", "ÚNICO"];
function compararTamanhos(a: string, b: string): number {
  const numA = Number(a);
  const numB = Number(b);
  if (!Number.isNaN(numA) && !Number.isNaN(numB)) return numA - numB;
  const posA = ORDEM_LETRA.indexOf(a.toUpperCase());
  const posB = ORDEM_LETRA.indexOf(b.toUpperCase());
  if (posA !== -1 && posB !== -1) return posA - posB;
  return a.localeCompare(b);
}

// Grade de produtos com busca por nome/marca, filtro de marca (opcional - so' aparece se a
// lista de marcas for passada), filtro de tamanho e cor (derivados dinamicamente dos produtos
// recebidos - so' mostra opcao que existe de verdade na lista atual) e ordenacao por preco.
// Usado no catalogo completo (/produtos, que pode chegar com um termo ja preenchido vindo da
// busca do menu), nas paginas de marca (/marca/[slug]) e no /outlet.
export default function GradeProdutos({
  produtos,
  marcas,
  buscaInicial
}: {
  produtos: Produto[];
  marcas?: string[];
  buscaInicial?: string;
}) {
  const [busca, setBusca] = useState(buscaInicial ?? "");
  const [marcaSelecionada, setMarcaSelecionada] = useState<string>("todas");
  const [tamanhoSelecionado, setTamanhoSelecionado] = useState<string>("todos");
  const [corSelecionada, setCorSelecionada] = useState<string>("todas");
  const [ordenacao, setOrdenacao] = useState<Ordenacao>("relevancia");

  // So' oferece no filtro tamanho/cor que EXISTE de verdade (e tem saldo) entre os produtos
  // recebidos - evita filtro fantasma que sempre devolve lista vazia.
  const tamanhosDisponiveis = useMemo(() => {
    const conjunto = new Set<string>();
    for (const p of produtos) {
      for (const cor of coresDoProduto(p)) {
        for (const t of tamanhosDisponiveisDoColor(cor)) conjunto.add(t);
      }
    }
    return Array.from(conjunto).sort(compararTamanhos);
  }, [produtos]);

  const familiasDeCor = useMemo(() => {
    const conjunto = new Set<string>();
    for (const p of produtos) {
      for (const cor of coresDoProduto(p)) conjunto.add(familiaDaCor(cor.cor));
    }
    return Array.from(conjunto).sort();
  }, [produtos]);

  const listaFiltrada = useMemo(() => {
    let lista =
      marcaSelecionada === "todas"
        ? produtos
        : produtos.filter((p) => p.marca === marcaSelecionada);

    if (tamanhoSelecionado !== "todos") {
      lista = lista.filter((p) =>
        coresDoProduto(p).some((cor) => tamanhosDisponiveisDoColor(cor).includes(tamanhoSelecionado))
      );
    }

    if (corSelecionada !== "todas") {
      lista = lista.filter((p) => coresDoProduto(p).some((cor) => familiaDaCor(cor.cor) === corSelecionada));
    }

    const termo = normalizarTexto(busca.trim());
    if (termo) {
      lista = lista.filter(
        (p) => normalizarTexto(p.nome).includes(termo) || normalizarTexto(p.marca).includes(termo)
      );
    }

    // produto com foto sempre antes de produto sem foto, mesmo ordenando por preco - senao
    // um produto sem foto barato pula pra frente de tudo e a vitrine fica com cara de
    // catalogo incompleto logo na primeira fileira.
    return [...lista].sort((a, b) => {
      const temFotoA = a.imagem ? 0 : 1;
      const temFotoB = b.imagem ? 0 : 1;
      if (temFotoA !== temFotoB) return temFotoA - temFotoB;
      if (ordenacao === "menor-preco") return a.preco - b.preco;
      if (ordenacao === "maior-preco") return b.preco - a.preco;
      return 0; // relevancia - mantem a ordem original (produtos ja vem com foto priorizada)
    });
  }, [produtos, marcaSelecionada, tamanhoSelecionado, corSelecionada, ordenacao, busca]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome ou marca..."
          className="border border-black/20 px-3 py-2 text-[14.5px] flex-1 min-w-[180px]"
        />
        {marcas && marcas.length > 0 && (
          <select
            value={marcaSelecionada}
            onChange={(e) => setMarcaSelecionada(e.target.value)}
            className="border border-black/20 px-3 py-2 text-[14.5px] bg-white"
          >
            <option value="todas">Todas as marcas</option>
            {marcas.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        )}
        {tamanhosDisponiveis.length > 0 && (
          <select
            value={tamanhoSelecionado}
            onChange={(e) => setTamanhoSelecionado(e.target.value)}
            className="border border-black/20 px-3 py-2 text-[14.5px] bg-white"
          >
            <option value="todos">Todos os tamanhos</option>
            {tamanhosDisponiveis.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        )}
        {familiasDeCor.length > 0 && (
          <select
            value={corSelecionada}
            onChange={(e) => setCorSelecionada(e.target.value)}
            className="border border-black/20 px-3 py-2 text-[14.5px] bg-white"
          >
            <option value="todas">Todas as cores</option>
            {familiasDeCor.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        )}
        <select
          value={ordenacao}
          onChange={(e) => setOrdenacao(e.target.value as Ordenacao)}
          className="border border-black/20 px-3 py-2 text-[14.5px] bg-white"
        >
          <option value="relevancia">Ordenar por relevancia</option>
          <option value="menor-preco">Preco: menor para maior</option>
          <option value="maior-preco">Preco: maior para menor</option>
        </select>
        <span className="text-[13.5px] text-mozz-gray ml-auto">
          {listaFiltrada.length} peca(s)
        </span>
      </div>

      {listaFiltrada.length === 0 ? (
        <p className="text-[14.5px] text-mozz-gray py-8 text-center">
          Nenhuma peca encontrada com esse filtro.
        </p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {listaFiltrada.map((produto) => (
            <ProductCard key={produto.id} produto={produto} />
          ))}
        </div>
      )}
    </div>
  );
}

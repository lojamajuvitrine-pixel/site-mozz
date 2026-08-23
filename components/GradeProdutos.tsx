"use client";

import { useMemo, useState } from "react";
import ProductCard from "./ProductCard";
import type { Produto } from "@/lib/produtos";
import { normalizarTexto } from "@/lib/cor";

type Ordenacao = "relevancia" | "menor-preco" | "maior-preco";

// Grade de produtos com busca por nome/marca, filtro de marca (opcional - so' aparece se a
// lista de marcas for passada) e ordenacao por preco. Usado no catalogo completo (/produtos,
// que pode chegar com um termo ja preenchido vindo da barra de busca do menu) e nas paginas
// de marca (/marca/[slug], sem o filtro de marca ali, ja que a pagina inteira ja e' de uma
// so' - mas a busca continua disponivel pra refinar dentro da marca).
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
  const [ordenacao, setOrdenacao] = useState<Ordenacao>("relevancia");

  const listaFiltrada = useMemo(() => {
    let lista =
      marcaSelecionada === "todas"
        ? produtos
        : produtos.filter((p) => p.marca === marcaSelecionada);

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
  }, [produtos, marcaSelecionada, ordenacao, busca]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome ou marca..."
          className="border border-black/20 px-3 py-2 text-[13px] flex-1 min-w-[180px]"
        />
        {marcas && marcas.length > 0 && (
          <select
            value={marcaSelecionada}
            onChange={(e) => setMarcaSelecionada(e.target.value)}
            className="border border-black/20 px-3 py-2 text-[13px] bg-white"
          >
            <option value="todas">Todas as marcas</option>
            {marcas.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        )}
        <select
          value={ordenacao}
          onChange={(e) => setOrdenacao(e.target.value as Ordenacao)}
          className="border border-black/20 px-3 py-2 text-[13px] bg-white"
        >
          <option value="relevancia">Ordenar por relevancia</option>
          <option value="menor-preco">Preco: menor para maior</option>
          <option value="maior-preco">Preco: maior para menor</option>
        </select>
        <span className="text-[12px] text-mozz-gray ml-auto">
          {listaFiltrada.length} peca(s)
        </span>
      </div>

      {listaFiltrada.length === 0 ? (
        <p className="text-[13px] text-mozz-gray py-8 text-center">
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

"use client";

import { useMemo, useState } from "react";
import ProductCard from "./ProductCard";
import type { Produto } from "@/lib/produtos";

type Ordenacao = "relevancia" | "menor-preco" | "maior-preco";

// Grade de produtos com filtro de marca (opcional - so' aparece se a lista de marcas for
// passada) e ordenacao por preco. Usado no catalogo completo (/produtos) e nas paginas de
// marca (/marca/[slug], sem o filtro de marca ali, ja que a pagina inteira ja e' de uma so').
export default function GradeProdutos({
  produtos,
  marcas
}: {
  produtos: Produto[];
  marcas?: string[];
}) {
  const [marcaSelecionada, setMarcaSelecionada] = useState<string>("todas");
  const [ordenacao, setOrdenacao] = useState<Ordenacao>("relevancia");

  const listaFiltrada = useMemo(() => {
    let lista =
      marcaSelecionada === "todas"
        ? produtos
        : produtos.filter((p) => p.marca === marcaSelecionada);

    if (ordenacao === "menor-preco") {
      lista = [...lista].sort((a, b) => a.preco - b.preco);
    } else if (ordenacao === "maior-preco") {
      lista = [...lista].sort((a, b) => b.preco - a.preco);
    }
    return lista;
  }, [produtos, marcaSelecionada, ordenacao]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-6">
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

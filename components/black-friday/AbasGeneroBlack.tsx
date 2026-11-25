"use client";

// Pagina da Black separada em Feminino / Masculino (pedido do Brunno em 25/11/2026). A aba
// comeca em Feminino (publico da maioria dos cadastros); o link /black-friday?genero=masculino
// ja abre na aba masculina - util pra mandar no grupo/anuncio do "presente pra ele".
import { useEffect, useMemo, useState } from "react";
import GradeProdutos from "@/components/GradeProdutos";
import type { Produto } from "@/lib/produtos";

type Genero = "Feminino" | "Masculino";

export default function AbasGeneroBlack({
  feminino,
  masculino
}: {
  feminino: Produto[];
  masculino: Produto[];
}) {
  const [genero, setGenero] = useState<Genero>(feminino.length > 0 ? "Feminino" : "Masculino");

  useEffect(() => {
    const pedido = new URLSearchParams(window.location.search).get("genero");
    if (pedido === "masculino" && masculino.length > 0) setGenero("Masculino");
    if (pedido === "feminino" && feminino.length > 0) setGenero("Feminino");
  }, [feminino.length, masculino.length]);

  function trocar(novo: Genero) {
    setGenero(novo);
    const url = new URL(window.location.href);
    url.searchParams.set("genero", novo.toLowerCase());
    window.history.replaceState(null, "", url.toString());
  }

  const produtos = genero === "Feminino" ? feminino : masculino;
  const marcas = useMemo(() => Array.from(new Set(produtos.map((p) => p.marca))).sort(), [produtos]);

  const abas: { genero: Genero; quantidade: number }[] = [
    { genero: "Feminino", quantidade: feminino.length },
    { genero: "Masculino", quantidade: masculino.length }
  ];

  return (
    <>
      <div className="mb-6 flex justify-center">
        <div className="inline-flex rounded-full border border-black p-1" role="tablist">
          {abas.map((aba) => (
            <button
              key={aba.genero}
              role="tab"
              aria-selected={genero === aba.genero}
              disabled={aba.quantidade === 0}
              onClick={() => trocar(aba.genero)}
              className={`rounded-full px-6 py-2 text-[14px] font-semibold uppercase tracking-wide transition-colors disabled:opacity-30 ${
                genero === aba.genero ? "bg-black text-white" : "text-black"
              }`}
            >
              {aba.genero} <span className="font-normal opacity-70">({aba.quantidade})</span>
            </button>
          ))}
        </div>
      </div>
      {/* key: troca de aba zera filtros, busca e paginacao da grade */}
      <GradeProdutos key={genero} produtos={produtos} marcas={marcas} />
    </>
  );
}

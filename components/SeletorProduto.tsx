"use client";

import { useState } from "react";
import Image from "next/image";
import type { Produto } from "@/lib/produtos";
import { coresDoProduto } from "@/lib/produtos";
import { formatarPreco } from "@/lib/formato";
import { useCart } from "@/lib/cart-context";

// Mapa best-effort de nome de cor (como cadastrado no Bling, em portugues, texto livre) pra
// uma cor aproximada de bolinha ao lado do nome - so' decoracao, o nome por extenso sempre
// aparece do lado. Cor nao mapeada cai no cinza neutro (nao trava nada).
const CORES_APROX: Record<string, string> = {
  branco: "#ffffff",
  "off white": "#f5f0e6",
  preto: "#111111",
  cinza: "#8a8a86",
  azul: "#2f4a7a",
  "azul marinho": "#1c2b4a",
  "azul claro": "#7d9fc9",
  vermelho: "#a02020",
  verde: "#3d5c34",
  amarelo: "#d8b84a",
  rosa: "#d99aa8",
  bege: "#d8c9ae",
  marrom: "#5c4230",
  nude: "#c9a988",
  laranja: "#c9702f",
  roxo: "#5c4478",
  vinho: "#5c1f2a",
  caramelo: "#a9682f",
  camel: "#b08355",
  areia: "#c9b892"
};

function corAproximada(nomeCor: string): string {
  return CORES_APROX[nomeCor.trim().toLowerCase()] ?? "#c7c6c0";
}

export default function SeletorProduto({ produto }: { produto: Produto }) {
  const cores = coresDoProduto(produto);
  const [corIndex, setCorIndex] = useState(0);
  const corAtual = cores[corIndex];
  const [tamanho, setTamanho] = useState(corAtual.tamanhos[0]);
  const [adicionado, setAdicionado] = useState(false);
  const { adicionar } = useCart();

  function selecionarCor(index: number) {
    setCorIndex(index);
    setTamanho(cores[index].tamanhos[0]);
  }

  return (
    <section className="py-8 grid md:grid-cols-2 gap-10">
      <div className="relative aspect-[3/4] bg-mozz-stone flex items-center justify-center overflow-hidden">
        {corAtual.imagem ? (
          <Image
            key={corAtual.imagem}
            src={corAtual.imagem}
            alt={`${produto.nome} - ${corAtual.cor}`}
            fill
            sizes="(max-width: 768px) 100vw, 50vw"
            className="object-cover"
            priority
          />
        ) : (
          <span className="text-mozz-gray text-xs">foto do produto</span>
        )}
      </div>

      <div>
        <p className="text-[12px] text-mozz-gray">{produto.marca}</p>
        <p className="font-serif text-2xl mt-1">{produto.nome}</p>
        <p className="text-[15px] mt-2">{formatarPreco(produto.preco)}</p>
        <p className="text-[13px] text-mozz-gray mt-4">{produto.descricao}</p>

        <div className="mt-6">
          {cores.length > 1 && (
            <>
              <p className="text-[12px] text-mozz-gray mb-2">Cor: {corAtual.cor}</p>
              <div className="flex gap-2 mb-6 flex-wrap">
                {cores.map((c, i) => (
                  <button
                    key={c.cor}
                    onClick={() => selecionarCor(i)}
                    aria-label={c.cor}
                    title={c.cor}
                    className={`w-9 h-9 rounded-full border-2 ${
                      i === corIndex ? "border-mozz-black" : "border-transparent"
                    }`}
                    style={{ padding: 3 }}
                  >
                    <span
                      className="block w-full h-full rounded-full border border-black/15"
                      style={{ backgroundColor: corAproximada(c.cor) }}
                    />
                  </button>
                ))}
              </div>
            </>
          )}

          <p className="text-[12px] text-mozz-gray mb-2">Tamanho</p>
          <div className="flex gap-2 mb-6 flex-wrap">
            {corAtual.tamanhos.map((t) => (
              <button
                key={t}
                onClick={() => setTamanho(t)}
                className={`w-9 h-9 text-[12px] border ${
                  tamanho === t ? "bg-mozz-black text-white border-mozz-black" : "border-black/20"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <button
            onClick={() => {
              adicionar(produto, corAtual.cor, tamanho);
              setAdicionado(true);
              setTimeout(() => setAdicionado(false), 1500);
            }}
            className="w-full text-[13px] py-3 bg-mozz-black text-white"
          >
            {adicionado ? "Adicionado" : "Adicionar ao carrinho"}
          </button>
        </div>
      </div>
    </section>
  );
}

"use client";

import { useState } from "react";
import type { Produto } from "@/lib/produtos";
import { useCart } from "@/lib/cart-context";

export default function BotaoAdicionarCarrinho({ produto }: { produto: Produto }) {
  const [tamanho, setTamanho] = useState(produto.tamanhos[0]);
  const [adicionado, setAdicionado] = useState(false);
  const { adicionar } = useCart();

  return (
    <div className="mt-6">
      <p className="text-[12px] text-mozz-gray mb-2">Tamanho</p>
      <div className="flex gap-2 mb-6">
        {produto.tamanhos.map((t) => (
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
          adicionar(produto, tamanho);
          setAdicionado(true);
          setTimeout(() => setAdicionado(false), 1500);
        }}
        className="w-full text-[13px] py-3 bg-mozz-black text-white"
      >
        {adicionado ? "Adicionado" : "Adicionar ao carrinho"}
      </button>
    </div>
  );
}

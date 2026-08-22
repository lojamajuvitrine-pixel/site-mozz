"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import type { Produto } from "@/lib/produtos";

export type ItemCarrinho = { produto: Produto; tamanho: string; quantidade: number };

type CartContextType = {
  itens: ItemCarrinho[];
  adicionar: (produto: Produto, tamanho: string) => void;
  remover: (produtoId: string, tamanho: string) => void;
  limpar: () => void;
  total: number;
};

const CartContext = createContext<CartContextType | null>(null);

const CHAVE_STORAGE = "mozz_carrinho";

export function CartProvider({ children }: { children: ReactNode }) {
  const [itens, setItens] = useState<ItemCarrinho[]>([]);
  const [carregado, setCarregado] = useState(false);

  useEffect(() => {
    const salvo = window.localStorage.getItem(CHAVE_STORAGE);
    if (salvo) {
      try {
        setItens(JSON.parse(salvo));
      } catch {
        // carrinho salvo corrompido, ignora e comeca vazio
      }
    }
    setCarregado(true);
  }, []);

  useEffect(() => {
    if (carregado) {
      window.localStorage.setItem(CHAVE_STORAGE, JSON.stringify(itens));
    }
  }, [itens, carregado]);

  function adicionar(produto: Produto, tamanho: string) {
    setItens((atual) => {
      const existente = atual.find(
        (i) => i.produto.id === produto.id && i.tamanho === tamanho
      );
      if (existente) {
        return atual.map((i) =>
          i.produto.id === produto.id && i.tamanho === tamanho
            ? { ...i, quantidade: i.quantidade + 1 }
            : i
        );
      }
      return [...atual, { produto, tamanho, quantidade: 1 }];
    });
  }

  function remover(produtoId: string, tamanho: string) {
    setItens((atual) =>
      atual.filter((i) => !(i.produto.id === produtoId && i.tamanho === tamanho))
    );
  }

  function limpar() {
    setItens([]);
  }

  const total = itens.reduce((soma, i) => soma + i.produto.preco * i.quantidade, 0);

  return (
    <CartContext.Provider value={{ itens, adicionar, remover, limpar, total }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const contexto = useContext(CartContext);
  if (!contexto) throw new Error("useCart precisa estar dentro de <CartProvider>");
  return contexto;
}

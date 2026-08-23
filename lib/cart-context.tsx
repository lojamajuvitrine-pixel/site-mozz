"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import type { Produto } from "@/lib/produtos";
import { rastrearAdicionarAoCarrinho } from "@/lib/tracking";

export type ItemCarrinho = { produto: Produto; cor: string; tamanho: string; quantidade: number };

type CartContextType = {
  itens: ItemCarrinho[];
  adicionar: (produto: Produto, cor: string, tamanho: string) => void;
  remover: (produtoId: string, cor: string, tamanho: string) => void;
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

  function adicionar(produto: Produto, cor: string, tamanho: string) {
    // dispara ANTES do setState (nao depende do resultado) - evento de rastreamento,
    // se falhar por qualquer motivo (ad blocker, etc.) nao pode impedir o carrinho de
    // funcionar, por isso fica fora do setter.
    rastrearAdicionarAoCarrinho({
      id: produto.id,
      nome: produto.nome,
      marca: produto.marca,
      preco: produto.preco,
      quantidade: 1
    });
    setItens((atual) => {
      const existente = atual.find(
        (i) => i.produto.id === produto.id && i.cor === cor && i.tamanho === tamanho
      );
      if (existente) {
        return atual.map((i) =>
          i.produto.id === produto.id && i.cor === cor && i.tamanho === tamanho
            ? { ...i, quantidade: i.quantidade + 1 }
            : i
        );
      }
      return [...atual, { produto, cor, tamanho, quantidade: 1 }];
    });
  }

  function remover(produtoId: string, cor: string, tamanho: string) {
    setItens((atual) =>
      atual.filter((i) => !(i.produto.id === produtoId && i.cor === cor && i.tamanho === tamanho))
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

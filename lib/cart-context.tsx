"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { idVarianteProduto, type Produto } from "@/lib/produtos";
import { rastrearAdicionarAoCarrinho } from "@/lib/tracking";

export type ItemCarrinho = { produto: Produto; cor: string; tamanho: string; quantidade: number };

type CartContextType = {
  itens: ItemCarrinho[];
  adicionar: (produto: Produto, cor: string, tamanho: string) => void;
  remover: (produtoId: string, cor: string, tamanho: string) => void;
  atualizarQuantidade: (produtoId: string, cor: string, tamanho: string, quantidade: number) => void;
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
      id: idVarianteProduto(produto.id, cor, tamanho),
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

  // Usado pelos botoes +/- e pelo campo de quantidade na pagina do carrinho - faltava essa
  // funcao (encontrado em 25/08/2026): o carrinho so' tinha "adicionar" (sempre soma 1, chamado
  // na pagina do produto) e "remover" (tira a linha inteira), sem jeito de so' AJUSTAR a
  // quantidade de um item ja no carrinho. Quantidade < 1 remove a linha (mesmo efeito de
  // "remover"), pra nao deixar item com quantidade zero/negativa no carrinho.
  function atualizarQuantidade(produtoId: string, cor: string, tamanho: string, quantidade: number) {
    if (quantidade < 1) {
      remover(produtoId, cor, tamanho);
      return;
    }
    setItens((atual) =>
      atual.map((i) =>
        i.produto.id === produtoId && i.cor === cor && i.tamanho === tamanho
          ? { ...i, quantidade }
          : i
      )
    );
  }

  function limpar() {
    setItens([]);
  }

  const total = itens.reduce((soma, i) => soma + i.produto.preco * i.quantidade, 0);

  return (
    <CartContext.Provider value={{ itens, adicionar, remover, atualizarQuantidade, limpar, total }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const contexto = useContext(CartContext);
  if (!contexto) throw new Error("useCart precisa estar dentro de <CartProvider>");
  return contexto;
}

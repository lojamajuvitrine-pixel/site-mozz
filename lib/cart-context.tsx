"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { estoqueDaVariante, idVarianteProduto, type Produto } from "@/lib/produtos";
import { rastrearAdicionarAoCarrinho } from "@/lib/tracking";

// maximo = quantas unidades tem no estoque dessa cor/tamanho, conferido quando a cliente abre o
// carrinho (ver sincronizarEstoque abaixo e app/api/estoque/conferir) - sem ele, vale o estoque que
// veio junto com o produto quando ela adicionou.
export type ItemCarrinho = { produto: Produto; cor: string; tamanho: string; quantidade: number; maximo?: number };

// Limite de quantidade de um item do carrinho (07/11/2026, pedido do Brunno: nao deixar colocar
// mais unidades do que tem em estoque). null = sem informacao de estoque - nao limita.
export function limiteDoItem(item: ItemCarrinho): number | null {
  return typeof item.maximo === "number" ? item.maximo : estoqueDaVariante(item.produto, item.cor, item.tamanho);
}

function descricaoDoItem(item: ItemCarrinho): string {
  return item.cor && item.cor !== "Único"
    ? `${item.produto.nome} (${item.cor}, ${item.tamanho})`
    : `${item.produto.nome} (${item.tamanho})`;
}

type CartContextType = {
  itens: ItemCarrinho[];
  // devolve false (e nao adiciona) quando todas as unidades desse tamanho ja' estao no carrinho
  adicionar: (produto: Produto, cor: string, tamanho: string) => boolean;
  remover: (produtoId: string, cor: string, tamanho: string) => void;
  atualizarQuantidade: (produtoId: string, cor: string, tamanho: string, quantidade: number) => void;
  limpar: () => void;
  // aplica o estoque de agora (app/api/estoque/conferir) e devolve os avisos pra mostrar
  sincronizarEstoque: (disponivel: Record<string, number | null>) => string[];
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

  function adicionar(produto: Produto, cor: string, tamanho: string): boolean {
    // Estoque de agora vem com o produto da pagina (estoque ao vivo) - se todas as unidades ja'
    // estao no carrinho, nao adiciona (a pagina do produto mostra o aviso).
    const limite = estoqueDaVariante(produto, cor, tamanho);
    const naSacola =
      itens.find((i) => i.produto.id === produto.id && i.cor === cor && i.tamanho === tamanho)?.quantidade ?? 0;
    if (limite !== null && naSacola >= limite) return false;

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
            ? { ...i, produto, quantidade: i.quantidade + 1, maximo: limite ?? undefined }
            : i
        );
      }
      return [...atual, { produto, cor, tamanho, quantidade: 1, ...(limite !== null ? { maximo: limite } : {}) }];
    });
    return true;
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
      atual.map((i) => {
        if (!(i.produto.id === produtoId && i.cor === cor && i.tamanho === tamanho)) return i;
        const limite = limiteDoItem(i);
        return { ...i, quantidade: limite !== null ? Math.min(quantidade, Math.max(limite, 1)) : quantidade };
      })
    );
  }

  // Estoque de agora pra cada peca do carrinho (chave = idVarianteProduto): 0 tira a peca, numero
  // menor que a quantidade ajusta, null deixa sem limite. Devolve os avisos pra mostrar pra cliente.
  function sincronizarEstoque(disponivel: Record<string, number | null>): string[] {
    const avisos: string[] = [];
    const novos: ItemCarrinho[] = [];
    for (const item of itens) {
      const chave = idVarianteProduto(item.produto.id, item.cor, item.tamanho);
      if (!(chave in disponivel)) {
        novos.push(item);
        continue;
      }
      const quantidade = disponivel[chave];
      if (quantidade === null) {
        novos.push({ ...item, maximo: undefined });
      } else if (quantidade <= 0) {
        avisos.push(`${descricaoDoItem(item)} esgotou e saiu do seu carrinho.`);
      } else if (item.quantidade > quantidade) {
        avisos.push(
          `Ajustamos ${item.produto.nome} para ${quantidade} ${quantidade === 1 ? "unidade" : "unidades"}, que é o que temos em estoque.`
        );
        novos.push({ ...item, quantidade, maximo: quantidade });
      } else {
        novos.push({ ...item, maximo: quantidade });
      }
    }
    setItens(novos);
    return avisos;
  }

  function limpar() {
    setItens([]);
  }

  const total = itens.reduce((soma, i) => soma + i.produto.preco * i.quantidade, 0);

  return (
    <CartContext.Provider value={{ itens, adicionar, remover, atualizarQuantidade, limpar, sincronizarEstoque, total }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const contexto = useContext(CartContext);
  if (!contexto) throw new Error("useCart precisa estar dentro de <CartProvider>");
  return contexto;
}

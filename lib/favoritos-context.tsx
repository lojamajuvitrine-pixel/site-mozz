"use client";

// Favoritos (coracao) - mesmo padrao do carrinho (lib/cart-context.tsx): guardado em
// localStorage, sem exigir login (a cliente marca enquanto navega, sem atrito nenhum). So'
// guarda o ID do produto (nao o objeto inteiro) - a pagina /favoritos casa esses IDs com o
// catalogo atual na hora de exibir, entao um produto que saiu do catalogo (fora de estoque,
// marca desativada) simplesmente some da lista sozinho, sem lixo acumulando.
import { createContext, useContext, useEffect, useState, ReactNode } from "react";

type FavoritosContextType = {
  favoritos: string[];
  ehFavorito: (produtoId: string) => boolean;
  alternarFavorito: (produtoId: string) => void;
};

const FavoritosContext = createContext<FavoritosContextType | null>(null);

const CHAVE_STORAGE = "mozz_favoritos";

export function FavoritosProvider({ children }: { children: ReactNode }) {
  const [favoritos, setFavoritos] = useState<string[]>([]);
  const [carregado, setCarregado] = useState(false);

  useEffect(() => {
    const salvo = window.localStorage.getItem(CHAVE_STORAGE);
    if (salvo) {
      try {
        setFavoritos(JSON.parse(salvo));
      } catch {
        // storage corrompido - ignora e comeca vazio
      }
    }
    setCarregado(true);
  }, []);

  useEffect(() => {
    if (carregado) {
      window.localStorage.setItem(CHAVE_STORAGE, JSON.stringify(favoritos));
    }
  }, [favoritos, carregado]);

  function ehFavorito(produtoId: string) {
    return favoritos.includes(produtoId);
  }

  function alternarFavorito(produtoId: string) {
    setFavoritos((atual) =>
      atual.includes(produtoId) ? atual.filter((id) => id !== produtoId) : [...atual, produtoId]
    );
  }

  return (
    <FavoritosContext.Provider value={{ favoritos, ehFavorito, alternarFavorito }}>
      {children}
    </FavoritosContext.Provider>
  );
}

export function useFavoritos() {
  const contexto = useContext(FavoritosContext);
  if (!contexto) throw new Error("useFavoritos precisa estar dentro de <FavoritosProvider>");
  return contexto;
}

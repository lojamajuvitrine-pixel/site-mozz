"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { Produto } from "@/lib/produtos";
import { coresDoProduto } from "@/lib/produtos";
import { formatarPreco } from "@/lib/formato";
import { useCart } from "@/lib/cart-context";

function IconeCarrinho() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="15" height="15">
      <path d="M6 8h12l-1 12a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1L6 8z" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
    </svg>
  );
}

function IconeCheck() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15">
      <path d="M5 12l5 5L20 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Card de produto do mosaico/grade - usado na home, no catalogo (/produtos) e nas paginas
// de marca. No hover (desktop) mostra um botao de adicionar rapido ao carrinho, que usa a
// primeira cor/tamanho disponivel do produto (pra escolher outra cor/tamanho, o cliente
// clica no card normalmente e vai pra pagina do produto).
export default function ProductCard({ produto }: { produto: Produto }) {
  const { adicionar } = useCart();
  const [adicionado, setAdicionado] = useState(false);

  function adicionarRapido(evento: React.MouseEvent) {
    evento.preventDefault();
    evento.stopPropagation();
    const [corPadrao] = coresDoProduto(produto);
    adicionar(produto, corPadrao.cor, corPadrao.tamanhos[0]);
    setAdicionado(true);
    setTimeout(() => setAdicionado(false), 1500);
  }

  return (
    <Link href={`/produto/${produto.id}`} className="block group">
      <div className="relative aspect-[3/4] bg-mozz-stone flex items-center justify-center overflow-hidden">
        {produto.novo && (
          <span className="absolute top-2 left-2 z-10 text-[10px] bg-mozz-black text-white px-2 py-0.5">
            Novo
          </span>
        )}
        {produto.imagem ? (
          <Image
            src={produto.imagem}
            alt={produto.nome}
            fill
            sizes="(max-width: 768px) 50vw, 25vw"
            // card pequeno do mosaico - qualidade mais baixa (o olho nao percebe nesse
            // tamanho) pra carregar rapido mesmo com varios produtos na tela ao mesmo tempo.
            // A foto grande da pagina do produto usa qualidade alta (ver SeletorProduto.tsx).
            quality={60}
            className="object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <span className="text-mozz-gray text-xs">foto do produto</span>
        )}

        {produto.imagem && (
          <button
            onClick={adicionarRapido}
            aria-label="Adicionar ao carrinho"
            title="Adicionar ao carrinho"
            className={`absolute bottom-2 right-2 z-10 w-8 h-8 flex items-center justify-center bg-white text-mozz-black
              opacity-0 group-hover:opacity-100 transition-opacity hover:bg-mozz-black hover:text-white`}
          >
            {adicionado ? <IconeCheck /> : <IconeCarrinho />}
          </button>
        )}
      </div>
      <p className="text-[12.5px] mt-2">{produto.nome}</p>
      <p className="text-[12.5px] text-mozz-gray">{formatarPreco(produto.preco)}</p>
    </Link>
  );
}

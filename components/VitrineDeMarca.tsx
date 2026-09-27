"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef } from "react";
import ProductCard from "@/components/ProductCard";
import type { Produto } from "@/lib/produtos";

type Props = {
  marca: string;
  slug: string;
  categoria: string;
  headline: string;
  descricao: string;
  produtos: Produto[];
};

function IconeSetaCarrossel({ direcao }: { direcao: "esquerda" | "direita" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="18" height="18">
      <path
        d={direcao === "esquerda" ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Bloco "vitrine por marca" pra home - REFEITO em 27/09/2026 depois do Brunno mandar o print
// certo do site oqvestir ("Semana do Jeans"): uma FOTO GRANDE de campanha (modelo vestindo a
// colecao) do lado esquerdo, com o texto/CTA por cima dela, e o carrossel de produtos
// continuando a direita - bem diferente da primeira versao (que so' tinha texto solto do lado
// do carrossel, sem foto nenhuma, o que o Brunno reclamou que ficava "peca solta na pagina").
// A foto usada e' a foto de capa da PRIMEIRA peca destaque da marca (mesma foto que ja aparece
// no primeiro card do carrossel) - nao e' uma foto de campanha separada, ja que nao existe
// esse tipo de foto no catalogo hoje (so' foto de produto isolado, sem modelo em still de
// campanha). Continua escondendo o bloco inteiro se a marca nao tiver nenhuma peca destaque.
//
// ATUALIZADO em 27/09/2026: trocada a barra de rolagem do carrossel por setas de clique -
// pedido do Brunno pra nao aparecer scrollbar, so' as flechas do lado pra navegar. Por isso
// virou "use client": precisa de uma ref pro elemento do carrossel pra chamar scrollBy() nele
// quando clica na seta, e isso so' roda no navegador (nao da' pra fazer em componente de
// servidor). No celular o arrastar/swipe continua funcionando normalmente - as setas ficam
// escondidas ai' (nao tem como arrastar E ter seta ocupando espaco na tela pequena), so'
// aparecem a partir do tablet/desktop. A barra visual de rolagem fica escondida em qualquer
// tamanho de tela (classe "scrollbar-hide" em app/globals.css).
export default function VitrineDeMarca({ marca, slug, categoria, headline, descricao, produtos }: Props) {
  const carrosselRef = useRef<HTMLDivElement>(null);

  if (produtos.length === 0) return null;
  const fotoCapa = produtos[0].imagem;

  function rolar(direcao: "esquerda" | "direita") {
    const elemento = carrosselRef.current;
    if (!elemento) return;
    const distancia = elemento.clientWidth * 0.8;
    elemento.scrollBy({ left: direcao === "esquerda" ? -distancia : distancia, behavior: "smooth" });
  }

  return (
    <section className="py-10 border-t border-black/10">
      <div className="flex flex-col md:flex-row gap-6">
        {fotoCapa && (
          <div className="relative w-full aspect-[4/5] md:w-[260px] md:h-[440px] md:aspect-auto shrink-0 bg-mozz-stone">
            <Image
              src={fotoCapa}
              alt={`Campanha ${marca}`}
              fill
              sizes="(max-width: 768px) 100vw, 260px"
              quality={80}
              className="object-cover"
            />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <p className="text-[13px] text-mozz-gray tracking-widest uppercase mb-1">{categoria}</p>
          <p className="font-serif text-2xl md:text-[26px] mb-2">{headline}</p>
          <p className="text-[14px] text-mozz-gray max-w-md mb-4">{descricao}</p>
          <Link
            href={`/marca/${slug}`}
            className="inline-block bg-mozz-black text-white text-[13.5px] px-5 py-3 hover:opacity-90 transition-opacity mb-6"
          >
            Ver coleção {marca}
          </Link>

          <div className="relative">
            <div
              ref={carrosselRef}
              className="scrollbar-hide flex gap-4 overflow-x-auto scroll-smooth pb-2 -mx-6 px-6 md:mx-0 md:px-0 snap-x snap-mandatory"
            >
              {produtos.slice(0, 8).map((produto) => (
                <div key={produto.id} className="w-[46%] md:w-[200px] shrink-0 snap-start">
                  <ProductCard produto={produto} />
                </div>
              ))}
            </div>

            {produtos.length > 2 && (
              <>
                <button
                  type="button"
                  onClick={() => rolar("esquerda")}
                  aria-label={`Ver peças anteriores da ${marca}`}
                  className="hidden md:flex items-center justify-center absolute left-0 top-[38%] -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 border border-black/15 shadow-sm hover:bg-mozz-stone transition-colors"
                >
                  <IconeSetaCarrossel direcao="esquerda" />
                </button>
                <button
                  type="button"
                  onClick={() => rolar("direita")}
                  aria-label={`Ver mais peças da ${marca}`}
                  className="hidden md:flex items-center justify-center absolute right-0 top-[38%] -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 border border-black/15 shadow-sm hover:bg-mozz-stone transition-colors"
                >
                  <IconeSetaCarrossel direcao="direita" />
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

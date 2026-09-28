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
  fotoCapa?: string;
  corDestaque?: string;
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

export default function VitrineDeMarca({
  marca,
  slug,
  categoria,
  headline,
  descricao,
  produtos,
  fotoCapa,
  corDestaque
}: Props) {
  const carrosselRef = useRef<HTMLDivElement>(null);

  if (produtos.length === 0) return null;
  const foto = fotoCapa ?? produtos[0].imagem;

  function rolar(direcao: "esquerda" | "direita") {
    const elemento = carrosselRef.current;
    if (!elemento) return;
    const distancia = elemento.clientWidth * 0.8;
    elemento.scrollBy({ left: direcao === "esquerda" ? -distancia : distancia, behavior: "smooth" });
  }

  return (
    <section className="py-10 border-t border-black/10">
      <div className="flex flex-col md:flex-row gap-6">
        {foto && (
          <div className="relative w-full aspect-[4/5] md:w-[260px] md:h-[440px] md:aspect-auto shrink-0 bg-mozz-stone">
            <Image
              src={foto}
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
            {corDestaque && (
              <div
                aria-hidden
                className="pointer-events-none absolute -inset-x-4 -inset-y-6 -z-10 rounded-[40px] blur-3xl opacity-40"
                style={{ backgroundColor: corDestaque }}
              />
            )}
            <div
              ref={carrosselRef}
              className="scrollbar-hide flex gap-4 overflow-x-auto scroll-smooth pb-2 -mx-6 px-6 md:mx-0 md:px-0 snap-x snap-mandatory"
            >
              {produtos.slice(0, 8).map((produto) => (
                <div key={produto.id} className="w-[46%] md:w-[200px] shrink-0 snap-start">
                  <ProductCard
                    produto={produto}
                    mostrarCarrosselFoto={false}
                    mostrarFavorito={false}
                  />
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

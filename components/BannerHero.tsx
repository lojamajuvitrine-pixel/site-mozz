"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";

export type BannerItem = { imagem: string; marca: string; label: string; href: string };

// Banner principal da home - proporcao editorial (bem larga no desktop, mais vertical no
// celular, no estilo dos grandes sites de moda) e rotativo entre as imagens recebidas (hoje:
// uma masculina/Reserva, uma feminina/Animale) com troca automatica a cada alguns segundos
// e bolinhas pra trocar na mao.
export default function BannerHero({ banners }: { banners: BannerItem[] }) {
  const [indice, setIndice] = useState(0);

  useEffect(() => {
    if (banners.length <= 1) return;
    const intervalo = setInterval(() => setIndice((i) => (i + 1) % banners.length), 6000);
    return () => clearInterval(intervalo);
  }, [banners.length]);

  if (banners.length === 0) return null;
  const atual = banners[indice];

  return (
    <section className="relative -mx-6 aspect-[4/5] md:aspect-[21/9] bg-mozz-black overflow-hidden">
      {banners.map((banner, i) => (
        <Image
          key={banner.imagem}
          src={banner.imagem}
          alt=""
          fill
          priority={i === 0}
          sizes="100vw"
          quality={85}
          className={`object-cover transition-opacity duration-700 ${i === indice ? "opacity-80" : "opacity-0"}`}
        />
      ))}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-black/30" />
      <div className="absolute inset-0 flex flex-col items-center justify-end text-center pb-16 px-6">
        <p className="text-[13px] text-white/80 tracking-widest2 uppercase mb-2">{atual.label}</p>
        <p className="font-serif text-white text-[44px] md:text-[58px] tracking-wide leading-none">
          Inverno 26
        </p>
        <p className="text-[14.5px] text-white/80 mt-3 mb-7">Animale · NV · Reserva · Foxton</p>
        <Link
          href={atual.href}
          className="inline-block text-[14.5px] px-7 py-2.5 bg-white text-mozz-black hover:bg-mozz-stone transition-colors"
        >
          Ver coleção {atual.marca}
        </Link>
      </div>

      {banners.length > 1 && (
        <div className="absolute bottom-4 right-4 flex gap-1.5">
          {banners.map((banner, i) => (
            <button
              key={banner.imagem}
              onClick={() => setIndice(i)}
              aria-label={`Ver banner ${banner.label}`}
              className={`w-1.5 h-1.5 rounded-full transition-colors ${i === indice ? "bg-white" : "bg-white/40"}`}
            />
          ))}
        </div>
      )}
    </section>
  );
}

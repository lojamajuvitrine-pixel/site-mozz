"use client";

import { useState } from "react";
import Link from "next/link";
import BarraBusca from "@/components/BarraBusca";

const marcas = ["Animale", "NV", "Reserva", "Foxton"];

function IconeMenu({ aberto }: { aberto: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" width="20" height="20">
      {aberto ? (
        <path d="M6 6l12 12M6 18L18 6" strokeLinecap="round" />
      ) : (
        <>
          <line x1="4" y1="7" x2="20" y2="7" strokeLinecap="round" />
          <line x1="4" y1="12" x2="20" y2="12" strokeLinecap="round" />
          <line x1="4" y1="17" x2="20" y2="17" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}

function IconeSacola() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="19" height="19">
      <path d="M6 8h12l-1 12a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1L6 8z" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
    </svg>
  );
}

// No celular, marcas e busca ficam escondidas atras do menu hamburguer (economiza espaco
// vertical logo na entrada do site) e o carrinho vira so' um icone; no desktop tudo continua
// sempre visivel como antes. E' o mesmo componente Nav pros dois casos, so' o CSS (md:) que
// alterna o comportamento.
export default function Nav() {
  const [menuAberto, setMenuAberto] = useState(false);

  return (
    <header className="border-b border-black/10">
      <div className="text-center text-[12.5px] py-1.5 text-mozz-gray px-2">
        Frete grátis acima de R$399 · Troca em 30 dias
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center px-4 md:px-6 py-4 max-w-6xl mx-auto">
        <button
          onClick={() => setMenuAberto((v) => !v)}
          aria-label={menuAberto ? "Fechar menu" : "Abrir menu"}
          className="md:hidden justify-self-start p-1 -ml-1"
        >
          <IconeMenu aberto={menuAberto} />
        </button>
        <div className="hidden md:block" />

        <Link href="/" className="text-center" onClick={() => setMenuAberto(false)}>
          <div className="font-serif text-3xl leading-none">M</div>
          <div className="font-serif text-[14.5px] tracking-widest2">MOZZ</div>
        </Link>

        <div className="flex justify-end items-center gap-4 text-[14.5px] text-mozz-black/80">
          <Link href="/carrinho" aria-label="Carrinho" className="md:hidden p-1 -mr-1">
            <IconeSacola />
          </Link>
          <Link href="/carrinho" className="hidden md:inline">
            Carrinho
          </Link>
        </div>
      </div>

      <div
        className={`${
          menuAberto ? "flex" : "hidden"
        } md:flex flex-col md:flex-row items-center md:justify-center gap-4 md:gap-6 px-4 md:px-6 pb-3 text-[13.5px] text-mozz-gray`}
      >
        {marcas.map((marca) => (
          <Link key={marca} href={`/marca/${marca.toLowerCase()}`} onClick={() => setMenuAberto(false)}>
            {marca}
          </Link>
        ))}
      </div>
      <div className={`${menuAberto ? "block" : "hidden"} md:block px-4 md:px-6 pb-3`}>
        <BarraBusca />
      </div>
    </header>
  );
}

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

function IconeConta() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="19" height="19">
      <circle cx="12" cy="8" r="3.2" />
      <path d="M5 20c1.2-3.8 4-5.6 7-5.6s5.8 1.8 7 5.6" strokeLinecap="round" />
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
      <div className="grid grid-cols-[1fr_auto_1fr] items-center px-4 md:px-6 py-3 max-w-6xl mx-auto">
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

        <div className="flex justify-end items-center gap-3 text-[14.5px] text-mozz-black/80">
          <Link href="/conta" aria-label="Minha conta" className="p-1">
            <IconeConta />
          </Link>
          <Link href="/carrinho" aria-label="Carrinho" className="p-1 -mr-1">
            <IconeSacola />
          </Link>
        </div>
      </div>

      <div
        className={`${
          menuAberto ? "flex" : "hidden"
        } md:flex flex-col md:flex-row items-center md:justify-between gap-4 md:gap-6 px-4 md:px-6 pb-3 text-[13.5px] text-mozz-gray`}
      >
        <div className="flex flex-col md:flex-row items-center gap-4 md:gap-6">
          {marcas.map((marca) => (
            <Link key={marca} href={`/marca/${marca.toLowerCase()}`} onClick={() => setMenuAberto(false)}>
              {marca}
            </Link>
          ))}
        </div>
        <div className="w-full md:w-auto md:max-w-xs">
          <BarraBusca />
        </div>
      </div>
    </header>
  );
}

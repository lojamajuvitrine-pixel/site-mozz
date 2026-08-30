"use client";

import { useState } from "react";
import Link from "next/link";
import BarraBusca from "@/components/BarraBusca";
import { useFavoritos } from "@/lib/favoritos-context";

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

function IconeCoracaoNav() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="19" height="19">
      <path
        d="M12 20.5s-7.5-4.6-10-9.3C.5 8 1.9 4.5 5.3 4c2-.3 3.9.7 4.8 2.4.9-1.7 2.8-2.7 4.8-2.4 3.4.5 4.8 4 3.3 7.2-2.5 4.7-10 9.3-10 9.3z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Badge numerico (contagem de favoritos) - mesma posicao/estilo nos dois layouts.
function BadgeContagem({ valor }: { valor: number }) {
  if (valor === 0) return null;
  return (
    <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-mozz-black text-white text-[10px] leading-4 text-center">
      {valor}
    </span>
  );
}

// Dois layouts BEM diferentes (desktop vs mobile), cada um so' visivel no seu breakpoint
// (md:hidden / hidden md:flex) - mais simples de manter do que forcar a mesma grade nos
// dois tamanhos de tela.
//
// Desktop: tudo numa linha so' (logo, marcas, busca, conta, carrinho), estilo Reserva/grandes
// sites de moda - a busca fica so' o icone, clica pra abrir o campo (ver BarraBusca).
// Mobile: logo central + hamburguer + conta/carrinho, marcas e busca ficam atras do menu.
export default function Nav() {
  const [menuAberto, setMenuAberto] = useState(false);
  const { favoritos } = useFavoritos();

  return (
    <header className="border-b border-black/10">
      {/* --- Desktop --- */}
      <div className="hidden md:flex items-center gap-8 px-6 py-4 max-w-6xl mx-auto">
        <Link href="/" className="text-center shrink-0 -ml-2">
          <div className="font-serif text-3xl leading-none">M</div>
          <div className="font-serif text-[14.5px] tracking-widest2">MOZZ</div>
        </Link>

        <nav className="flex items-center gap-6 text-[14.5px] text-mozz-gray">
          {marcas.map((marca) => (
            <Link key={marca} href={`/marca/${marca.toLowerCase()}`} className="hover:text-mozz-black transition-colors">
              {marca}
            </Link>
          ))}
          <Link href="/outlet" className="hover:text-mozz-black transition-colors">
            Outlet
          </Link>
          <Link href="/quem-somos" className="hover:text-mozz-black transition-colors">
            Quem somos
          </Link>
        </nav>

        <div className="flex-1" />

        <div className="flex items-center gap-4 text-mozz-black/80">
          <BarraBusca expansivel />
          <Link href="/conta" aria-label="Minha conta" className="p-1">
            <IconeConta />
          </Link>
          <Link href="/favoritos" aria-label="Favoritos" className="relative p-1">
            <IconeCoracaoNav />
            <BadgeContagem valor={favoritos.length} />
          </Link>
          <Link href="/carrinho" aria-label="Carrinho" className="p-1">
            <IconeSacola />
          </Link>
        </div>
      </div>

      {/* --- Mobile --- */}
      <div className="md:hidden">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center px-4 py-3">
          <button
            onClick={() => setMenuAberto((v) => !v)}
            aria-label={menuAberto ? "Fechar menu" : "Abrir menu"}
            className="justify-self-start p-1 -ml-1"
          >
            <IconeMenu aberto={menuAberto} />
          </button>

          <Link href="/" className="text-center" onClick={() => setMenuAberto(false)}>
            <div className="font-serif text-3xl leading-none">M</div>
            <div className="font-serif text-[14.5px] tracking-widest2">MOZZ</div>
          </Link>

          <div className="flex justify-end items-center gap-3 text-mozz-black/80">
            <Link href="/conta" aria-label="Minha conta" className="p-1">
              <IconeConta />
            </Link>
            <Link href="/favoritos" aria-label="Favoritos" className="relative p-1">
              <IconeCoracaoNav />
              <BadgeContagem valor={favoritos.length} />
            </Link>
            <Link href="/carrinho" aria-label="Carrinho" className="p-1 -mr-1">
              <IconeSacola />
            </Link>
          </div>
        </div>

        <div
          className={`${
            menuAberto ? "flex" : "hidden"
          } flex-col items-center gap-4 px-4 pb-4 text-[13.5px] text-mozz-gray`}
        >
          {marcas.map((marca) => (
            <Link key={marca} href={`/marca/${marca.toLowerCase()}`} onClick={() => setMenuAberto(false)}>
              {marca}
            </Link>
          ))}
          <Link href="/outlet" onClick={() => setMenuAberto(false)}>
            Outlet
          </Link>
          <Link href="/quem-somos" onClick={() => setMenuAberto(false)}>
            Quem somos
          </Link>
          <div className="w-full">
            <BarraBusca />
          </div>
        </div>
      </div>
    </header>
  );
}

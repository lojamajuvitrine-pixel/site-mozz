"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

function IconeBusca() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="14" height="14">
      <circle cx="11" cy="11" r="6" />
      <line x1="20" y1="20" x2="15.5" y2="15.5" strokeLinecap="round" />
    </svg>
  );
}

// Barra de busca do menu - manda pro catalogo com o termo na URL (/produtos?busca=X), onde
// GradeProdutos filtra de verdade (e tambem deixa continuar refinando a busca por la').
export default function BarraBusca() {
  const router = useRouter();
  const [termo, setTermo] = useState("");

  function buscar(evento: React.FormEvent) {
    evento.preventDefault();
    const termoLimpo = termo.trim();
    router.push(termoLimpo ? `/produtos?busca=${encodeURIComponent(termoLimpo)}` : "/produtos");
  }

  return (
    <form
      onSubmit={buscar}
      className="flex items-center gap-2 border border-black/15 px-3 py-1.5 w-full max-w-xs mx-auto text-mozz-gray focus-within:border-mozz-black focus-within:text-mozz-black"
    >
      <IconeBusca />
      <input
        value={termo}
        onChange={(evento) => setTermo(evento.target.value)}
        placeholder="Buscar produtos..."
        className="flex-1 text-[13.5px] outline-none text-mozz-black placeholder:text-mozz-gray bg-transparent"
      />
    </form>
  );
}

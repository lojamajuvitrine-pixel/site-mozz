"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

function IconeBusca({ tamanho = 18 }: { tamanho?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" width={tamanho} height={tamanho}>
      <circle cx="11" cy="11" r="6" />
      <line x1="20" y1="20" x2="15.5" y2="15.5" strokeLinecap="round" />
    </svg>
  );
}

// Barra de busca do menu - manda pro catalogo com o termo na URL (/produtos?busca=X), onde
// GradeProdutos filtra de verdade.
//
// Pacote 2 (aprovado pelo Brunno em 07/11/2026): no computador deixou de ser so' a lupa que
// abria um campo flutuante - agora e' um campo sempre visivel com "BUSCA..." em cinza claro
// antes de digitar e a lupa dentro do campo. O mesmo campo aparece dentro do menu do celular.
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
      role="search"
      className="flex items-center w-full border border-black/20 bg-white focus-within:border-mozz-black transition-colors"
    >
      <input
        value={termo}
        onChange={(evento) => setTermo(evento.target.value)}
        placeholder="BUSCA..."
        aria-label="Buscar produtos"
        className="flex-1 min-w-0 pl-3 py-2 text-[14px] outline-none text-mozz-black placeholder:text-black/35 placeholder:tracking-wide bg-transparent"
      />
      <button type="submit" aria-label="Buscar" className="px-3 py-2 text-mozz-black/70 hover:text-mozz-black">
        <IconeBusca />
      </button>
    </form>
  );
}

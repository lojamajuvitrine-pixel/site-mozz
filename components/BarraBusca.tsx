"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

function IconeBusca({ tamanho = 14 }: { tamanho?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width={tamanho} height={tamanho}>
      <circle cx="11" cy="11" r="6" />
      <line x1="20" y1="20" x2="15.5" y2="15.5" strokeLinecap="round" />
    </svg>
  );
}

// Barra de busca do menu - manda pro catalogo com o termo na URL (/produtos?busca=X), onde
// GradeProdutos filtra de verdade (e tambem deixa continuar refinando a busca por la').
//
// "expansivel" = true: usada no cabecalho de uma linha so' (desktop) - fica so' o icone,
// clicar abre um campo flutuante por cima do resto do menu (estilo a maioria dos grandes
// sites de moda). "expansivel" = false (padrao): campo sempre visivel, usado dentro do menu
// hamburguer no celular, onde ja tem espaco reservado pra isso.
export default function BarraBusca({ expansivel = false }: { expansivel?: boolean }) {
  const router = useRouter();
  const [termo, setTermo] = useState("");
  const [aberta, setAberta] = useState(false);

  function buscar(evento: React.FormEvent) {
    evento.preventDefault();
    const termoLimpo = termo.trim();
    router.push(termoLimpo ? `/produtos?busca=${encodeURIComponent(termoLimpo)}` : "/produtos");
    setAberta(false);
  }

  const campo = (
    <form
      onSubmit={buscar}
      className="flex items-center gap-2 border border-black/15 px-3 py-1.5 w-full max-w-xs mx-auto text-mozz-gray focus-within:border-mozz-black focus-within:text-mozz-black"
    >
      <IconeBusca />
      <input
        value={termo}
        onChange={(evento) => setTermo(evento.target.value)}
        placeholder="Buscar produtos..."
        autoFocus={expansivel}
        className="flex-1 text-[13.5px] outline-none text-mozz-black placeholder:text-mozz-gray bg-transparent"
      />
    </form>
  );

  if (!expansivel) return campo;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setAberta((v) => !v)}
        aria-label={aberta ? "Fechar busca" : "Buscar"}
        className="p-1"
      >
        <IconeBusca tamanho={19} />
      </button>
      {aberta && (
        <div className="absolute right-0 top-full mt-2 w-64 bg-white shadow-lg p-2 z-10">{campo}</div>
      )}
    </div>
  );
}

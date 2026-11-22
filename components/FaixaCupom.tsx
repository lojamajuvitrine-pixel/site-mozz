"use client";

import { usePathname } from "next/navigation";
import { PERCENTUAL_DESCONTO_PIX } from "@/lib/formato";

// Faixa fina no topo de todas as paginas da loja. 22/11/2026 (Brunno): sem cupom e sem frete
// gratis por enquanto - mostra "Enviamos para todo o Brasil" + Pix em todas as pecas.
// (Antes, 19/10/2026: lembrava o
// cupom de primeira compra e o desconto do Pix.) O valor do cupom (15%) esta em lib/cupons.ts -
// se mudar la', mude aqui tambem. Sempre em UMA linha so' (pedido do Brunno, 19/10/2026): no
// celular usa um texto um pouco mais curto e letra menor; a partir de 640px, o texto completo.
export default function FaixaCupom() {
  const pathname = usePathname();
  if (pathname?.startsWith("/admin")) return null;

  return (
    <div className="bg-mozz-black text-white text-center px-2 py-2 leading-snug whitespace-nowrap overflow-hidden">
      <span className="sm:hidden text-[11px]">
        Enviamos para todo o Brasil
        <span className="mx-1.5 opacity-60">·</span>
        Pix: {PERCENTUAL_DESCONTO_PIX}% OFF em todas as peças
      </span>
      <span className="hidden sm:inline text-[12.5px]">
        Enviamos para todo o Brasil
        <span className="mx-2 opacity-60">·</span>
        Pix: {PERCENTUAL_DESCONTO_PIX}% OFF em todas as peças
      </span>
    </div>
  );
}

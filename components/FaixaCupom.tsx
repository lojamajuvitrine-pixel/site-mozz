"use client";

import { usePathname } from "next/navigation";
import { PERCENTUAL_DESCONTO_PIX } from "@/lib/formato";

// Faixa fina no topo de todas as paginas da loja (19/10/2026, pedido do Brunno): lembra o
// cupom de primeira compra e o desconto do Pix. O valor do cupom (15%) esta em lib/cupons.ts -
// se mudar la', mude aqui tambem.
export default function FaixaCupom() {
  const pathname = usePathname();
  if (pathname?.startsWith("/admin")) return null;

  return (
    <div className="bg-mozz-black text-white text-center text-[12.5px] px-4 py-2 leading-snug">
      1ª compra: 15% OFF com o cupom <strong className="font-semibold">PRIMEIRACOMPRA</strong>
      <span className="mx-2 opacity-60">·</span>
      Pix: {PERCENTUAL_DESCONTO_PIX}% OFF
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { formatarPreco, PERCENTUAL_DESCONTO_PIX } from "@/lib/formato";
import { freteGratisSuspensoNaBlack } from "@/lib/blackFridayDatas";

// Faixa fina no topo de todas as paginas da loja. 22/11/2026 (Brunno): sem cupom. Mostra o frete
// gratis (valor do painel) ate' a Black; durante a Black (frete pago) mostra "Enviamos para todo o
// Brasil". Mais o Pix em todas as pecas. Sempre em UMA linha so' (pedido do Brunno, 19/10/2026).
export default function FaixaCupom() {
  const pathname = usePathname();
  const [freteGratis, setFreteGratis] = useState<number | null>(null);

  useEffect(() => {
    if (freteGratisSuspensoNaBlack()) return;
    fetch("/api/config-loja")
      .then((r) => r.json())
      .then((config) => setFreteGratis(config?.freteGratisAcimaDe ?? null))
      .catch(() => {});
  }, []);

  if (pathname?.startsWith("/admin")) return null;

  const frete = freteGratis ? `Frete grátis acima de ${formatarPreco(freteGratis)}` : "Enviamos para todo o Brasil";

  return (
    <div className="bg-mozz-black text-white text-center px-2 py-2 leading-snug whitespace-nowrap overflow-hidden">
      <span className="sm:hidden text-[11px]">
        {frete}
        <span className="mx-1.5 opacity-60">·</span>
        Pix {PERCENTUAL_DESCONTO_PIX}% OFF
      </span>
      <span className="hidden sm:inline text-[12.5px]">
        {frete}
        <span className="mx-2 opacity-60">·</span>
        Pix: {PERCENTUAL_DESCONTO_PIX}% OFF em todas as peças
      </span>
    </div>
  );
}

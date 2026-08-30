"use client";

import { formatarPreco } from "@/lib/formato";

function IconeCaminhao() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" width="16" height="16" className="shrink-0">
      <rect x="1.5" y="7" width="12" height="9" rx="1" />
      <path d="M13.5 10h4l3.5 3.5V16h-2" strokeLinejoin="round" />
      <circle cx="6" cy="18" r="1.8" />
      <circle cx="16.5" cy="18" r="1.8" />
    </svg>
  );
}

// Banner de frete gratis - usado na pagina do produto (so' informativo, ver
// components/SeletorProduto.tsx) e no carrinho (com progresso ate' o valor minimo, ver
// app/carrinho/page.tsx). Pedido do Brunno em 30/08/2026: a informacao de frete gratis
// precisa aparecer bem visivel nas duas paginas, nao so' escondida dentro do calculo de
// frete por CEP (onde ja existia so' como texto pequeno).
//
// subtotal e' opcional - quando informado, mostra progresso ("faltam R$X") ou confirmacao
// ("frete gratis aplicado"); sem ele, mostra so' a regra ("frete gratis acima de R$X"),
// usado na pagina do produto onde nao faz sentido comparar com o carrinho inteiro.
export default function AvisoFreteGratis({
  limiar,
  subtotal
}: {
  limiar: number | null;
  subtotal?: number;
}) {
  if (limiar === null) return null;

  const conquistado = subtotal !== undefined && subtotal >= limiar;

  return (
    <div
      className={`flex items-center gap-2 text-[13px] px-3 py-2 border mt-3 ${
        conquistado ? "bg-green-50 border-green-200 text-green-800" : "bg-mozz-stone border-black/10 text-mozz-black"
      }`}
    >
      <IconeCaminhao />
      <span>
        {conquistado
          ? "Frete grátis aplicado nessa compra."
          : subtotal !== undefined
            ? `Faltam ${formatarPreco(Math.max(0, limiar - subtotal))} pra ganhar frete grátis.`
            : `Frete grátis em compras acima de ${formatarPreco(limiar)}.`}
      </span>
    </div>
  );
}

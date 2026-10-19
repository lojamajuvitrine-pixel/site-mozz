"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { formatarPreco, MAX_PARCELAS_SEM_JUROS } from "@/lib/formato";

// Faixa de beneficios logo abaixo do cabecalho, em todas as paginas da loja (pedido do Brunno em
// 19/10/2026 - mostrar parcelamento, troca, frete gratis e compra segura logo de cara, pra dar
// confianca a quem chega sem conhecer a loja). O valor do frete gratis vem da configuracao da
// loja (/admin/produtos) - comeca com o valor atual e atualiza sozinho se a configuracao mudar.
const FRETE_GRATIS_PADRAO = 399;

export default function FaixaBeneficios() {
  const pathname = usePathname();
  const [freteGratisAcimaDe, setFreteGratisAcimaDe] = useState<number | null>(FRETE_GRATIS_PADRAO);

  useEffect(() => {
    fetch("/api/config-loja")
      .then((r) => r.json())
      .then((config) => setFreteGratisAcimaDe(config?.freteGratisAcimaDe ?? null))
      .catch(() => {});
  }, []);

  if (pathname?.startsWith("/admin")) return null;

  const itens = [
    { titulo: `Até ${MAX_PARCELAS_SEM_JUROS}x sem juros`, detalhe: "no cartão de crédito", destaque: true },
    { titulo: "Troca em 30 dias", detalhe: "1ª troca grátis", destaque: true },
    freteGratisAcimaDe
      ? { titulo: "Frete grátis", detalhe: `acima de ${formatarPreco(freteGratisAcimaDe)}`, destaque: false }
      : { titulo: "Enviamos para todo o Brasil", detalhe: "calcule o frete pelo CEP", destaque: false },
    { titulo: "Compra segura", detalhe: "pagamento pelo Mercado Pago", destaque: false }
  ];

  return (
    <div className="bg-mozz-stone border-b border-black/10">
      <div className="max-w-[1600px] mx-auto px-4 md:px-6 py-3 grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-3 text-center">
        {itens.map((item) => (
          <div key={item.titulo}>
            <p className={`text-mozz-black ${item.destaque ? "text-[14px] font-semibold" : "text-[13.5px] font-medium"}`}>
              {item.titulo}
            </p>
            <p className="text-[12px] text-mozz-gray">{item.detalhe}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

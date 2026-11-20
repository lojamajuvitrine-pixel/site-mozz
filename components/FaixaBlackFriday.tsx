"use client";

import Link from "next/link";
import ContagemRegressiva from "@/components/black-friday/ContagemRegressiva";
import { BLACK_FRIDAY_ABERTURA, BLACK_FRIDAY_FIM } from "@/lib/blackFridayDatas";

// Faixa da Black Friday no topo da home (textos aprovados pelo Brunno em 20/11/2026).
// Antes de 28/11 00h: "comeca em" + chamada pro cadastro. De 28/11 a 30/11: "termina em".
// Depois de 30/11 23h59 some sozinha. Calculada no navegador pra trocar na hora certa.
export default function FaixaBlackFriday() {
  const agora = Date.now();
  if (agora > Date.parse(BLACK_FRIDAY_FIM)) return null;
  const aberta = agora >= Date.parse(BLACK_FRIDAY_ABERTURA);

  return (
    <Link
      href="/black-friday"
      className="-mx-6 block bg-black px-4 py-2.5 text-center text-[12.5px] md:text-[13.5px] uppercase tracking-[0.12em] text-white"
    >
      <span className="font-extrabold">Black Friday Mozz</span>
      <span className="mx-2 text-white/40">·</span>
      <span style={{ color: "#C9A24B" }}>
        {aberta ? "termina em " : "começa em "}
        <span className="text-white">
          {aberta ? (
            <ContagemRegressiva alvo={BLACK_FRIDAY_FIM} compacta recarregarAoFim={false} />
          ) : (
            <ContagemRegressiva alvo={BLACK_FRIDAY_ABERTURA} compacta />
          )}
        </span>
      </span>
      <span className="mx-2 text-white/40">·</span>
      <span className="underline underline-offset-4">{aberta ? "Ver ofertas" : "Cadastre-se e compre antes"} →</span>
    </Link>
  );
}

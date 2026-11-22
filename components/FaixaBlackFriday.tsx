"use client";

import Link from "next/link";
import ContagemRegressiva from "@/components/black-friday/ContagemRegressiva";
import { BLACK_FRIDAY_ABERTURA, BLACK_FRIDAY_FIM } from "@/lib/blackFridayDatas";

const OURO = "#C9A24B";

// Banner da Black Friday no topo da home (textos aprovados pelo Brunno em 20/11/2026).
// Antes de 27/11 00h: contagem ate' a abertura + "Quero acesso antecipado" (leva ao cadastro).
// De 27/11 a 30/11: "termina em" + "Ver ofertas". Depois de 30/11 23h59 some sozinho.
// Calculado no navegador pra trocar de fase na hora certa.
export default function FaixaBlackFriday() {
  const agora = Date.now();
  if (agora > Date.parse(BLACK_FRIDAY_FIM)) return null;
  const aberta = agora >= Date.parse(BLACK_FRIDAY_ABERTURA);

  return (
    <section className="-mx-6 bg-black text-white" aria-label="Black Friday Mozz">
      <Link href="/black-friday" className="block px-6 py-9 md:py-12 text-center">
        <p className="text-2xl md:text-3xl font-semibold" style={{ color: OURO, letterSpacing: "0.35em", paddingLeft: "0.35em" }}>
          MOZZ
        </p>
        <p className="mt-2 text-[34px] md:text-[52px] font-extrabold leading-none tracking-tight">BLACK FRIDAY</p>

        {aberta && (
          <p className="mt-5 text-[12.5px] uppercase tracking-[0.25em]" style={{ color: OURO }}>
            termina em
          </p>
        )}
        <div className={`mx-auto max-w-[300px] md:max-w-[340px] ${aberta ? "mt-2" : "mt-6"}`}>
          {aberta ? (
            <ContagemRegressiva alvo={BLACK_FRIDAY_FIM} recarregarAoFim={false} />
          ) : (
            <ContagemRegressiva alvo={BLACK_FRIDAY_ABERTURA} />
          )}
        </div>

        <p className="mt-6 text-[15px] md:text-[17px] font-medium">
          As melhores ofertas do ano · Farm, NV, Reserva, Animale e Foxton
        </p>
        <span
          className="inline-block mt-5 px-7 py-3 text-[12.5px] font-bold tracking-[0.2em] uppercase text-black"
          style={{ backgroundColor: OURO }}
        >
          {aberta ? "Ver ofertas" : "Quero acesso antecipado"}
        </span>
        <p className="mt-3 text-[12.5px] text-white/60">
          {aberta
            ? "Só até 30/11, enquanto durarem os estoques"
            : "De 27 a 30/11 · cadastre-se e compre antes de todo mundo"}
        </p>
      </Link>
    </section>
  );
}

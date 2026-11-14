import type { Metadata } from "next";
import Image from "next/image";

export const metadata: Metadata = {
  title: "Grupo VIP Mozz | Black November",
  description: "Entre no grupo VIP da Mozz e receba as ofertas da Black November antes de todo mundo.",
  robots: { index: false, follow: false }
};

const LINK_GRUPO = "https://chat.whatsapp.com/Kb04yUcuJJTFW6IdBpowFw";
const OURO = "#C9A24B";

const MARCAS = [
  { nome: "Farm", logo: "/logo-farm.png" },
  { nome: "NV", logo: "/logo-nv.png" },
  { nome: "Reserva", logo: "/logo-reserva.png" },
  { nome: "Animale", logo: "/logo-animale.png" },
  { nome: "Foxton", logo: "/logo-foxton.png" }
];

const BENEFICIOS = [
  "Promoções e lançamentos em primeira mão",
  "Preços que só mandamos no grupo",
  "Sem excesso de mensagens"
];

export default function GrupoVipPage() {
  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-black text-white">
      <div className="h-1 w-full" style={{ backgroundColor: OURO }} />

      <main className="mx-auto flex min-h-[calc(100%-4px)] max-w-md flex-col items-center px-6 py-10 text-center">
        <p
          className="text-5xl font-semibold"
          style={{ color: OURO, letterSpacing: "0.35em", paddingLeft: "0.35em" }}
        >
          MOZZ
        </p>

        <p className="mt-6 text-xs uppercase text-white/80" style={{ letterSpacing: "0.4em" }}>
          Black November
        </p>

        <div className="mt-5 w-full bg-white py-4">
          <p className="text-4xl font-extrabold tracking-tight text-black">ATÉ 70% OFF</p>
        </div>

        <h1 className="mt-7 text-xl font-medium leading-snug">
          Entre no grupo VIP e receba as ofertas antes de todo mundo
        </h1>

        <div className="mt-7 flex flex-wrap justify-center gap-3">
          {MARCAS.map((marca) => (
            <div
              key={marca.nome}
              className="relative h-14 w-14 overflow-hidden rounded-full ring-1 ring-white/20"
            >
              <Image src={marca.logo} alt={marca.nome} fill sizes="56px" className="object-cover" />
            </div>
          ))}
        </div>

        <ul className="mt-8 w-full space-y-3 text-left text-[15px] text-white/90">
          {BENEFICIOS.map((texto) => (
            <li key={texto} className="flex items-start gap-3">
              <span
                className="mt-2 h-2 w-2 flex-none rounded-full"
                style={{ backgroundColor: OURO }}
              />
              <span>{texto}</span>
            </li>
          ))}
        </ul>

        <a
          href={LINK_GRUPO}
          className="mt-9 block w-full rounded-full py-4 text-center text-base font-semibold text-black transition-opacity hover:opacity-90"
          style={{ backgroundColor: OURO }}
        >
          Entrar no grupo no WhatsApp
        </a>

        <p className="mt-4 text-xs text-white/50">
          Você será direcionada ao WhatsApp para entrar no grupo.
        </p>
      </main>
    </div>
  );
}

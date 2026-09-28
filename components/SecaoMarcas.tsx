import Image from "next/image";
import Link from "next/link";

// Cada logo (arquivo em public/, ex: "/logo-animale.png") ja' vem preenchendo o quadrado
// inteiro com a cor de fundo original da propria marca (branco na Animale/Foxton, preto na
// Reserva, cinza-escuro na NV) - preparado assim de proposito pra virar um "selo" redondo
// solido quando cortado em circulo (object-cover), em vez de logo pequena flutuando dentro de
// um circulo branco generico. Pedido do Brunno em 27/09/2026: "quero todas redondas na mesma
// proporção" - as 4 logos foram recortadas e escaladas pro mesmo tamanho relativo antes de
// virar arquivo, entao aqui e' so' um w/h igual pra cada uma.
const MARCAS = [
  { nome: "Animale", slug: "animale", logo: "/logo-animale.png" },
  { nome: "NV", slug: "nv", logo: "/logo-nv.png" },
  { nome: "Reserva", slug: "reserva", logo: "/logo-reserva.png" },
  { nome: "Foxton", slug: "foxton", logo: "/logo-foxton.png" }
];

export default function SecaoMarcas() {
  return (
    <section className="py-10 border-t border-black/10">
      <p className="text-center text-[13px] tracking-widest uppercase text-mozz-gray mb-6">
        Marcas que amamos
      </p>
      <div className="flex justify-center gap-6 md:gap-10 flex-wrap">
        {MARCAS.map((marca) => (
          <Link
            key={marca.slug}
            href={`/marca/${marca.slug}`}
            aria-label={marca.nome}
            className="relative w-24 h-24 md:w-28 md:h-28 rounded-full overflow-hidden ring-1 ring-black/15 hover:ring-mozz-black transition-all"
          >
            <Image src={marca.logo} alt={marca.nome} fill sizes="112px" className="object-cover" />
          </Link>
        ))}
      </div>
    </section>
  );
}

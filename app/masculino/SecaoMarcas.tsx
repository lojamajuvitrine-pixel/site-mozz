import Link from "next/link";

const MARCAS = ["Animale", "NV", "Reserva", "Foxton"];

// Fileira "marcas que amamos" - inspirada no site oqvestir (print mandado pelo Brunno em
// 27/09/2026: uma bolinha por marca, redonda, com o nome dentro). Sem logo de marca próprio
// aqui (Animale/NV/Reserva/Foxton são marcas de terceiros, sem arquivo de logo cedido pra
// MOZZ usar) - por isso o nome escrito, no mesmo estilo serifado do "M" da MOZZ, em vez de
// tentar imitar o logo real de cada marca.
export default function SecaoMarcas() {
  return (
    <section className="py-10 border-t border-black/10">
      <p className="text-center text-[13px] tracking-widest uppercase text-mozz-gray mb-6">
        Marcas que amamos
      </p>
      <div className="flex justify-center gap-6 md:gap-10 flex-wrap">
        {MARCAS.map((marca) => (
          <Link
            key={marca}
            href={`/marca/${marca.toLowerCase()}`}
            className="w-24 h-24 md:w-28 md:h-28 rounded-full border border-black/15 flex items-center justify-center text-center px-2 hover:border-mozz-black transition-colors"
          >
            <span className="font-serif text-[15px] leading-tight">{marca}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

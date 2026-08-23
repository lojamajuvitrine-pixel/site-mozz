import Link from "next/link";
import BarraBusca from "@/components/BarraBusca";

const marcas = ["Animale", "NV", "Reserva", "Foxton"];

export default function Nav() {
  return (
    <header className="border-b border-black/10">
      <div className="text-center text-[11px] py-1.5 text-mozz-gray">
        Frete gratis acima de R$399 · Troca em 30 dias
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center px-6 py-4 max-w-6xl mx-auto">
        <div />
        <Link href="/" className="text-center">
          <div className="font-serif text-xl leading-none">M</div>
          <div className="font-serif text-[13px] tracking-widest2">MOZZ</div>
        </Link>
        <div className="flex justify-end gap-4 text-[13px] text-mozz-black/80">
          <Link href="/carrinho">Carrinho</Link>
        </div>
      </div>
      <div className="flex justify-center gap-6 pb-3 text-[12px] text-mozz-gray">
        {marcas.map((marca) => (
          <Link key={marca} href={`/marca/${marca.toLowerCase()}`}>
            {marca}
          </Link>
        ))}
      </div>
      <div className="px-6 pb-3">
        <BarraBusca />
      </div>
    </header>
  );
}

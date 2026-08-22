import Link from "next/link";

const marcas = ["Animale", "NV", "Reserva", "Foxton"];

export default function Nav() {
  return (
    <header className="border-b border-black/10">
      <div className="text-center text-[11px] py-1.5 text-mozz-gray">
        Frete gratis acima de R$399 · Troca em 30 dias
      </div>
      <div className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
        <nav className="hidden md:flex gap-6 text-[13px] text-mozz-black/80">
          <Link href="/feminino">Feminino</Link>
          <Link href="/masculino">Masculino</Link>
          <Link href="/marca/animale">Marcas</Link>
        </nav>
        <Link href="/" className="text-center">
          <div className="font-serif text-xl leading-none">M</div>
          <div className="font-serif text-[13px] tracking-widest2">MOZZ</div>
        </Link>
        <div className="flex gap-4 text-[13px] text-mozz-black/80">
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
    </header>
  );
}

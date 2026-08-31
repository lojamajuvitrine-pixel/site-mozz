import Link from "next/link";

// Faixa estreita de cashback na home, logo abaixo do banner carrossel (ver app/page.tsx) -
// pedido do Brunno em 31/08/2026, no mesmo estilo de faixa fixa/anuncio que a Reserva usa pro
// frete gratis dela (barra escura, texto centralizado, uma linha so'). Regras completas em
// /cashback (ver app/cashback/page.tsx).
export default function FaixaCashback() {
  return (
    <div className="-mx-6 bg-mozz-black text-white text-center text-[13px] py-2.5 px-6">
      Ganhe 15% de volta em crédito de loja em toda compra.{" "}
      <Link href="/cashback" className="underline">
        Saiba mais
      </Link>
    </div>
  );
}

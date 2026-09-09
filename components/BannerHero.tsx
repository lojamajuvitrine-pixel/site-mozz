import Link from "next/link";

// Faixa de cashback na home, logo abaixo do banner carrossel (ver app/page.tsx) - pedido do
// Brunno em 31/08/2026, no mesmo estilo de faixa fixa/anuncio que a Reserva usa pro frete
// gratis dela. Regras completas em /cashback (ver app/cashback/page.tsx).
// Ampliada em 09/09/2026 (pedido do Brunno): virou um bloco de duas linhas com titulo
// "CASHBACK MOZZ" em destaque, em vez da faixa fina de uma linha so' que era antes.
export default function FaixaCashback() {
  return (
    <div className="-mx-6 bg-mozz-black text-white text-center py-5 px-6">
      <p className="font-serif text-[22px] md:text-[26px] tracking-wide mb-1">CASHBACK MOZZ</p>
      <p className="text-[14px] text-white/90">
        Ganhe 15% de volta em crédito de loja em toda compra.{" "}
        <Link href="/cashback" className="underline">
          Saiba mais
        </Link>
      </p>
    </div>
  );
}

// Link direto pro Google Maps com o endereco da loja ja preenchido na busca - abre o app do
// Maps no celular ou o site no desktop, sem precisar guardar coordenadas exatas (lat/long).
const ENDERECO_LOJA = "Avenida Coronel Rogério Borba, nº 5, Reserva, PR";
const LINK_MAPS = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ENDERECO_LOJA)}`;

export default function Footer() {
  return (
    <footer className="border-t border-black/10 py-6 text-center text-[12.5px] text-mozz-gray mt-16">
      <p>MOZZ · Animale · NV · Reserva · Foxton</p>
      <a
        href={LINK_MAPS}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-1 inline-block underline underline-offset-2 hover:text-mozz-black"
      >
        {ENDERECO_LOJA}
      </a>
    </footer>
  );
}

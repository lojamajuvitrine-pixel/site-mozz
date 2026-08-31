import Link from "next/link";

// Link direto pro Google Maps com o endereco da loja ja preenchido na busca - abre o app do
// Maps no celular ou o site no desktop, sem precisar guardar coordenadas exatas (lat/long).
const ENDERECO_LOJA = "Avenida Coronel Rogério Borba, nº 480, Reserva, PR";
const LINK_MAPS = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ENDERECO_LOJA)}`;

// Mesmo numero do botao flutuante de WhatsApp (components/BotaoWhatsapp.tsx) - repetido aqui
// de proposito (import cruzado entre os dois deixaria a dependencia mais confusa pra um numero
// so').
const NUMERO_WHATSAPP = "5542988351888";
const LINK_WHATSAPP = `https://wa.me/${NUMERO_WHATSAPP}?text=${encodeURIComponent(
  "Olá! Vim do site da MOZZ e tenho uma dúvida."
)}`;

const INSTAGRAM_HANDLE = "@mozzclothing_";
const LINK_INSTAGRAM = `https://instagram.com/${INSTAGRAM_HANDLE.replace("@", "")}`;

function TituloColuna({ children }: { children: React.ReactNode }) {
  return <p className="text-mozz-black text-[13px] font-medium mb-3">{children}</p>;
}

const linkClasse = "block hover:text-mozz-black transition-colors";

export default function Footer() {
  return (
    <footer className="border-t border-black/10 mt-16 text-[12.5px] text-mozz-gray">
      <div className="max-w-6xl mx-auto px-6 py-10 grid grid-cols-2 md:grid-cols-4 gap-8">
        <div>
          <p className="font-serif text-xl text-mozz-black mb-2">MOZZ</p>
          <p className="leading-relaxed">Animale · NV · Reserva · Foxton, num só lugar.</p>
          <Link href="/quem-somos" className={`${linkClasse} mt-2`}>
            Quem somos
          </Link>
        </div>

        <div>
          <TituloColuna>Atendimento</TituloColuna>
          <a href={LINK_WHATSAPP} target="_blank" rel="noopener noreferrer" className={linkClasse}>
            WhatsApp
          </a>
          <a href={LINK_MAPS} target="_blank" rel="noopener noreferrer" className={linkClasse}>
            {ENDERECO_LOJA}
          </a>
          <Link href="/trocas" className={linkClasse}>
            Trocas e devoluções
          </Link>
          <Link href="/cashback" className={linkClasse}>
            Cashback
          </Link>
        </div>

        <div>
          <TituloColuna>Pagamento</TituloColuna>
          <p>Cartão de crédito em até 3x sem juros</p>
          <p>Pix</p>
          <p>Boleto</p>
        </div>

        <div>
          <TituloColuna>Redes sociais</TituloColuna>
          <a href={LINK_INSTAGRAM} target="_blank" rel="noopener noreferrer" className={linkClasse}>
            Instagram {INSTAGRAM_HANDLE}
          </a>
        </div>
      </div>

      <div className="border-t border-black/10 py-4 text-center text-[11.5px]">
        © {new Date().getFullYear()} MOZZ. Todos os direitos reservados.
      </div>
    </footer>
  );
}

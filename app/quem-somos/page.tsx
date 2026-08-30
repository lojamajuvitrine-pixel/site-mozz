import type { Metadata } from "next";
import Image from "next/image";

// Pagina institucional "Quem somos" - pedido do Brunno em 30/08/2026: quem chega no site sem
// conhecer a loja fica em duvida se pode confiar (compra so' online, sem nunca ter visto a
// loja fisica) - essa pagina existe pra resolver exatamente isso, mostrando que a Mozz e' uma
// loja de verdade, com endereco e fachada reais, nao so' um site.
export const metadata: Metadata = {
  title: "Quem somos",
  description: "Conheça a MOZZ: nossa loja física em Reserva, PR, e a curadoria de marcas por trás do site."
};

const ENDERECO_LOJA = "Avenida Coronel Rogério Borba, nº 480, Reserva, PR";
const LINK_MAPS = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ENDERECO_LOJA)}`;

const NUMERO_WHATSAPP = "5542988351888";
const LINK_WHATSAPP = `https://wa.me/${NUMERO_WHATSAPP}?text=${encodeURIComponent(
  "Olá! Vim da página Quem Somos do site da MOZZ e tenho uma dúvida."
)}`;

export default function PaginaQuemSomos() {
  return (
    <section className="pb-16">
      <div className="relative w-full aspect-[3/2] md:aspect-[16/7] bg-mozz-stone">
        <Image
          src="/loja/fachada.jpg"
          alt="Fachada da loja MOZZ em Reserva, PR"
          fill
          sizes="100vw"
          priority
          className="object-cover"
        />
      </div>

      <div className="max-w-2xl mx-auto px-6">
        <p className="font-serif text-3xl mt-10 mb-6">Quem somos</p>

        <div className="space-y-5 text-[14.5px] text-mozz-black/80 leading-relaxed">
          <p>
            Bem-vindo à MOZZ. Somos uma loja física em Reserva (PR) que também leva sua
            experiência de moda para o ambiente online. Aqui não há barreiras: o mesmo estoque, a
            mesma qualidade e o mesmo cuidado do nosso endereço físico estão disponíveis na
            internet.
          </p>

          <p>
            Reunimos uma curadoria premium com quatro marcas de desejo: Animale, NV, Reserva e
            Foxton. Escolhemos a dedo cada peça que entra em nosso catálogo para garantir o padrão
            que você busca.
          </p>

          <p>
            Quer ajuda para escolher o tamanho ou saber mais sobre o envio? Clique no ícone do
            WhatsApp e fale com a nossa equipe. É atendimento humano, direto da nossa loja física
            para você.
          </p>
        </div>

        {/*
          Brunno, confirma se o cargo certo e' mesmo "Fundadora e curadora" antes de publicar.
          Se a Izabella quiser, um depoimento curto dela aqui (uma frase sobre o porquê da
          curadoria) reforça ainda mais.
        */}
        <div className="mt-10 pt-8 border-t border-black/10 flex flex-col items-center text-center">
          <div className="relative w-40 h-48 sm:w-48 sm:h-60 overflow-hidden rounded-sm bg-mozz-stone">
            <Image
              src="/loja/fundadora.jpg"
              alt="Izabella, fundadora e curadora da MOZZ"
              fill
              sizes="192px"
              className="object-cover"
            />
          </div>
          <p className="text-mozz-black font-medium mt-4 text-[14.5px]">Izabella</p>
          <p className="text-mozz-gray text-[13.5px]">Fundadora e curadora</p>
        </div>

        <div className="mt-10 pt-8 border-t border-black/10 grid sm:grid-cols-2 gap-6 text-[14.5px]">
          <div>
            <p className="text-mozz-black font-medium mb-1">Nossa loja</p>
            <a
              href={LINK_MAPS}
              target="_blank"
              rel="noopener noreferrer"
              className="text-mozz-gray hover:text-mozz-black transition-colors underline"
            >
              {ENDERECO_LOJA}
            </a>
            <p className="text-mozz-gray mt-1">
              Segunda a sexta, 9h às 18h · Sábado, 9h às 12h
            </p>
          </div>

          <div>
            <p className="text-mozz-black font-medium mb-1">Fale com a gente</p>
            <a
              href={LINK_WHATSAPP}
              target="_blank"
              rel="noopener noreferrer"
              className="text-mozz-gray hover:text-mozz-black transition-colors underline"
            >
              WhatsApp
            </a>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-black/10">
          <p className="text-mozz-black font-medium mb-2 text-[14.5px]">Marcas que trabalhamos</p>
          <p className="text-mozz-gray text-[14.5px]">Animale · NV · Reserva · Foxton</p>
        </div>
      </div>
    </section>
  );
}

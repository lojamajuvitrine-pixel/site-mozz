import type { Metadata } from "next";

// Pagina de destino do anuncio do Instagram/Facebook que leva mulheres de Reserva-PR pro grupo
// de promocoes da MOZZ no WhatsApp (14/11/2026, pedido do Brunno). Existe porque a Meta recusa
// anuncio de TRAFEGO cujo destino e' direto um link chat.whatsapp.com (erro #2446860 - ela exige
// anuncio de mensagens, que abriria conversa com o numero da loja e nao o grupo). Com essa
// pagina, o destino do anuncio e' um site comum. Fica fora do Google (noindex): so' pro anuncio.
// Pra trocar de grupo no futuro, e' so' mudar LINK_GRUPO abaixo - o anuncio nao muda.
export const metadata: Metadata = {
  title: "Grupo VIP Mozz",
  description: "Receba as ofertas da Black November antes de todo mundo.",
  robots: { index: false, follow: false }
};

const LINK_GRUPO = "https://chat.whatsapp.com/Kb04yUcuJJTFW6IdBpowFw";

const BENEFICIOS = [
  "Promoções e lançamentos em primeira mão",
  "Farm, NV, Reserva, Animale e Foxton",
  "Só o que vale a pena, sem excesso de mensagens"
];

export default function PaginaGrupoVip() {
  return (
    <section className="py-8 flex justify-center">
      <div className="w-full max-w-md rounded-sm bg-black px-6 py-10 text-center text-white">
        <p className="font-serif text-3xl tracking-[0.3em] text-[#C9A24B]">MOZZ</p>
        <p className="mt-6 font-serif text-3xl">Grupo VIP Mozz</p>
        <p className="mt-3 text-[15px] leading-relaxed text-white/80">
          Receba as ofertas da Black November antes de todo mundo. Até 70% OFF.
        </p>

        <ul className="mt-8 space-y-3 text-left text-[14.5px]">
          {BENEFICIOS.map((texto) => (
            <li key={texto} className="flex gap-3">
              <span className="text-[#C9A24B]">✓</span>
              <span className="text-white/90">{texto}</span>
            </li>
          ))}
        </ul>

        <a
          href={LINK_GRUPO}
          className="mt-10 block rounded-sm bg-[#C9A24B] px-6 py-4 text-[15px] font-medium text-black transition-opacity hover:opacity-90"
        >
          Entrar no grupo no WhatsApp
        </a>
        <p className="mt-4 text-[12px] text-white/50">
          Você será direcionada ao WhatsApp para entrar no grupo.
        </p>
      </div>
    </section>
  );
}

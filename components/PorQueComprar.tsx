import Link from "next/link";

// Secao da home "Por que comprar na Mozz" (pedido do Brunno em 19/10/2026) - os argumentos de
// confianca: revenda oficial, loja fisica, preco garantido, atendimento, envio rapido e troca.
// Textos aprovados pelo Brunno; prazos (resposta no mesmo dia util, envio em ate 1 dia util)
// sao compromissos que a equipe precisa cumprir.
const ARGUMENTOS = [
  {
    titulo: "Revenda oficial",
    texto: "Animale, NV, Farm, Reserva e Foxton. Peças originais, com nota fiscal.",
    link: null as { href: string; rotulo: string } | null
  },
  {
    titulo: "Boutique física em Reserva-PR",
    texto: "Uma loja de verdade, com endereço e equipe.",
    link: { href: "/quem-somos", rotulo: "Conheça a Mozz" }
  },
  {
    titulo: "Preço garantido",
    texto: "Achou a mesma peça mais barata no site oficial? A gente cobre, antes de você pagar.",
    link: { href: "/preco-garantido", rotulo: "Como funciona" }
  },
  {
    titulo: "Atendimento humano",
    texto: "Respondemos no WhatsApp no mesmo dia útil.",
    link: null
  },
  {
    titulo: "Enviamos em até 1 dia útil",
    texto: "Pedido pago é pedido a caminho.",
    link: { href: "/entrega", rotulo: "Formas de entrega" }
  },
  {
    titulo: "Troca em 30 dias",
    texto: "A primeira troca é grátis.",
    link: { href: "/trocas", rotulo: "Ver as regras" }
  }
];

export default function PorQueComprar() {
  return (
    <section className="py-8 md:py-10 border-t border-black/10">
      <p className="text-center text-[13px] tracking-widest uppercase text-mozz-gray mb-5 md:mb-6">
        Por que comprar na Mozz
      </p>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
        {ARGUMENTOS.map((item) => (
          <div key={item.titulo} className="border border-black/10 p-3 md:p-5">
            <p className="font-serif text-[16px] md:text-[19px] leading-snug mb-1">{item.titulo}</p>
            <p className="text-[13px] md:text-[14px] text-mozz-gray leading-relaxed">{item.texto}</p>
            {item.link && (
              <Link href={item.link.href} className="inline-block mt-2 text-[12.5px] md:text-[13px] underline underline-offset-2">
                {item.link.rotulo}
              </Link>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

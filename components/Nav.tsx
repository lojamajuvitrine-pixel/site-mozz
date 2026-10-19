"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import BarraBusca from "@/components/BarraBusca";
import { useFavoritos } from "@/lib/favoritos-context";
import { useCart } from "@/lib/cart-context";

const MARCAS_FEMININO = [
  { nome: "Animale", slug: "animale" },
  { nome: "NV", slug: "nv" },
  { nome: "Farm", slug: "farm" }
];
const MARCAS_MASCULINO = [
  { nome: "Reserva", slug: "reserva" },
  { nome: "Foxton", slug: "foxton" }
];
const TODAS_AS_MARCAS = [...MARCAS_FEMININO, ...MARCAS_MASCULINO];

// WhatsApp da loja (mesmo numero do botao flutuante, ver components/BotaoWhatsapp.tsx)
const LINK_WHATSAPP = `https://wa.me/5542988351888?text=${encodeURIComponent(
  "Olá! Vim pelo site da Mozz e gostaria de atendimento."
)}`;

function IconeChevron({ aberto }: { aberto: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      width="11"
      height="11"
      className={`transition-transform ${aberto ? "rotate-180" : ""}`}
    >
      <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconeMenu({ aberto }: { aberto: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" width="20" height="20">
      {aberto ? (
        <path d="M6 6l12 12M6 18L18 6" strokeLinecap="round" />
      ) : (
        <>
          <line x1="4" y1="7" x2="20" y2="7" strokeLinecap="round" />
          <line x1="4" y1="12" x2="20" y2="12" strokeLinecap="round" />
          <line x1="4" y1="17" x2="20" y2="17" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}

// Sacola do topo (16/10/2026, pedido do Brunno - "como em todos os sites"): vazia fica so' o
// contorno; com pecas, fica preta com o numero de pecas em branco dentro.
function IconeSacola({ quantidade }: { quantidade: number }) {
  if (quantidade <= 0) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="19" height="19">
        <path d="M6 8h12l-1 12a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1L6 8z" />
        <path d="M9 8V6a3 3 0 0 1 6 0v2" />
      </svg>
    );
  }
  const texto = quantidade > 99 ? "99+" : String(quantidade);
  return (
    <svg viewBox="0 0 24 24" width="21" height="21" className="text-mozz-black">
      <path
        d="M6 8h12l-1 12a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1L6 8z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <text
        x="12"
        y="17.4"
        textAnchor="middle"
        fontSize={texto.length > 1 ? 7 : 8.5}
        fontWeight={600}
        fill="#fff"
        fontFamily="Inter, Arial, sans-serif"
      >
        {texto}
      </text>
    </svg>
  );
}

function IconeConta() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="19" height="19">
      <circle cx="12" cy="8" r="3.2" />
      <path d="M5 20c1.2-3.8 4-5.6 7-5.6s5.8 1.8 7 5.6" strokeLinecap="round" />
    </svg>
  );
}

function IconeCoracaoNav() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="19" height="19">
      <path
        d="M12 20.5s-7.5-4.6-10-9.3C.5 8 1.9 4.5 5.3 4c2-.3 3.9.7 4.8 2.4.9-1.7 2.8-2.7 4.8-2.4 3.4.5 4.8 4 3.3 7.2-2.5 4.7-10 9.3-10 9.3z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function BadgeContagem({ valor }: { valor: number }) {
  if (valor === 0) return null;
  return (
    <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-mozz-black text-white text-[10px] leading-4 text-center">
      {valor}
    </span>
  );
}

export default function Nav() {
  const [menuAberto, setMenuAberto] = useState(false);
  const [marcasAberto, setMarcasAberto] = useState(false);
  const { favoritos } = useFavoritos();
  const { itens } = useCart();
  const pecasNaSacola = itens.reduce((soma, item) => soma + item.quantidade, 0);
  const rotuloSacola = pecasNaSacola > 0 ? `Carrinho com ${pecasNaSacola} ${pecasNaSacola === 1 ? "peça" : "peças"}` : "Carrinho";

  // Menu lateral do celular: com ele aberto, a pagina por tras nao rola, e a tecla Esc fecha.
  useEffect(() => {
    if (!menuAberto) return;
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const aoApertarTecla = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") setMenuAberto(false);
    };
    window.addEventListener("keydown", aoApertarTecla);
    return () => {
      document.body.style.overflow = overflowAnterior;
      window.removeEventListener("keydown", aoApertarTecla);
    };
  }, [menuAberto]);

  const fecharMenu = () => setMenuAberto(false);
  const classeItemMenu = "block py-3 text-[15px] font-bold uppercase tracking-wide text-mozz-black";
  const classeItemMenuSecundario = "block py-2 text-[13.5px] font-semibold text-mozz-black/80";

  return (
    <header className="border-b border-black/10">
      {/* --- Desktop --- */}
      <div className="hidden md:flex items-center gap-8 px-6 py-4 max-w-[1600px] mx-auto">
        <Link href="/" className="text-center shrink-0 -ml-2">
          <div className="font-serif text-3xl leading-none">M</div>
          <div className="font-serif text-[14.5px] tracking-widest2">MOZZ</div>
        </Link>

        <nav className="flex items-center gap-6 text-[14.5px] text-mozz-gray">
          <div className="relative group">
            <Link href="/feminino" className="hover:text-mozz-black transition-colors">
              Feminino
            </Link>
            <div className="absolute left-0 top-full hidden group-hover:block pt-3 z-30">
              <div className="flex flex-col min-w-[140px] bg-white border border-black/10 shadow-sm py-2">
                {MARCAS_FEMININO.map((marca) => (
                  <Link
                    key={marca.slug}
                    href={`/marca/${marca.slug}`}
                    className="px-4 py-2 text-[14px] hover:bg-mozz-stone transition-colors"
                  >
                    {marca.nome}
                  </Link>
                ))}
              </div>
            </div>
          </div>

          <div className="relative group">
            <Link href="/masculino" className="hover:text-mozz-black transition-colors">
              Masculino
            </Link>
            <div className="absolute left-0 top-full hidden group-hover:block pt-3 z-30">
              <div className="flex flex-col min-w-[140px] bg-white border border-black/10 shadow-sm py-2">
                {MARCAS_MASCULINO.map((marca) => (
                  <Link
                    key={marca.slug}
                    href={`/marca/${marca.slug}`}
                    className="px-4 py-2 text-[14px] hover:bg-mozz-stone transition-colors"
                  >
                    {marca.nome}
                  </Link>
                ))}
              </div>
            </div>
          </div>

          <Link href="/outlet" className="hover:text-mozz-black transition-colors">
            Outlet
          </Link>
          <Link href="/quem-somos" className="hover:text-mozz-black transition-colors">
            Quem somos
          </Link>
        </nav>

        <div className="flex-1" />

        <div className="flex items-center gap-4 text-mozz-black/80">
          <BarraBusca expansivel />
          <Link href="/conta" aria-label="Minha conta" className="p-1">
            <IconeConta />
          </Link>
          <Link href="/favoritos" aria-label="Favoritos" className="relative p-1">
            <IconeCoracaoNav />
            <BadgeContagem valor={favoritos.length} />
          </Link>
          <Link href="/carrinho" aria-label={rotuloSacola} className="p-1">
            <IconeSacola quantidade={pecasNaSacola} />
          </Link>
        </div>
      </div>

      {/* --- Mobile --- */}
      <div className="md:hidden">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center px-4 py-3">
          <button
            onClick={() => setMenuAberto((v) => !v)}
            aria-label="Abrir menu"
            aria-expanded={menuAberto}
            className="justify-self-start p-1 -ml-1"
          >
            <IconeMenu aberto={false} />
          </button>

          <Link href="/" className="text-center" onClick={fecharMenu}>
            <div className="font-serif text-3xl leading-none">M</div>
            <div className="font-serif text-[14.5px] tracking-widest2">MOZZ</div>
          </Link>

          <div className="flex justify-end items-center gap-3 text-mozz-black/80">
            <Link href="/conta" aria-label="Minha conta" className="p-1">
              <IconeConta />
            </Link>
            <Link href="/favoritos" aria-label="Favoritos" className="relative p-1">
              <IconeCoracaoNav />
              <BadgeContagem valor={favoritos.length} />
            </Link>
            <Link href="/carrinho" aria-label={rotuloSacola} className="p-1 -mr-1">
              <IconeSacola quantidade={pecasNaSacola} />
            </Link>
          </div>
        </div>

        {/* Menu lateral: abre pela esquerda, so' numa faixa da tela (78% da largura, no maximo
            320px) - o resto fica escurecido e tocar nele fecha o menu. */}
        <div
          className={`fixed inset-0 z-[60] ${menuAberto ? "" : "pointer-events-none"}`}
          aria-hidden={!menuAberto}
        >
          <div
            onClick={fecharMenu}
            className={`absolute inset-0 bg-black/40 transition-opacity duration-300 ${
              menuAberto ? "opacity-100" : "opacity-0"
            }`}
          />
          <nav
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            className={`absolute left-0 top-0 bottom-0 w-[78%] max-w-[320px] bg-white shadow-xl flex flex-col overflow-y-auto transition-transform duration-300 ease-out ${
              menuAberto ? "translate-x-0" : "-translate-x-full"
            }`}
          >
            <div className="flex items-center justify-between px-5 pt-4 pb-2">
              <span className="font-serif text-[14.5px] tracking-widest2">MOZZ</span>
              <button onClick={fecharMenu} aria-label="Fechar menu" className="p-1 -mr-1">
                <IconeMenu aberto />
              </button>
            </div>

            <div className="px-5 pb-3" onSubmitCapture={fecharMenu}>
              <BarraBusca />
            </div>

            <div className="px-5 divide-y divide-black/10">
              <Link href="/feminino" onClick={fecharMenu} className={classeItemMenu}>
                Feminino
              </Link>
              <Link href="/masculino" onClick={fecharMenu} className={classeItemMenu}>
                Masculino
              </Link>
              <div>
                <button
                  type="button"
                  onClick={() => setMarcasAberto((v) => !v)}
                  aria-expanded={marcasAberto}
                  className={`${classeItemMenu} w-full flex items-center justify-between text-left`}
                >
                  Marcas
                  <IconeChevron aberto={marcasAberto} />
                </button>
                {marcasAberto && (
                  <div className="pb-2 pl-3">
                    {TODAS_AS_MARCAS.map((marca) => (
                      <Link
                        key={marca.slug}
                        href={`/marca/${marca.slug}`}
                        onClick={fecharMenu}
                        className="block py-2 text-[14.5px] font-semibold text-mozz-black/80"
                      >
                        {marca.nome}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
              <Link href="/outlet" onClick={fecharMenu} className={classeItemMenu}>
                Outlet
              </Link>
            </div>

            <div className="mt-auto px-5 pt-3 pb-6 border-t border-black/10">
              <Link href="/conta" onClick={fecharMenu} className={classeItemMenuSecundario}>
                Minha conta
              </Link>
              <a href={LINK_WHATSAPP} target="_blank" rel="noopener noreferrer" className={classeItemMenuSecundario}>
                Falar no WhatsApp
              </a>
              <Link href="/quem-somos" onClick={fecharMenu} className={classeItemMenuSecundario}>
                Quem somos
              </Link>
            </div>
          </nav>
        </div>
      </div>
    </header>
  );
}

"use client";

// Barra que sobe de baixo no celular pra escolher o tamanho direto da vitrine (pedido do Brunno
// em 24/11/2026, inspirado na Animale): o "+" na foto do ProductCard abre esta barra; a cliente
// escolhe a cor (se tiver mais de uma), seleciona o tamanho e toca em "Adicionar a sacola".
// No computador nada muda - la' os tamanhos ja' aparecem ao passar o mouse na foto.
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Produto, VarianteCor } from "@/lib/produtos";
import { tamanhosDisponiveisDoColor } from "@/lib/produtos";
import { corAproximada } from "@/lib/cor";
import { nomeDaCorParaExibir } from "@/lib/coresFiltro";
import { formatarPreco } from "@/lib/formato";
import { useCart } from "@/lib/cart-context";

export default function SeletorTamanhoMobile({
  produto,
  cores,
  corIndex,
  onTrocarCor,
  parcelamento,
  onFechar
}: {
  produto: Produto;
  cores: VarianteCor[];
  corIndex: number;
  onTrocarCor: (index: number) => void;
  parcelamento: string | null;
  onFechar: () => void;
}) {
  const router = useRouter();
  const { adicionar } = useCart();
  const [montado, setMontado] = useState(false);
  const [visivel, setVisivel] = useState(false);
  const [tamanho, setTamanho] = useState<string | null>(null);
  const [adicionado, setAdicionado] = useState<string | null>(null);
  const [arrasto, setArrasto] = useState(0);
  const inicioToque = useRef<number | null>(null);

  const corAtual = cores[corIndex];
  const disponiveis = tamanhosDisponiveisDoColor(corAtual);
  const foto = corAtual.imagens[0] ?? produto.imagem;

  useEffect(() => {
    setMontado(true);
    const overflowAntes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const id = requestAnimationFrame(() => setVisivel(true));
    return () => {
      cancelAnimationFrame(id);
      document.body.style.overflow = overflowAntes;
    };
  }, []);

  function fechar() {
    setVisivel(false);
    setTimeout(onFechar, 200);
  }

  function trocarCor(index: number) {
    onTrocarCor(index);
    setTamanho(null);
    setAdicionado(null);
  }

  function adicionarNaSacola() {
    if (!tamanho || !disponiveis.includes(tamanho)) return;
    adicionar(produto, corAtual.cor, tamanho);
    setAdicionado(tamanho);
  }

  // Arrastar a barra pra baixo fecha (passou de 80px).
  function inicioArrasto(e: React.TouchEvent) {
    inicioToque.current = e.touches[0].clientY;
  }
  function moverArrasto(e: React.TouchEvent) {
    if (inicioToque.current === null) return;
    setArrasto(Math.max(0, e.touches[0].clientY - inicioToque.current));
  }
  function fimArrasto() {
    if (arrasto > 80) fechar();
    setArrasto(0);
    inicioToque.current = null;
  }

  if (!montado) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] md:hidden" role="dialog" aria-modal="true" aria-label="Escolher tamanho">
      <div
        onClick={fechar}
        className={`absolute inset-0 bg-black/40 transition-opacity duration-200 ${visivel ? "opacity-100" : "opacity-0"}`}
      />
      <div
        className="absolute inset-x-0 bottom-0 bg-white rounded-t-2xl px-5 pb-[max(20px,env(safe-area-inset-bottom))] pt-2 transition-transform duration-200"
        style={{ transform: visivel ? `translateY(${arrasto}px)` : "translateY(100%)" }}
      >
        <div
          onTouchStart={inicioArrasto}
          onTouchMove={moverArrasto}
          onTouchEnd={fimArrasto}
          onClick={fechar}
          className="flex justify-center py-2 -mx-5 cursor-pointer"
          aria-label="Fechar"
        >
          <span className="block w-10 h-1 rounded-full bg-black/20" />
        </div>

        <div className="flex gap-3 items-start">
          <div className="relative w-16 h-20 shrink-0 bg-mozz-stone overflow-hidden">
            {foto && <Image src={foto} alt={produto.nome} fill sizes="64px" quality={60} className="object-cover" />}
          </div>
          <div className="min-w-0">
            <p className="text-[12.5px] font-bold uppercase tracking-wide">{produto.marca}</p>
            <p className="text-[14px] leading-snug">{produto.nome}</p>
            <p className="text-[14px]">
              {produto.precoOriginal && (
                <span className="text-mozz-gray/50 line-through mr-1.5">{formatarPreco(produto.precoOriginal)}</span>
              )}
              {formatarPreco(produto.preco)}
            </p>
            {parcelamento && <p className="text-[12px] text-mozz-gray/80">{parcelamento}</p>}
          </div>
        </div>

        {cores.length > 1 && (
          <div className="mt-4">
            <p className="text-[13px] mb-2">
              Cor: <span className="text-mozz-gray">{nomeDaCorParaExibir(corAtual.cor, produto.marca)}</span>
            </p>
            <div className="flex gap-2">
              {cores.map((c, i) => (
                <button
                  key={c.cor}
                  onClick={() => trocarCor(i)}
                  aria-label={nomeDaCorParaExibir(c.cor, produto.marca)}
                  className={`w-7 h-7 rounded-full border ${i === corIndex ? "border-mozz-black" : "border-black/15"}`}
                  style={{ padding: 2 }}
                >
                  <span
                    className="block w-full h-full rounded-full"
                    style={{ background: corAproximada(nomeDaCorParaExibir(c.cor, produto.marca)) }}
                  />
                </button>
              ))}
            </div>
          </div>
        )}

        {adicionado ? (
          <div className="mt-5">
            <p className="text-[14.5px] flex items-center gap-2">
              <span aria-hidden>✓</span> Adicionado à sacola · Tam. {adicionado}
            </p>
            <div className="grid grid-cols-2 gap-2 mt-4">
              <button onClick={() => router.push("/carrinho")} className="bg-mozz-black text-white py-3 text-[14px]">
                Ver sacola
              </button>
              <button onClick={fechar} className="border border-mozz-black py-3 text-[14px]">
                Continuar comprando
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className="text-[13px] mt-5 mb-2">Escolha o tamanho</p>
            {disponiveis.length === 0 ? (
              <p className="text-[14px] text-mozz-gray">Esgotado nesta cor.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {corAtual.tamanhos.map((t) => {
                  const disponivel = disponiveis.includes(t);
                  const selecionado = tamanho === t;
                  return (
                    <button
                      key={t}
                      onClick={() => disponivel && setTamanho(t)}
                      disabled={!disponivel}
                      aria-pressed={selecionado}
                      aria-label={disponivel ? `Tamanho ${t}` : `Tamanho ${t} esgotado`}
                      className={`min-w-[44px] h-11 px-3 text-[14px] border ${
                        !disponivel
                          ? "border-black/10 text-mozz-gray/50 line-through"
                          : selecionado
                            ? "border-mozz-black bg-mozz-black text-white"
                            : "border-black/25 text-mozz-black"
                      }`}
                    >
                      {t}
                    </button>
                  );
                })}
              </div>
            )}
            <button
              onClick={adicionarNaSacola}
              disabled={!tamanho}
              className="w-full mt-5 bg-mozz-black text-white py-3.5 text-[14.5px] disabled:opacity-40"
            >
              {tamanho ? "Adicionar à sacola" : "Selecione um tamanho"}
            </button>
          </>
        )}

        <Link href={`/produto/${produto.id}`} onClick={fechar} className="block text-center text-[13px] underline mt-4">
          Ver detalhes da peça →
        </Link>
      </div>
    </div>,
    document.body
  );
}

"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import type { Produto } from "@/lib/produtos";
import { coresDoProduto, tamanhosDisponiveisDoColor } from "@/lib/produtos";
import { formatarParcelamento, formatarPreco } from "@/lib/formato";
import { useCart } from "@/lib/cart-context";
import { corAproximada } from "@/lib/cor";
import CalculoFrete from "@/components/CalculoFrete";
import AvisoEstoque from "@/components/AvisoEstoque";

function IconeLupa() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="15" height="15">
      <circle cx="11" cy="11" r="6" />
      <line x1="20" y1="20" x2="15.5" y2="15.5" strokeLinecap="round" />
    </svg>
  );
}

function IconeSeta({ direcao }: { direcao: "esquerda" | "direita" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="16" height="16">
      <path
        d={direcao === "esquerda" ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function SeletorProduto({ produto }: { produto: Produto }) {
  const cores = coresDoProduto(produto);
  const [corIndex, setCorIndex] = useState(0);
  const corAtual = cores[corIndex];
  const disponiveisAtual = tamanhosDisponiveisDoColor(corAtual);
  // comeca no primeiro tamanho que ainda tem estoque - so' cai pro primeiro tamanho
  // qualquer (que vai aparecer esgotado) se a cor inteira estiver sem nenhum tamanho.
  const [tamanho, setTamanho] = useState(disponiveisAtual[0] ?? corAtual.tamanhos[0]);
  const [adicionado, setAdicionado] = useState(false);
  const { adicionar } = useCart();
  const tamanhoEstaDisponivel = disponiveisAtual.includes(tamanho);

  // Carrossel: a cor selecionada pode ter mais de uma foto (o Bling deixa cadastrar varias
  // fotos da mesma peca/cor) - fotoIndex controla qual delas esta em exibicao.
  const [fotoIndex, setFotoIndex] = useState(0);
  const fotoAtual = corAtual.imagens[fotoIndex] ?? null;

  // Zoom com lupa: ao passar o mouse na foto, ela amplia seguindo a posicao do cursor -
  // so' funciona com mouse (desktop), em touch o toque normal continua indo pra galeria.
  const [zoomAtivo, setZoomAtivo] = useState(false);
  const [origemZoom, setOrigemZoom] = useState({ x: 50, y: 50 });

  function moverMouseNaFoto(evento: React.MouseEvent<HTMLDivElement>) {
    const retangulo = evento.currentTarget.getBoundingClientRect();
    const x = ((evento.clientX - retangulo.left) / retangulo.width) * 100;
    const y = ((evento.clientY - retangulo.top) / retangulo.height) * 100;
    setOrigemZoom({ x, y });
  }

  function selecionarCor(index: number) {
    setCorIndex(index);
    const disponiveisDaCor = tamanhosDisponiveisDoColor(cores[index]);
    setTamanho(disponiveisDaCor[0] ?? cores[index].tamanhos[0]);
    setFotoIndex(0);
  }

  function adicionarAoCarrinho() {
    adicionar(produto, corAtual.cor, tamanho);
    setAdicionado(true);
    setTimeout(() => setAdicionado(false), 1500);
  }

  function fotoAnterior() {
    setFotoIndex((i) => (i === 0 ? corAtual.imagens.length - 1 : i - 1));
  }

  function proximaFoto() {
    setFotoIndex((i) => (i === corAtual.imagens.length - 1 ? 0 : i + 1));
  }

  // Swipe no celular: arrastar o dedo na foto troca pra anterior/proxima, sem precisar acertar
  // as setinhas pequenas - distancia minima de 40px pra nao confundir com um toque sem querer.
  const LIMIAR_SWIPE = 40;
  const inicioToqueX = useRef<number | null>(null);

  function aoTocarNaFoto(e: React.TouchEvent) {
    inicioToqueX.current = e.touches[0].clientX;
  }

  function aoSoltarToqueNaFoto(e: React.TouchEvent) {
    if (inicioToqueX.current === null || corAtual.imagens.length <= 1) return;
    const delta = e.changedTouches[0].clientX - inicioToqueX.current;
    inicioToqueX.current = null;
    if (Math.abs(delta) < LIMIAR_SWIPE) return;
    if (delta < 0) proximaFoto();
    else fotoAnterior();
  }

  return (
    <section className="py-8 grid md:grid-cols-2 gap-10">
      <div>
        <div
          className={`relative aspect-[3/4] bg-mozz-stone flex items-center justify-center overflow-hidden touch-pan-y ${
            fotoAtual ? "cursor-zoom-in" : ""
          }`}
          onMouseEnter={() => setZoomAtivo(true)}
          onMouseLeave={() => setZoomAtivo(false)}
          onMouseMove={moverMouseNaFoto}
          onTouchStart={aoTocarNaFoto}
          onTouchEnd={aoSoltarToqueNaFoto}
        >
          {fotoAtual ? (
            <>
              <Image
                key={fotoAtual}
                src={fotoAtual}
                alt={`${produto.nome} - ${corAtual.cor}`}
                fill
                sizes="(max-width: 768px) 100vw, 50vw"
                // foto grande da pagina do produto - qualidade alta, e' onde o cliente olha o
                // detalhe da peca de perto. O card pequeno do mosaico usa qualidade mais baixa
                // (ver ProductCard.tsx) pra carregar rapido.
                quality={90}
                className="object-cover transition-transform duration-150 ease-out"
                style={{
                  transform: zoomAtivo ? "scale(2)" : "scale(1)",
                  transformOrigin: `${origemZoom.x}% ${origemZoom.y}%`
                }}
                priority
              />
              <span className="absolute bottom-3 right-3 w-8 h-8 rounded-full bg-white/90 text-mozz-black flex items-center justify-center pointer-events-none">
                <IconeLupa />
              </span>

              {corAtual.imagens.length > 1 && (
                <>
                  <button
                    onClick={fotoAnterior}
                    aria-label="Foto anterior"
                    className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 text-mozz-black flex items-center justify-center hover:bg-white"
                  >
                    <IconeSeta direcao="esquerda" />
                  </button>
                  <button
                    onClick={proximaFoto}
                    aria-label="Proxima foto"
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 text-mozz-black flex items-center justify-center hover:bg-white"
                  >
                    <IconeSeta direcao="direita" />
                  </button>
                  <span className="absolute top-3 right-3 text-[12.5px] bg-black/60 text-white px-2 py-0.5 rounded-full">
                    {fotoIndex + 1}/{corAtual.imagens.length}
                  </span>
                </>
              )}
            </>
          ) : (
            <span className="text-mozz-gray text-xs">foto do produto</span>
          )}
        </div>

        {corAtual.imagens.length > 1 && (
          <div className="flex gap-2 mt-3 flex-wrap">
            {corAtual.imagens.map((imagem, i) => (
              <button
                key={imagem}
                onClick={() => setFotoIndex(i)}
                aria-label={`Ver foto ${i + 1}`}
                className={`relative w-14 h-[70px] overflow-hidden border ${
                  i === fotoIndex ? "border-mozz-black" : "border-black/15"
                }`}
              >
                <Image src={imagem} alt="" fill sizes="56px" quality={50} className="object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      <div>
        <p className="text-[13.5px] text-mozz-gray">{produto.marca}</p>
        <p className="font-serif text-3xl mt-1">{produto.nome}</p>
        {produto.precoOriginal ? (
          <p className="mt-2">
            <span className="text-[14px] text-mozz-gray/60 line-through mr-2">{formatarPreco(produto.precoOriginal)}</span>
            <span className="text-[19px]">{formatarPreco(produto.preco)}</span>
          </p>
        ) : (
          <p className="text-[17px] mt-2">{formatarPreco(produto.preco)}</p>
        )}
        {formatarParcelamento(produto.preco) && (
          <p className="text-[13.5px] text-mozz-gray mt-1">{formatarParcelamento(produto.preco)}</p>
        )}

        <div className="mt-6">
          {cores.length > 1 && (
            <>
              <p className="text-[13.5px] text-mozz-gray mb-2">Cor: {corAtual.cor}</p>
              <div className="flex gap-2 mb-6 flex-wrap">
                {cores.map((c, i) => (
                  <button
                    key={c.cor}
                    onClick={() => selecionarCor(i)}
                    aria-label={c.cor}
                    title={c.cor}
                    className={`w-9 h-9 rounded-full border-2 ${
                      i === corIndex ? "border-mozz-black" : "border-transparent"
                    }`}
                    style={{ padding: 3 }}
                  >
                    <span
                      className="block w-full h-full rounded-full border border-black/15"
                      style={{ backgroundColor: corAproximada(c.cor) }}
                    />
                  </button>
                ))}
              </div>
            </>
          )}

          <p className="text-[13.5px] text-mozz-gray mb-2">Tamanho</p>
          <div className="flex gap-2 mb-6 flex-wrap">
            {corAtual.tamanhos.map((t) => {
              const disponivel = disponiveisAtual.includes(t);
              return (
                <button
                  key={t}
                  onClick={() => disponivel && setTamanho(t)}
                  disabled={!disponivel}
                  title={disponivel ? undefined : "Esgotado"}
                  className={`relative w-9 h-9 text-[13.5px] border ${
                    tamanho === t && disponivel
                      ? "bg-mozz-black text-white border-mozz-black"
                      : disponivel
                        ? "border-black/20"
                        : "border-black/10 text-mozz-gray/50 cursor-not-allowed overflow-hidden"
                  }`}
                >
                  {t}
                  {!disponivel && (
                    <span className="absolute inset-0 flex items-center justify-center">
                      <span className="w-full h-px bg-black/20 rotate-[-20deg]" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          {disponiveisAtual.length === 0 && (
            <p className="text-[13.5px] text-mozz-gray mb-4">Esgotado nesta cor no momento.</p>
          )}

          {!tamanhoEstaDisponivel && <AvisoEstoque produtoId={produto.id} tamanho={tamanho} />}

          <button
            onClick={adicionarAoCarrinho}
            disabled={!tamanhoEstaDisponivel}
            className="w-full text-[14.5px] py-3 bg-mozz-black text-white disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {!tamanhoEstaDisponivel ? "Esgotado" : adicionado ? "Adicionado" : "Adicionar ao carrinho"}
          </button>

          <CalculoFrete quantidadeItens={1} />
        </div>
      </div>

      {/* barra fixa so' no celular - mantem preco e botao de comprar sempre alcancaveis
          mesmo depois de rolar pra ver descricao/composicao/medidas mais embaixo na pagina */}
      <div className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t border-black/10 px-4 py-3 flex items-center gap-3 z-20">
        <p className="text-[15px] shrink-0">{formatarPreco(produto.preco)}</p>
        <button
          onClick={adicionarAoCarrinho}
          disabled={!tamanhoEstaDisponivel}
          className="flex-1 text-[13.5px] py-3 bg-mozz-black text-white disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {!tamanhoEstaDisponivel ? "Esgotado" : adicionado ? "Adicionado" : "Adicionar ao carrinho"}
        </button>
      </div>
    </section>
  );
}

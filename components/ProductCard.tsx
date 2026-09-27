"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { Produto } from "@/lib/produtos";
import { coresDoProduto, tamanhosDisponiveisDoColor } from "@/lib/produtos";
import { corAproximada } from "@/lib/cor";
import { formatarParcelamento, formatarPreco } from "@/lib/formato";
import { useCart } from "@/lib/cart-context";
import { useFavoritos } from "@/lib/favoritos-context";

function IconeCheck() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13">
      <path d="M5 12l5 5L20 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconeSeta({ direcao }: { direcao: "esquerda" | "direita" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="14" height="14">
      <path
        d={direcao === "esquerda" ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconeCoracao({ preenchido }: { preenchido: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill={preenchido ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.8"
      width="16"
      height="16"
    >
      <path
        d="M12 20.5s-7.5-4.6-10-9.3C.5 8 1.9 4.5 5.3 4c2-.3 3.9.7 4.8 2.4.9-1.7 2.8-2.7 4.8-2.4 3.4.5 4.8 4 3.3 7.2-2.5 4.7-10 9.3-10 9.3z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Card de produto do mosaico/grade - usado na home, no catalogo (/produtos), nas paginas de
// marca e em "quem viu tambem gostou". No estilo das grandes lojas de moda (ex: Foxton): da'
// pra escolher cor e tamanho e adicionar direto na sacola sem sair do mosaico - so' entra na
// pagina do produto quem quiser ver mais detalhe (fotos extras, medidas, composicao...).
export default function ProductCard({
  produto,
  mostrarCarrosselFoto = true
}: {
  produto: Produto;
  // Desliga so' as setinhas de trocar foto dentro do card (nao mexe nas bolinhas de cor
  // abaixo) - pedido do Brunno em 27/09/2026 pra nao ter esse carrossel dentro de cada peca
  // nos blocos "vitrine por marca" da home (ja tem seta pra navegar o carrossel inteiro la',
  // ficava carrossel dentro de carrossel). Continua ligado por padrao no catalogo, nas
  // paginas de marca e em "quem viu tambem gostou" - so' a home passa false explicitamente
  // (ver VitrineDeMarca.tsx).
  mostrarCarrosselFoto?: boolean;
}) {
  const { adicionar } = useCart();
  const { ehFavorito, alternarFavorito } = useFavoritos();
  const favoritado = ehFavorito(produto.id);
  const cores = coresDoProduto(produto);
  const [corIndex, setCorIndex] = useState(0);
  const [adicionado, setAdicionado] = useState<string | null>(null); // guarda o tamanho adicionado, pra feedback
  const corAtual = cores[corIndex];
  // Carrossel direto no card do mosaico, com setinha - pra rodar as fotos da peca sem precisar
  // abrir a pagina do produto (pedido do Brunno em 24/08/2026).
  const [fotoIndex, setFotoIndex] = useState(0);
  // Sem fallback pra produto.imagem aqui: isso mostrava a foto de OUTRA cor quando a
  // selecionada nao tinha foto propria (ex: "Azul Claro" sem foto mostrava a camisa Militar) -
  // bug reportado pelo Brunno em 24/08/2026. Cor sem foto agora cai no aviso honesto "foto do
  // produto" (mesmo comportamento ja usado na pagina do produto, ver SeletorProduto.tsx) em
  // vez de uma foto que nao e' da cor escolhida. Na carga inicial (corIndex 0) isso raramente
  // muda algo, ja que o sync poe cor com foto primeiro.
  const parcelamento = formatarParcelamento(produto.preco);
  const disponiveisAtual = tamanhosDisponiveisDoColor(corAtual);
  // % de desconto pra mostrar na badge da foto - calculado em cima do preco original vs o
  // preco especial (cadastrados no painel /admin/produtos), arredondado pro inteiro mais
  // proximo (ex: 19,6% -> "-20%") pra ficar com cara de vitrine, nao de planilha.
  const percentualDesconto = produto.precoOriginal
    ? Math.round((1 - produto.preco / produto.precoOriginal) * 100)
    : null;

  function alternarFavoritoClick(evento: React.MouseEvent) {
    evento.preventDefault();
    evento.stopPropagation();
    alternarFavorito(produto.id);
  }

  function selecionarCor(evento: React.MouseEvent, index: number) {
    evento.preventDefault();
    evento.stopPropagation();
    setCorIndex(index);
    setFotoIndex(0);
    setAdicionado(null);
  }

  function fotoAnterior(evento: React.MouseEvent) {
    evento.preventDefault();
    evento.stopPropagation();
    setFotoIndex((i) => (i === 0 ? corAtual.imagens.length - 1 : i - 1));
  }

  function proximaFoto(evento: React.MouseEvent) {
    evento.preventDefault();
    evento.stopPropagation();
    setFotoIndex((i) => (i === corAtual.imagens.length - 1 ? 0 : i + 1));
  }

  function selecionarTamanho(evento: React.MouseEvent, tamanho: string) {
    evento.preventDefault();
    evento.stopPropagation();
    if (!disponiveisAtual.includes(tamanho)) return;
    adicionar(produto, corAtual.cor, tamanho);
    setAdicionado(tamanho);
    setTimeout(() => setAdicionado(null), 1500);
  }

  return (
    <div className="group">
      <Link href={`/produto/${produto.id}`} className="block">
        <div className="relative aspect-[3/4] bg-mozz-stone flex items-center justify-center overflow-hidden">
          <div className="absolute top-2 left-2 z-10 flex flex-col gap-1 items-start">
            {produto.novo && (
              <span className="text-[11.5px] bg-mozz-black text-white px-2 py-0.5">NOVIDADE</span>
            )}
            {percentualDesconto !== null && percentualDesconto > 0 && (
              <span className="text-[11.5px] bg-mozz-black text-white px-2 py-0.5">-{percentualDesconto}%</span>
            )}
          </div>

          <button
            onClick={alternarFavoritoClick}
            aria-label={favoritado ? "Remover dos favoritos" : "Adicionar aos favoritos"}
            className="absolute top-2 right-2 z-20 w-7 h-7 rounded-full bg-white/90 flex items-center justify-center hover:bg-white transition-colors"
          >
            <span className={favoritado ? "text-mozz-black" : "text-mozz-gray"}>
              <IconeCoracao preenchido={favoritado} />
            </span>
          </button>

          {corAtual.imagens.length > 0 ? (
            corAtual.imagens.map((imagem, i) => (
              <Image
                key={imagem}
                src={imagem}
                alt={`${produto.marca} ${produto.nome}`}
                fill
                sizes="(max-width: 768px) 50vw, 25vw"
                quality={60}
                className={`object-cover transition-all duration-300 ${
                  i === fotoIndex ? "opacity-100 group-hover:scale-105" : "opacity-0 pointer-events-none"
                }`}
              />
            ))
          ) : (
            <span className="text-mozz-gray text-xs">foto do produto</span>
          )}

          {/* Setinhas do carrossel - sempre visiveis (nao so' no hover, diferente do overlay de
              tamanho abaixo) pra funcionar tambem no toque do celular, ja' que sao pequenas e
              ficam nas bordas, sem "roubar" o toque de quem quer abrir a pagina do produto. */}
          {mostrarCarrosselFoto && corAtual.imagens.length > 1 && (
            <>
              <button
                onClick={fotoAnterior}
                aria-label="Foto anterior"
                className="absolute left-1.5 top-1/2 -translate-y-1/2 z-10 w-6 h-6 rounded-full bg-white/90 text-mozz-black flex items-center justify-center hover:bg-white transition-colors"
              >
                <IconeSeta direcao="esquerda" />
              </button>
              <button
                onClick={proximaFoto}
                aria-label="Próxima foto"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 z-10 w-6 h-6 rounded-full bg-white/90 text-mozz-black flex items-center justify-center hover:bg-white transition-colors"
              >
                <IconeSeta direcao="direita" />
              </button>
            </>
          )}

          {corAtual.tamanhos.length > 0 && (
            <div className="hidden md:flex absolute inset-x-0 bottom-0 p-2 flex-wrap gap-1 justify-center bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
              {disponiveisAtual.length === 0 ? (
                <span className="text-[12.5px] bg-white/90 text-mozz-gray px-2 py-1">Esgotado</span>
              ) : (
                corAtual.tamanhos.map((tamanho) => {
                  const disponivel = disponiveisAtual.includes(tamanho);
                  return (
                    <button
                      key={tamanho}
                      onClick={(e) => selecionarTamanho(e, tamanho)}
                      disabled={!disponivel}
                      aria-label={disponivel ? `Adicionar tamanho ${tamanho} à sacola` : `Tamanho ${tamanho} esgotado`}
                      className={`min-w-[28px] h-7 px-1.5 text-[12.5px] flex items-center justify-center ${
                        disponivel
                          ? "bg-white/95 text-mozz-black hover:bg-mozz-black hover:text-white"
                          : "bg-white/50 text-mozz-gray/60 line-through cursor-not-allowed"
                      }`}
                    >
                      {adicionado === tamanho ? <IconeCheck /> : tamanho}
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>
      </Link>

      {cores.length > 1 && (
        <div className="flex gap-1.5 mt-2">
          {cores.map((c, i) => (
            <button
              key={c.cor}
              onClick={(e) => selecionarCor(e, i)}
              aria-label={c.cor}
              title={c.cor}
              className={`w-4 h-4 rounded-full border ${i === corIndex ? "border-mozz-black" : "border-black/15"}`}
              style={{ padding: 1.5 }}
            >
              <span className="block w-full h-full rounded-full" style={{ backgroundColor: corAproximada(c.cor) }} />
            </button>
          ))}
        </div>
      )}

      <Link href={`/produto/${produto.id}`} className="block">
        <p className="text-[14px] mt-2">{produto.nome}</p>
        {produto.precoOriginal ? (
          <p className="text-[14px]">
            <span className="text-mozz-gray/50 line-through mr-1.5">{formatarPreco(produto.precoOriginal)}</span>
            <span>{formatarPreco(produto.preco)}</span>
          </p>
        ) : (
          <p className="text-[14px]">{formatarPreco(produto.preco)}</p>
        )}
        {parcelamento && <p className="text-[12.5px] text-mozz-gray/80">{parcelamento}</p>}
      </Link>
    </div>
  );
}

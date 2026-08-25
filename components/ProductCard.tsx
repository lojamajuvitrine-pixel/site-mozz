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
export default function ProductCard({ produto }: { produto: Produto }) {
  const { adicionar } = useCart();
  const { ehFavorito, alternarFavorito } = useFavoritos();
  const favoritado = ehFavorito(produto.id);
  const cores = coresDoProduto(produto);
  const [corIndex, setCorIndex] = useState(0);
  const [adicionado, setAdicionado] = useState<string | null>(null); // guarda o tamanho adicionado, pra feedback
  const corAtual = cores[corIndex];
  // Sem fallback pra produto.imagem aqui: isso mostrava a foto de OUTRA cor quando a
  // selecionada nao tinha foto propria (ex: "Azul Claro" sem foto mostrava a camisa Militar) -
  // bug reportado pelo Brunno em 24/08/2026. Cor sem foto agora cai no aviso honesto "foto do
  // produto" (mesmo comportamento ja usado na pagina do produto, ver SeletorProduto.tsx) em
  // vez de uma foto que nao e' da cor escolhida. Na carga inicial (corIndex 0) isso raramente
  // muda algo, ja que o sync poe cor com foto primeiro.
  const imagemAtual = corAtual.imagens[0] ?? null;
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
    setAdicionado(null);
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
              <span className="text-[11.5px] bg-mozz-black text-white px-2 py-0.5">Novo</span>
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

          {imagemAtual ? (
            <Image
              key={imagemAtual}
              src={imagemAtual}
              alt={produto.nome}
              fill
              sizes="(max-width: 768px) 50vw, 25vw"
              // card pequeno do mosaico - qualidade mais baixa (o olho nao percebe nesse
              // tamanho) pra carregar rapido mesmo com varios produtos na tela ao mesmo tempo.
              // A foto grande da pagina do produto usa qualidade alta (ver SeletorProduto.tsx).
              quality={60}
              className="object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <span className="text-mozz-gray text-xs">foto do produto</span>
          )}

          {/* Overlay de tamanhos - so' desktop, e so' aparece ao passar o mouse (pra escolher e
              adicionar sem abrir a pagina do produto). Escondido no touch/mobile: la' nao tem
              hover pra "revelar" o overlay so' quando o cliente quer - ele ficava sempre visivel
              cobrindo a parte de baixo da foto inteira, e roubava o toque de quem so' queria
              abrir os detalhes da peca (bug reportado em 23/08/2026). No celular o fluxo normal
              e' abrir a pagina do produto e escolher tamanho la', como em qualquer loja. */}
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
          <p className="text-[14px] text-mozz-gray">{formatarPreco(produto.preco)}</p>
        )}
        {parcelamento && <p className="text-[12.5px] text-mozz-gray/80">{parcelamento}</p>}
      </Link>
    </div>
  );
}

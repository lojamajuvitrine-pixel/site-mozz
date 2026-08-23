"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { Produto } from "@/lib/produtos";
import { coresDoProduto, tamanhosDisponiveisDoColor } from "@/lib/produtos";
import { corAproximada } from "@/lib/cor";
import { formatarParcelamento, formatarPreco } from "@/lib/formato";
import { useCart } from "@/lib/cart-context";

function IconeCheck() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13">
      <path d="M5 12l5 5L20 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Card de produto do mosaico/grade - usado na home, no catalogo (/produtos), nas paginas de
// marca e em "quem viu tambem gostou". No estilo das grandes lojas de moda (ex: Foxton): da'
// pra escolher cor e tamanho e adicionar direto na sacola sem sair do mosaico - so' entra na
// pagina do produto quem quiser ver mais detalhe (fotos extras, medidas, composicao...).
export default function ProductCard({ produto }: { produto: Produto }) {
  const { adicionar } = useCart();
  const cores = coresDoProduto(produto);
  const [corIndex, setCorIndex] = useState(0);
  const [adicionado, setAdicionado] = useState<string | null>(null); // guarda o tamanho adicionado, pra feedback
  const corAtual = cores[corIndex];
  const imagemAtual = corAtual.imagens[0] ?? produto.imagem;
  const parcelamento = formatarParcelamento(produto.preco);
  const disponiveisAtual = tamanhosDisponiveisDoColor(corAtual);

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
          {produto.novo && (
            <span className="absolute top-2 left-2 z-10 text-[10px] bg-mozz-black text-white px-2 py-0.5">
              Novo
            </span>
          )}
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

          {/* Overlay de tamanhos - some no desktop ate' passar o mouse, sempre visivel no
              touch/mobile (nao ha' hover confiavel), pra escolher e adicionar sem abrir a
              pagina do produto. */}
          {corAtual.tamanhos.length > 0 && (
            <div className="absolute inset-x-0 bottom-0 p-2 flex flex-wrap gap-1 justify-center bg-gradient-to-t from-black/40 to-transparent opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
              {disponiveisAtual.length === 0 ? (
                <span className="text-[11px] bg-white/90 text-mozz-gray px-2 py-1">Esgotado</span>
              ) : (
                corAtual.tamanhos.map((tamanho) => {
                  const disponivel = disponiveisAtual.includes(tamanho);
                  return (
                    <button
                      key={tamanho}
                      onClick={(e) => selecionarTamanho(e, tamanho)}
                      disabled={!disponivel}
                      aria-label={disponivel ? `Adicionar tamanho ${tamanho} à sacola` : `Tamanho ${tamanho} esgotado`}
                      className={`min-w-[28px] h-7 px-1.5 text-[11px] flex items-center justify-center ${
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
        <p className="text-[12.5px] mt-2">{produto.nome}</p>
        <p className="text-[12.5px] text-mozz-gray">{formatarPreco(produto.preco)}</p>
        {parcelamento && <p className="text-[11px] text-mozz-gray/80">{parcelamento}</p>}
      </Link>
    </div>
  );
}

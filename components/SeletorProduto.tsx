"use client";

import { useState } from "react";
import Image from "next/image";
import type { Produto } from "@/lib/produtos";
import { coresDoProduto } from "@/lib/produtos";
import { formatarPreco } from "@/lib/formato";
import { useCart } from "@/lib/cart-context";

// Mapa best-effort de nome de cor (como cadastrado no Bling, em portugues, texto livre, ex:
// "Azul Marinho", "Verde Militar Escuro") pra uma cor aproximada de bolinha ao lado do nome -
// so' decoracao, o nome por extenso sempre aparece do lado, entao nunca fica ambiguo mesmo
// se a bolinha nao for exata. Comparacao e' por "contem a palavra-chave" (nao precisa bater
// o nome inteiro) e ignora acento/maiusculas, pra pegar variacoes tipo "Azul Royal" ou
// "Verde Oliva". Ordem importa: combinacoes mais especificas ficam antes das genericas, pra
// "Azul Marinho" nao cair generico em "azul" antes de checar a combinacao certa.
const CORES_APROX: Array<[string, string]> = [
  ["off white", "#f5f0e6"],
  ["branco", "#ffffff"],
  ["preto", "#111111"],
  ["cinza mescla", "#9a9994"],
  ["cinza chumbo", "#4a4a48"],
  ["cinza", "#8a8a86"],
  ["azul marinho", "#1c2b4a"],
  ["azul royal", "#1f4fa3"],
  ["azul serenity", "#7d9fc9"],
  ["azul petroleo", "#1f4a4a"],
  ["azul bic", "#2f6fb0"],
  ["azul claro", "#7d9fc9"],
  ["azul", "#2f4a7a"],
  ["indigo", "#35406b"],
  ["jeans", "#4a6a8a"],
  ["denim", "#4a6a8a"],
  ["verde militar", "#4b5320"],
  ["verde oliva", "#556b2f"],
  ["verde musgo", "#4a5a3a"],
  ["verde bandeira", "#2e6b3e"],
  ["verde claro", "#8bb06a"],
  ["verde", "#3d5c34"],
  ["vermelho", "#a02020"],
  ["bordo", "#5c1f2a"],
  ["vinho", "#5c1f2a"],
  ["amarelo", "#d8b84a"],
  ["mostarda", "#b8862f"],
  ["rosa claro", "#e6b8c4"],
  ["rosa bebe", "#e9c3d0"],
  ["rosa", "#d99aa8"],
  ["pink", "#c94f82"],
  ["lilas", "#b9a3d6"],
  ["lavanda", "#b9a3d6"],
  ["roxo", "#5c4478"],
  ["bege", "#d8c9ae"],
  ["nude", "#c9a988"],
  ["chocolate", "#4a2f1f"],
  ["marrom", "#5c4230"],
  ["caramelo", "#a9682f"],
  ["camel", "#b08355"],
  ["terracota", "#b0562f"],
  ["ferrugem", "#8a4426"],
  ["laranja", "#c9702f"],
  ["areia", "#c9b892"],
  ["dourado", "#b8963f"],
  ["prata", "#b7b7b2"]
];

function normalizarTexto(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(new RegExp("[\\u0300-\\u036f]", "g"), "")
    .toLowerCase()
    .trim();
}

function corAproximada(nomeCor: string): string {
  const normalizado = normalizarTexto(nomeCor);
  const encontrada = CORES_APROX.find(([chave]) => normalizado.includes(chave));
  return encontrada?.[1] ?? "#c7c6c0";
}

export default function SeletorProduto({ produto }: { produto: Produto }) {
  const cores = coresDoProduto(produto);
  const [corIndex, setCorIndex] = useState(0);
  const corAtual = cores[corIndex];
  const [tamanho, setTamanho] = useState(corAtual.tamanhos[0]);
  const [adicionado, setAdicionado] = useState(false);
  const { adicionar } = useCart();

  function selecionarCor(index: number) {
    setCorIndex(index);
    setTamanho(cores[index].tamanhos[0]);
  }

  return (
    <section className="py-8 grid md:grid-cols-2 gap-10">
      <div className="relative aspect-[3/4] bg-mozz-stone flex items-center justify-center overflow-hidden">
        {corAtual.imagem ? (
          <Image
            key={corAtual.imagem}
            src={corAtual.imagem}
            alt={`${produto.nome} - ${corAtual.cor}`}
            fill
            sizes="(max-width: 768px) 100vw, 50vw"
            className="object-cover"
            priority
          />
        ) : (
          <span className="text-mozz-gray text-xs">foto do produto</span>
        )}
      </div>

      <div>
        <p className="text-[12px] text-mozz-gray">{produto.marca}</p>
        <p className="font-serif text-2xl mt-1">{produto.nome}</p>
        <p className="text-[15px] mt-2">{formatarPreco(produto.preco)}</p>
        <p className="text-[13px] text-mozz-gray mt-4">{produto.descricao}</p>

        <div className="mt-6">
          {cores.length > 1 && (
            <>
              <p className="text-[12px] text-mozz-gray mb-2">Cor: {corAtual.cor}</p>
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

          <p className="text-[12px] text-mozz-gray mb-2">Tamanho</p>
          <div className="flex gap-2 mb-6 flex-wrap">
            {corAtual.tamanhos.map((t) => (
              <button
                key={t}
                onClick={() => setTamanho(t)}
                className={`w-9 h-9 text-[12px] border ${
                  tamanho === t ? "bg-mozz-black text-white border-mozz-black" : "border-black/20"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <button
            onClick={() => {
              adicionar(produto, corAtual.cor, tamanho);
              setAdicionado(true);
              setTimeout(() => setAdicionado(false), 1500);
            }}
            className="w-full text-[13px] py-3 bg-mozz-black text-white"
          >
            {adicionado ? "Adicionado" : "Adicionar ao carrinho"}
          </button>
        </div>
      </div>
    </section>
  );
}

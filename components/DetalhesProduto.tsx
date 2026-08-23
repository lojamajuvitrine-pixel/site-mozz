"use client";

import { useState } from "react";
import type { Produto } from "@/lib/produtos";
import {
  categoriaDoProduto,
  composicaoDoProduto,
  instrucoesDeCuidado,
  tabelaDeMedidas,
  textoDescricao
} from "@/lib/detalhesProduto";

function IconeMais({ aberto }: { aberto: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="14" height="14">
      <line x1="5" y1="12" x2="19" y2="12" />
      {!aberto && <line x1="12" y1="5" x2="12" y2="19" />}
    </svg>
  );
}

type Secao = { titulo: string; conteudo: React.ReactNode };

// Acordeao com as 4 informacoes complementares da peca - so mostra Tabela de medidas quando
// a categoria da peca tem uma tabela relevante (acessorio nao tem, por exemplo).
export default function DetalhesProduto({ produto }: { produto: Produto }) {
  const categoria = categoriaDoProduto(produto.nome);
  const tabela = tabelaDeMedidas(categoria);
  const composicao = composicaoDoProduto(produto);
  const cuidados = instrucoesDeCuidado(composicao);

  const secoes: Secao[] = [
    {
      titulo: "Descrição",
      conteudo: <p className="whitespace-pre-line">{textoDescricao(produto)}</p>
    },
    {
      titulo: "Composição",
      conteudo: <p>{composicao}</p>
    },
    {
      titulo: "Como cuidar",
      conteudo: (
        <ul className="list-disc pl-4 space-y-1">
          {cuidados.map((linha) => (
            <li key={linha}>{linha}</li>
          ))}
        </ul>
      )
    }
  ];

  if (tabela) {
    secoes.push({
      titulo: "Tabela de medidas",
      conteudo: (
        <div>
          <table className="w-full text-left border-collapse">
            <thead>
              <tr>
                {tabela.colunas.map((coluna) => (
                  <th key={coluna} className="border-b border-black/15 pb-2 pr-4 font-normal text-mozz-gray">
                    {coluna}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tabela.linhas.map((linha) => (
                <tr key={linha[0]}>
                  {linha.map((valor, i) => (
                    <td key={i} className="border-b border-black/5 py-2 pr-4">
                      {valor}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-mozz-gray mt-3">
            Compare com uma peça que você já tenha em casa pra escolher o tamanho ideal.
          </p>
        </div>
      )
    });
  }

  return (
    <section className="mt-10 border-t border-black/10 max-w-2xl">
      {secoes.map((secao) => (
        <ItemAcordeao key={secao.titulo} titulo={secao.titulo}>
          {secao.conteudo}
        </ItemAcordeao>
      ))}
    </section>
  );
}

function ItemAcordeao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  const [aberto, setAberto] = useState(false);
  return (
    <div className="border-b border-black/10">
      <button
        onClick={() => setAberto((v) => !v)}
        className="w-full flex items-center justify-between py-4 text-[14.5px]"
      >
        {titulo}
        <IconeMais aberto={aberto} />
      </button>
      {aberto && <div className="pb-5 text-[14px] text-mozz-black/80 leading-relaxed">{children}</div>}
    </div>
  );
}

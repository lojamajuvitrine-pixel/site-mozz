"use client";

import { useState } from "react";
import { formatarPreco } from "@/lib/formato";

type OpcaoFrete = { servico: string; transportadora: string; preco: number; prazoDias: number };

// Campo de CEP com calculo de frete/prazo - usado na pagina do produto (antes de comprar) e
// no carrinho (com a quantidade real de itens). Ver lib/frete.ts pra integracao com o
// Melhor Envio.
export default function CalculoFrete({ quantidadeItens = 1 }: { quantidadeItens?: number }) {
  const [cep, setCep] = useState("");
  const [opcoes, setOpcoes] = useState<OpcaoFrete[] | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function calcular() {
    const cepLimpo = cep.replace(/\D/g, "");
    if (cepLimpo.length !== 8) {
      setErro("Digite um CEP válido");
      setOpcoes(null);
      return;
    }
    setErro(null);
    setCarregando(true);
    setOpcoes(null);
    try {
      const resposta = await fetch("/api/frete/calcular", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cep: cepLimpo, quantidadeItens })
      });
      const dados = await resposta.json();
      if (!resposta.ok) throw new Error(dados.erro ?? "Não foi possível calcular o frete");
      setOpcoes(dados.opcoes);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível calcular o frete");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="mt-6 pt-6 border-t border-black/10">
      <p className="text-[13.5px] text-mozz-gray mb-2">Calcular frete e prazo de entrega</p>
      <div className="flex gap-2">
        <input
          value={cep}
          onChange={(evento) => setCep(evento.target.value)}
          onKeyDown={(evento) => evento.key === "Enter" && calcular()}
          placeholder="Seu CEP"
          maxLength={9}
          className="flex-1 border border-black/20 px-3 py-2 text-[14.5px] focus:outline-none focus:border-mozz-black"
        />
        <button
          onClick={calcular}
          disabled={carregando}
          className="text-[13.5px] px-4 border border-mozz-black hover:bg-mozz-black hover:text-white transition-colors disabled:opacity-60"
        >
          {carregando ? "..." : "Calcular"}
        </button>
      </div>
      {erro && <p className="text-[13.5px] text-red-600 mt-2">{erro}</p>}
      {opcoes && opcoes.length > 0 && (
        <div className="mt-3 divide-y divide-black/10 border border-black/10">
          {opcoes.map((opcao) => (
            <div
              key={`${opcao.transportadora}-${opcao.servico}`}
              className="flex justify-between items-center px-3 py-2 text-[13.5px]"
            >
              <span>
                {opcao.transportadora} {opcao.servico} · até {opcao.prazoDias} dia(s) úteis
              </span>
              <span>{formatarPreco(opcao.preco)}</span>
            </div>
          ))}
        </div>
      )}
      {opcoes && opcoes.length === 0 && (
        <p className="text-[13.5px] text-mozz-gray mt-2">Nenhuma opção de frete encontrada para esse CEP.</p>
      )}
    </div>
  );
}

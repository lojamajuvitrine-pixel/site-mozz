"use client";

import { useState } from "react";
import { formatarPreco } from "@/lib/formato";

export type OpcaoFrete = { servico: string; transportadora: string; preco: number; prazoDias: number };

// Campo de CEP com calculo de frete/prazo - usado na pagina do produto (antes de comprar, so'
// informativo) e no carrinho (com a quantidade real de itens). Nesse segundo uso e' preciso
// que o cliente ESCOLHA uma opcao antes de fechar a compra (ver "selecionavel" abaixo) - o
// valor escolhido e' cobrado de verdade no checkout (ver app/carrinho/page.tsx). Ver
// lib/frete.ts pra integracao com o Melhor Envio.
export default function CalculoFrete({
  quantidadeItens = 1,
  selecionavel = false,
  opcaoSelecionada = null,
  onSelecionar
}: {
  quantidadeItens?: number;
  selecionavel?: boolean;
  opcaoSelecionada?: OpcaoFrete | null;
  onSelecionar?: (opcao: OpcaoFrete) => void;
}) {
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
      // mais barato pre-selecionado automaticamente (o cliente pode trocar) - evita ele
      // esquecer de escolher e travar o botao de finalizar compra sem entender por que.
      if (selecionavel && onSelecionar && dados.opcoes?.length > 0) {
        onSelecionar(dados.opcoes[0]);
      }
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
          {opcoes.map((opcao) => {
            const selecionada =
              selecionavel &&
              opcaoSelecionada?.transportadora === opcao.transportadora &&
              opcaoSelecionada?.servico === opcao.servico;
            const Elemento = selecionavel ? "button" : "div";
            return (
              <Elemento
                key={`${opcao.transportadora}-${opcao.servico}`}
                {...(selecionavel ? { type: "button", onClick: () => onSelecionar?.(opcao) } : {})}
                className={`w-full flex justify-between items-center px-3 py-2 text-[13.5px] text-left ${
                  selecionavel ? "cursor-pointer hover:bg-mozz-stone" : ""
                } ${selecionada ? "bg-mozz-stone" : ""}`}
              >
                <span className="flex items-center gap-2">
                  {selecionavel && (
                    <span
                      className={`w-3.5 h-3.5 rounded-full border shrink-0 ${
                        selecionada ? "border-mozz-black bg-mozz-black" : "border-black/30"
                      }`}
                    />
                  )}
                  {opcao.transportadora} {opcao.servico} · até {opcao.prazoDias} dia(s) úteis
                </span>
                <span>{formatarPreco(opcao.preco)}</span>
              </Elemento>
            );
          })}
        </div>
      )}
      {opcoes && opcoes.length === 0 && (
        <p className="text-[13.5px] text-mozz-gray mt-2">Nenhuma opção de frete encontrada para esse CEP.</p>
      )}
    </div>
  );
}

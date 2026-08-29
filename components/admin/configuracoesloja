"use client";

import { useState } from "react";
import type { ConfiguracaoLoja } from "@/lib/configLoja";

// Bloco de configuracoes gerais da loja (nao por produto), no topo do painel /admin/produtos -
// frete gratis a partir de um valor, e a opcao de retirada na loja (com as instrucoes/endereco
// que aparecem pro cliente ao escolher retirar) - pedido do Brunno em 29/08/2026.
export default function ConfiguracoesLoja({ configuracaoInicial }: { configuracaoInicial: ConfiguracaoLoja }) {
  const [freteGratisTexto, setFreteGratisTexto] = useState(
    configuracaoInicial.freteGratisAcimaDe !== null ? String(configuracaoInicial.freteGratisAcimaDe) : ""
  );
  const [retiradaHabilitada, setRetiradaHabilitada] = useState(configuracaoInicial.retiradaHabilitada);
  const [retiradaInstrucoes, setRetiradaInstrucoes] = useState(configuracaoInicial.retiradaInstrucoes ?? "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [salvoAgora, setSalvoAgora] = useState(false);

  async function salvar() {
    const texto = freteGratisTexto.trim();
    let freteGratisAcimaDe: number | null = null;
    if (texto) {
      const numero = Number(texto.replace(",", "."));
      if (!Number.isFinite(numero) || numero <= 0) {
        setErro("Valor de frete grátis inválido");
        return;
      }
      freteGratisAcimaDe = numero;
    }

    setSalvando(true);
    setErro(null);
    setSalvoAgora(false);
    try {
      const resposta = await fetch("/api/admin/config-loja", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          freteGratisAcimaDe,
          retiradaHabilitada,
          retiradaInstrucoes: retiradaInstrucoes.trim() || null
        })
      });
      if (!resposta.ok) {
        const corpo = await resposta.json().catch(() => null);
        throw new Error(corpo?.erro ?? "Não foi possível salvar");
      }
      setSalvoAgora(true);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="mb-8 pb-8 border-b border-black/10">
      <p className="text-[15px] mb-1">Frete e retirada</p>
      <p className="text-[13px] text-mozz-gray mb-4">
        Vale pra loja inteira, não é por produto.
      </p>

      <div className="flex flex-col gap-4 max-w-md">
        <div>
          <p className="text-[13.5px] mb-1">Frete grátis a partir de</p>
          <div className="flex items-center gap-2">
            <span className="text-[13.5px] text-mozz-gray">R$</span>
            <input
              value={freteGratisTexto}
              onChange={(e) => setFreteGratisTexto(e.target.value)}
              placeholder="Desativado"
              inputMode="decimal"
              className="border border-black/20 px-3 py-2 text-[14.5px] w-32"
            />
          </div>
          <p className="text-[12.5px] text-mozz-gray mt-1">
            Deixe em branco pra desativar o frete grátis. Compara com o total do carrinho já
            com desconto de cupom, antes do frete.
          </p>
        </div>

        <div>
          <label className="flex items-center gap-2 text-[13.5px] cursor-pointer">
            <input
              type="checkbox"
              checked={retiradaHabilitada}
              onChange={(e) => setRetiradaHabilitada(e.target.checked)}
              className="w-4 h-4"
            />
            Permitir retirada na loja no checkout
          </label>
          <p className="text-[12.5px] text-mozz-gray mt-1 mb-2">
            Quando marcado, o cliente vê "Retirar na loja - Grátis" como opção de entrega no
            carrinho, sem precisar calcular frete.
          </p>
          <textarea
            value={retiradaInstrucoes}
            onChange={(e) => setRetiradaInstrucoes(e.target.value)}
            placeholder="Endereço da loja e horário de funcionamento, pra mostrar pro cliente quando ele escolher retirar (ex: Rua Tal, 123 - Bairro - de seg a sáb, 10h às 19h)"
            rows={3}
            className="w-full border border-black/20 px-3 py-2 text-[13.5px]"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 mt-4">
        <button
          onClick={salvar}
          disabled={salvando}
          className="text-[12.5px] px-3 py-1.5 bg-mozz-black text-white disabled:opacity-50"
        >
          {salvando ? "Salvando..." : "Salvar"}
        </button>
        {salvoAgora && <span className="text-[12px] text-mozz-gray">Salvo</span>}
        {erro && <span className="text-[12px] text-red-600">{erro}</span>}
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { formatarPreco } from "@/lib/formato";

export type PedidoPainel = {
  numeroPedido: string;
  nome: string;
  email: string;
  pecas: string[];
  valorTotal: number;
  formaEnvio: string;
  statusEnvio: string | null;
  codigoRastreio: string | null;
  linkRastreio: string | null;
  criadoEm: string;
  emailRastreioEnviadoEm: string | null;
};

const ROTULO_STATUS: Record<string, string> = {
  etiqueta_gerada: "Etiqueta gerada",
  postado: "Postado",
  entregue: "Entregue",
  falha_etiqueta: "Falha na etiqueta"
};

function dataCurta(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function LinhaPedido({ inicial }: { inicial: PedidoPainel }) {
  const [pedido, setPedido] = useState(inicial);
  const [codigo, setCodigo] = useState(inicial.codigoRastreio ?? "");
  const [enviando, setEnviando] = useState(false);
  const [mensagem, setMensagem] = useState<string | null>(null);

  const ehCorreios = pedido.formaEnvio === "correios";
  const jaEnviado = Boolean(pedido.emailRastreioEnviadoEm);

  async function enviar() {
    setEnviando(true);
    setMensagem(null);
    try {
      const resposta = await fetch("/api/admin/pedidos/rastreio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ numeroPedido: pedido.numeroPedido, codigo })
      });
      const dados = await resposta.json().catch(() => ({}));
      if (!resposta.ok) {
        setMensagem(dados.erro ?? "Não foi possível enviar");
        return;
      }
      setPedido({
        ...pedido,
        codigoRastreio: codigo.trim().toUpperCase() || pedido.codigoRastreio,
        statusEnvio: pedido.statusEnvio === "falha_etiqueta" || !pedido.statusEnvio ? "etiqueta_gerada" : pedido.statusEnvio,
        emailRastreioEnviadoEm: new Date().toISOString()
      });
      setMensagem("E-mail enviado para a cliente ✓");
    } catch {
      setMensagem("Erro de conexão, tente de novo");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="border border-black/15 rounded-lg p-4 flex flex-col gap-2">
      <div className="flex flex-wrap justify-between gap-2">
        <p className="font-medium">
          {pedido.nome} <span className="text-mozz-gray text-[13px]">· {pedido.numeroPedido}</span>
        </p>
        <p className="text-[13px] text-mozz-gray">
          {dataCurta(pedido.criadoEm)} · {formatarPreco(pedido.valorTotal)}
        </p>
      </div>
      <p className="text-[14px]">{pedido.pecas.join(" · ")}</p>
      <p className="text-[13px] text-mozz-gray">
        {ehCorreios ? "Correios" : pedido.formaEnvio === "retirada" ? "Retirada na loja" : "Entrega em Reserva"}
        {pedido.statusEnvio ? ` · ${ROTULO_STATUS[pedido.statusEnvio] ?? pedido.statusEnvio}` : ""}
        {pedido.codigoRastreio ? " · " : ""}
        {pedido.codigoRastreio &&
          (pedido.linkRastreio ? (
            <a href={pedido.linkRastreio} target="_blank" rel="noreferrer" className="underline">
              {pedido.codigoRastreio}
            </a>
          ) : (
            pedido.codigoRastreio
          ))}
      </p>

      {ehCorreios &&
        (jaEnviado ? (
          <p className="text-[13px] text-green-700">
            E-mail de rastreio enviado em {dataCurta(pedido.emailRastreioEnviadoEm!)}
          </p>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              placeholder="Código de rastreio (ex: AP123456789BR)"
              className="border border-black/15 rounded px-3 py-2 text-[14px] flex-1 min-w-[220px]"
            />
            <button
              onClick={enviar}
              disabled={enviando || !codigo.trim()}
              className="bg-black text-white rounded-full px-4 py-2 text-[14px] disabled:opacity-40"
            >
              {enviando ? "Enviando..." : "Enviar e-mail de rastreio"}
            </button>
          </div>
        ))}
      {mensagem && <p className="text-[13px]">{mensagem}</p>}
    </div>
  );
}

export default function PainelPedidos({ pedidosIniciais }: { pedidosIniciais: PedidoPainel[] }) {
  if (pedidosIniciais.length === 0) return <p className="text-mozz-gray">Nenhum pedido encontrado.</p>;
  return (
    <div className="flex flex-col gap-3">
      {pedidosIniciais.map((p) => (
        <LinhaPedido key={p.numeroPedido} inicial={p} />
      ))}
    </div>
  );
}

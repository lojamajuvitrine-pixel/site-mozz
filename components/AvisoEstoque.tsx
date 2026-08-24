"use client";

import { useState } from "react";

type Estado = "form" | "enviando" | "sucesso" | "erro";

// Aparece na pagina do produto quando o tamanho escolhido esta esgotado (ver SeletorProduto.tsx)
// - a cliente deixa o e-mail e recebe um aviso automatico quando esse tamanho especifico
// voltar a ter saldo (ver scripts/sync-estoque.ts, que checa isso a cada sync e dispara o
// e-mail via Resend).
export default function AvisoEstoque({ produtoId, tamanho }: { produtoId: string; tamanho: string }) {
  const [estado, setEstado] = useState<Estado>("form");
  const [email, setEmail] = useState("");

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    setEstado("enviando");
    try {
      const resposta = await fetch("/api/avisos-estoque", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ produtoId, tamanho, email })
      });
      if (!resposta.ok) throw new Error();
      setEstado("sucesso");
    } catch {
      setEstado("erro");
    }
  }

  if (estado === "sucesso") {
    return (
      <p className="text-[13.5px] text-mozz-black bg-mozz-stone px-3 py-2.5 mb-4">
        Pronto! Avisamos {email} assim que o tamanho {tamanho} voltar ao estoque.
      </p>
    );
  }

  return (
    <form onSubmit={enviar} className="mb-4">
      <p className="text-[13.5px] text-mozz-gray mb-2">
        Tamanho {tamanho} esgotado. Quer que a gente avise por e-mail quando voltar?
      </p>
      <div className="flex gap-2">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="seu@email.com"
          className="flex-1 border border-black/20 px-3 py-2 text-[13.5px]"
        />
        <button
          type="submit"
          disabled={estado === "enviando"}
          className="text-[13.5px] px-4 py-2 border border-mozz-black hover:bg-mozz-black hover:text-white transition-colors disabled:opacity-40"
        >
          {estado === "enviando" ? "Enviando..." : "Avise-me"}
        </button>
      </div>
      {estado === "erro" && (
        <p className="text-[12.5px] text-mozz-gray mt-1.5">Não deu pra enviar agora, tenta de novo.</p>
      )}
    </form>
  );
}

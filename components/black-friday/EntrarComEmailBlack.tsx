"use client";

import { useState } from "react";

const OURO = "#C9A24B";

// 26/11/2026 (Brunno): durante o acesso antecipado, quem ja' se cadastrou entra digitando o
// e-mail do cadastro (link geral da Black, sem codigo).
export default function EntrarComEmailBlack() {
  const [email, setEmail] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      const resposta = await fetch("/api/black-friday/entrar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });
      const dados = await resposta.json().catch(() => ({}));
      if (!resposta.ok) throw new Error(dados.erro ?? "Não foi possível entrar.");
      window.location.assign("/black-friday");
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : "Não foi possível entrar.");
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={entrar} className="space-y-3 text-left">
      <input
        className="w-full rounded-md border border-white/20 bg-white/5 px-4 py-3 text-[15px] text-white placeholder-white/40 outline-none focus:border-[#C9A24B]"
        placeholder="E-mail do seu cadastro"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        autoComplete="email"
      />
      {erro && <p className="text-[14px] text-red-300">{erro}</p>}
      <button
        type="submit"
        disabled={enviando}
        className="block w-full rounded-full py-4 text-center text-base font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-60"
        style={{ backgroundColor: OURO }}
      >
        {enviando ? "Conferindo..." : "Entrar no acesso antecipado"}
      </button>
    </form>
  );
}

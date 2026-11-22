"use client";

import { useState } from "react";

const OURO = "#C9A24B";

// Cadastro pro acesso antecipado da Black Friday (textos aprovados pelo Brunno em 20/11/2026).
export default function FormCadastroBlack() {
  const [nome, setNome] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [aceite, setAceite] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [confirmado, setConfirmado] = useState<string | null>(null);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (!aceite) {
      setErro("Marque a opção para receber as ofertas da Mozz.");
      return;
    }
    setEnviando(true);
    try {
      const resposta = await fetch("/api/black-friday/cadastro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome, whatsapp, email, aceite })
      });
      const dados = await resposta.json().catch(() => ({}));
      if (!resposta.ok) throw new Error(dados.erro ?? "Não foi possível concluir o cadastro.");
      setConfirmado(nome.trim().split(" ")[0] || nome.trim());
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : "Não foi possível concluir o cadastro.");
    } finally {
      setEnviando(false);
    }
  }

  if (confirmado) {
    return (
      <div className="rounded-lg border border-[#C9A24B]/50 bg-white/5 p-5 text-center">
        <p className="text-lg font-medium text-white">Pronto, {confirmado}!</p>
        <p className="mt-2 text-[15px] text-white/80">
          Dia 26/11 às 21h você recebe no WhatsApp e no e-mail o link de acesso antecipado.
        </p>
      </div>
    );
  }

  const classeCampo =
    "w-full rounded-md border border-white/20 bg-white/5 px-4 py-3 text-[15px] text-white placeholder-white/40 outline-none focus:border-[#C9A24B]";

  return (
    <form onSubmit={enviar} className="space-y-3 text-left">
      <input className={classeCampo} placeholder="Nome" value={nome} onChange={(e) => setNome(e.target.value)} required autoComplete="name" />
      <input
        className={classeCampo}
        placeholder="WhatsApp com DDD"
        value={whatsapp}
        onChange={(e) => setWhatsapp(e.target.value)}
        required
        inputMode="tel"
        autoComplete="tel"
      />
      <input
        className={classeCampo}
        placeholder="E-mail"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        autoComplete="email"
      />
      <label className="flex items-start gap-2 text-[13.5px] text-white/70">
        <input type="checkbox" checked={aceite} onChange={(e) => setAceite(e.target.checked)} className="mt-1" />
        Aceito receber ofertas da Mozz
      </label>
      {erro && <p className="text-[14px] text-red-300">{erro}</p>}
      <button
        type="submit"
        disabled={enviando}
        className="block w-full rounded-full py-4 text-center text-base font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-60"
        style={{ backgroundColor: OURO }}
      >
        {enviando ? "Enviando..." : "Quero acesso antecipado"}
      </button>
    </form>
  );
}

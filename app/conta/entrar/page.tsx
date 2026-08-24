"use client";

// Login sem senha, por CODIGO de 6 digitos (nao mais link clicavel) - o cliente digita o
// e-mail, recebe um codigo, digita esse codigo aqui. Trocamos de link pra codigo em
// 24/08/2026 por causa de um problema real com e-mail @hotmail/@outlook (confirmado com o
// Brunno): o Microsoft Safe Links "clica" sozinho em todo link de e-mail pra escanear
// seguranca, ANTES do usuario ver a mensagem - isso consome o link magico (uso unico) e da'
// "link expirado" mesmo no primeiro clique de verdade do usuario. Codigo digitado a mao nao
// tem esse problema, porque nao existe link nenhum pra escanear.
//
// IMPORTANTE: pra isso funcionar, o template de e-mail "Magic Link" (e idealmente tambem
// "Confirm signup", usado so' no PRIMEIRO login de um e-mail novo) no Supabase precisam
// mostrar {{ .Token }} em vez de {{ .ConfirmationURL }} - ver PROXIMOS_PASSOS.md.
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { SUPABASE_CONFIGURADO } from "@/lib/supabase/config";

function FormularioEntrar() {
  const params = useSearchParams();
  const router = useRouter();
  // Pra onde mandar depois do login - normalmente /conta, mas o middleware manda pra ca' com
  // ?next=/admin/... quando quem tentou acessar o painel administrativo ainda nao tinha
  // sessao (mesmo login serve pros dois casos, cliente e admin).
  const next = params.get("next") || "/conta";

  const [etapa, setEtapa] = useState<"email" | "codigo">("email");
  const [email, setEmail] = useState("");
  const [codigo, setCodigo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(
    params.get("erro") === "link-invalido" ? "Esse link expirou ou já foi usado. Pede um código novo." : null
  );

  async function pedirCodigo(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({ email });
      if (error) throw error;
      setEtapa("codigo");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível enviar o código. Tenta de novo.");
    } finally {
      setEnviando(false);
    }
  }

  async function confirmarCodigo(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.verifyOtp({ email, token: codigo.trim(), type: "email" });
      if (error) throw error;
      router.push(next);
      router.refresh();
    } catch {
      setErro("Código inválido ou expirado. Confere se digitou certo, ou pede um código novo.");
    } finally {
      setEnviando(false);
    }
  }

  if (!SUPABASE_CONFIGURADO) {
    return (
      <section className="py-16 max-w-sm mx-auto text-center">
        <p className="font-serif text-3xl mb-3">Minha conta</p>
        <p className="text-[14.5px] text-mozz-gray">
          Essa área ainda está sendo configurada. Volta em breve.
        </p>
      </section>
    );
  }

  if (etapa === "codigo") {
    return (
      <section className="py-16 max-w-sm mx-auto">
        <p className="font-serif text-3xl mb-1 text-center">Digite o código</p>
        <p className="text-[14.5px] text-mozz-gray mb-8 text-center">
          Mandamos um código de 6 dígitos pra <strong>{email}</strong>.
        </p>
        <form onSubmit={confirmarCodigo} className="flex flex-col gap-3">
          <input
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="000000"
            inputMode="numeric"
            autoFocus
            className="border border-black/20 px-3 py-2.5 text-[20px] tracking-[0.4em] text-center focus:outline-none focus:border-mozz-black"
          />
          {erro && <p className="text-[13.5px] text-red-600">{erro}</p>}
          <button
            type="submit"
            disabled={enviando || codigo.length < 6}
            className="text-[14.5px] py-3 bg-mozz-black text-white disabled:opacity-60"
          >
            {enviando ? "Entrando..." : "Entrar"}
          </button>
          <button
            type="button"
            onClick={() => {
              setEtapa("email");
              setCodigo("");
              setErro(null);
            }}
            className="text-[13px] text-mozz-gray underline"
          >
            Usar outro e-mail ou pedir um código novo
          </button>
        </form>
      </section>
    );
  }

  return (
    <section className="py-16 max-w-sm mx-auto">
      <p className="font-serif text-3xl mb-1 text-center">Minha conta</p>
      <p className="text-[14.5px] text-mozz-gray mb-8 text-center">
        Entra com seu e-mail pra acompanhar seus pedidos.
      </p>
      <form onSubmit={pedirCodigo} className="flex flex-col gap-3">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="seu@email.com"
          className="border border-black/20 px-3 py-2.5 text-[14.5px] focus:outline-none focus:border-mozz-black"
        />
        {erro && <p className="text-[13.5px] text-red-600">{erro}</p>}
        <button
          type="submit"
          disabled={enviando}
          className="text-[14.5px] py-3 bg-mozz-black text-white disabled:opacity-60"
        >
          {enviando ? "Enviando..." : "Receber código de acesso"}
        </button>
      </form>
    </section>
  );
}

export default function PaginaEntrar() {
  return (
    <Suspense fallback={null}>
      <FormularioEntrar />
    </Suspense>
  );
}

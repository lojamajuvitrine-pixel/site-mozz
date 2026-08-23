"use client";

// Login sem senha (magic link): o cliente so' digita o e-mail, recebe um link do Supabase e
// clica pra entrar - sem senha nenhuma pra criar, esquecer ou pra gente guardar. O link leva
// pro app/auth/callback/route.ts, que troca o codigo por uma sessao de verdade.
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { SUPABASE_CONFIGURADO } from "@/lib/supabase/config";

function FormularioEntrar() {
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState<string | null>(
    params.get("erro") === "link-invalido" ? "Esse link expirou ou já foi usado. Pede um novo." : null
  );

  async function enviarLink(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=/conta`
        }
      });
      if (error) throw error;
      setEnviado(true);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível enviar o link. Tenta de novo.");
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

  if (enviado) {
    return (
      <section className="py-16 max-w-sm mx-auto text-center">
        <p className="font-serif text-3xl mb-3">Verifica seu e-mail</p>
        <p className="text-[14.5px] text-mozz-gray">
          Mandamos um link de acesso pra <strong>{email}</strong>. Clica nele pra entrar - pode
          fechar essa aba.
        </p>
      </section>
    );
  }

  return (
    <section className="py-16 max-w-sm mx-auto">
      <p className="font-serif text-3xl mb-1 text-center">Minha conta</p>
      <p className="text-[14.5px] text-mozz-gray mb-8 text-center">
        Entra com seu e-mail pra acompanhar seus pedidos.
      </p>
      <form onSubmit={enviarLink} className="flex flex-col gap-3">
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
          {enviando ? "Enviando..." : "Receber link de acesso"}
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

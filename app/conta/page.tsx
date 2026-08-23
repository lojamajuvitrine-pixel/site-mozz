import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Protegida pelo middleware.ts (redireciona pra /conta/entrar antes de chegar aqui se nao
// tiver sessao) - o redirect() abaixo e' so' uma segunda camada de seguranca, caso essa
// pagina seja renderizada de algum jeito que pule o middleware.
export const dynamic = "force-dynamic";

export default async function PaginaConta() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/conta/entrar");
  }

  return (
    <section className="py-12 max-w-xl">
      <div className="flex items-baseline justify-between mb-8">
        <div>
          <p className="font-serif text-3xl mb-1">Minha conta</p>
          <p className="text-[14.5px] text-mozz-gray">{user.email}</p>
        </div>
        <form action="/auth/sair" method="post">
          <button type="submit" className="text-[13.5px] text-mozz-gray underline">
            Sair
          </button>
        </form>
      </div>

      <div>
        <p className="text-[14.5px] mb-3">Meus pedidos</p>
        {/* Historico real de pedidos depende da integracao pagamento -> Bling ainda estar
            pendente (ver PROXIMOS_PASSOS.md, item 3) - assim que um pedido pago virar registro
            no Bling, essa secao passa a listar por e-mail/CPF do cliente em vez desse aviso. */}
        <div className="border border-black/10 px-4 py-6 text-center">
          <p className="text-[14.5px] text-mozz-gray">Você ainda não fez nenhum pedido.</p>
          <a href="/produtos" className="text-[14.5px] underline mt-2 inline-block">
            Ver catálogo
          </a>
        </div>
      </div>
    </section>
  );
}

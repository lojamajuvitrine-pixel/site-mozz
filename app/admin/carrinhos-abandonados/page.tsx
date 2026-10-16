import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ehAdmin } from "@/lib/admin";
import PainelCarrinhosAbandonados, { type LinhaCheckout } from "@/components/admin/PainelCarrinhosAbandonados";

export const dynamic = "force-dynamic";

// Carrinhos abandonados (15/10/2026) - todo mundo que comecou o checkout (etapa "Seus dados"
// pra frente) nos ultimos 30 dias, com botao pra chamar no WhatsApp quem nao pagou. Os dados
// vem da funcao listar_checkouts_admin do Supabase, que so' responde pro e-mail admin (mesma
// regra do resto do /admin) e ja' marca como "pago" quem virou pedido aprovado.
export default async function PaginaCarrinhosAbandonados() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) redirect("/conta/entrar?next=/admin/carrinhos-abandonados");
  if (!ehAdmin(user.email)) redirect("/");

  const { data, error } = await supabase.rpc("listar_checkouts_admin", { p_dias: 30 });

  return (
    <section className="py-8">
      <p className="font-serif text-3xl mb-1">Carrinhos abandonados</p>
      <p className="text-[14.5px] text-mozz-gray mb-6">
        Quem começou a compra nos últimos 30 dias. Quem parou no meio aparece em “Não finalizados” —
        é só tocar em “Chamar no WhatsApp” que a mensagem já vai pronta.
      </p>
      {error ? (
        <p className="text-[14.5px] text-red-600">Não foi possível carregar: {error.message}</p>
      ) : (
        <PainelCarrinhosAbandonados linhas={(data ?? []) as LinhaCheckout[]} />
      )}
    </section>
  );
}

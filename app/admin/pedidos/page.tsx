import { redirect } from "next/navigation";
import { createClient as clienteSupabase } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { ehAdmin } from "@/lib/admin";
import PainelPedidos, { type PedidoPainel } from "@/components/admin/PainelPedidos";

export const dynamic = "force-dynamic";

// Painel de pedidos do site (24/11/2026): ver os pedidos recentes, colar o rastreio de etiqueta
// feita na mao e mandar o e-mail "pedido enviado" pra cliente. Ver lib/emailRastreio.ts.
export default async function PaginaAdminPedidos() {
  const supabaseUsuario = createClient();
  const {
    data: { user }
  } = await supabaseUsuario.auth.getUser();
  if (!user) redirect("/conta/entrar?next=/admin/pedidos");
  if (!ehAdmin(user.email)) redirect("/");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  let pedidos: PedidoPainel[] = [];
  if (url && chave) {
    const supabase = clienteSupabase(url, chave, { auth: { persistSession: false } });
    const { data } = await supabase
      .from("pedidos")
      .select("numero_pedido, nome, email, itens, valor_total, forma_envio, status_envio, codigo_rastreio, link_rastreio, criado_em, email_rastreio_enviado_em")
      .order("criado_em", { ascending: false })
      .limit(50);
    pedidos = (data ?? []).map((p) => ({
      numeroPedido: String(p.numero_pedido),
      nome: String(p.nome ?? ""),
      email: String(p.email ?? ""),
      pecas: Array.isArray(p.itens)
        ? (p.itens as { nome?: string; qtd?: number }[]).map((i) => `${i.qtd && i.qtd > 1 ? `${i.qtd}x ` : ""}${i.nome ?? ""}`)
        : [],
      valorTotal: Number(p.valor_total ?? 0),
      formaEnvio: String(p.forma_envio ?? ""),
      statusEnvio: p.status_envio ? String(p.status_envio) : null,
      codigoRastreio: p.codigo_rastreio ? String(p.codigo_rastreio) : null,
      linkRastreio: p.link_rastreio ? String(p.link_rastreio) : null,
      criadoEm: String(p.criado_em),
      emailRastreioEnviadoEm: p.email_rastreio_enviado_em ? String(p.email_rastreio_enviado_em) : null
    }));
  }

  return (
    <section className="py-8">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
        <p className="font-serif text-3xl">Pedidos do site</p>
        <a href="/admin/produtos" className="text-[14px] underline">
          Painel de produtos →
        </a>
      </div>
      <p className="text-[14.5px] text-mozz-gray mb-6">
        Quando a etiqueta é feita na mão no Melhor Envio, cole o código de rastreio aqui e clique em
        enviar: a cliente recebe o e-mail &quot;pedido enviado&quot; com o link de acompanhamento. Cada
        pedido recebe esse e-mail uma vez só.
      </p>
      <PainelPedidos pedidosIniciais={pedidos} />
    </section>
  );
}

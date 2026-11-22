import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ehAdmin } from "@/lib/admin";
import { listarProdutos } from "@/lib/produtos";
import {
  CODIGO_ACESSO_ANTECIPADO,
  LIBERAR_ENVIO_EMAIL_EM,
  buscarPrecosBlackFriday,
  clienteServicoBlackFriday
} from "@/lib/blackFriday";
import { SITE_URL } from "@/lib/site";
import PainelBlackFriday, { type CadastroBlack, type PecaBlack } from "@/components/admin/PainelBlackFriday";

export const dynamic = "force-dynamic";

// Painel da Black Friday (pedido do Brunno em 20/11/2026): escolher as pecas e o preco da Black,
// ver quem se cadastrou e mandar o e-mail de acesso antecipado. Ver lib/blackFriday.ts.
export default async function PaginaAdminBlackFriday() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/conta/entrar?next=/admin/black-friday");
  if (!ehAdmin(user.email)) redirect("/");

  const servico = clienteServicoBlackFriday();
  const [produtos, precos, cadastrosResp] = await Promise.all([
    listarProdutos(),
    buscarPrecosBlackFriday(),
    servico
      ? servico
          .from("black_friday_cadastros")
          .select("nome, whatsapp, email, criado_em, email_acesso_enviado_em")
          .order("criado_em", { ascending: false })
      : Promise.resolve({ data: [] as CadastroBlack[] })
  ]);

  const pecas: PecaBlack[] = produtos.map((p) => ({
    id: p.id,
    nome: p.nome,
    marca: p.marca,
    imagem: p.imagem,
    precoCheio: p.precoOriginal ?? p.preco,
    precoBlack: precos.get(p.id) ?? null
  }));

  return (
    <section className="py-8">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
        <p className="font-serif text-3xl">Black Friday</p>
        <a href="/black-friday" className="text-[14px] underline">
          Ver prévia da página →
        </a>
      </div>
      <p className="text-[14.5px] text-mozz-gray mb-6">
        Marque as peças e o preço da Black. O preço passa a valer no site inteiro em 26/11 às 21h (acesso
        antecipado) e vai até 30/11 às 23h59. Antes disso, só você vê, na prévia.
      </p>
      <PainelBlackFriday
        pecasIniciais={pecas}
        cadastros={(cadastrosResp.data ?? []) as CadastroBlack[]}
        linkAcesso={`${SITE_URL}/black-friday?acesso=${CODIGO_ACESSO_ANTECIPADO}`}
        liberarEnvioEm={LIBERAR_ENVIO_EMAIL_EM}
      />
    </section>
  );
}

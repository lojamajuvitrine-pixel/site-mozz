import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ehAdmin } from "@/lib/admin";
import { listarProdutos } from "@/lib/produtos";
import { composicaoDoProduto } from "@/lib/detalhesProduto";
import { buscarConfiguracaoLoja } from "@/lib/configLoja";
import PainelProdutos from "@/components/admin/PainelProdutos";
import ConfiguracoesLoja from "@/components/admin/ConfiguracoesLoja";

export const dynamic = "force-dynamic";

export default async function PaginaAdminProdutos() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) redirect("/conta/entrar?next=/admin/produtos");
  if (!ehAdmin(user.email)) redirect("/");

  const [produtos, configuracaoLoja] = await Promise.all([
    listarProdutos({ incluirSemFoto: true, incluirInativos: true }),
    buscarConfiguracaoLoja()
  ]);

  const linhas = produtos.map((p) => ({
    id: p.id,
    nome: p.nome,
    marca: p.marca,
    imagem: p.imagem,
    precoBling: p.precoOriginal ?? p.preco,
    precoEspecialAtual: p.precoOriginal ? p.preco : null,
    destaque: !!p.destaque,
    outlet: !!p.outlet,
    ativo: p.ativo !== false,
    medidasSalvas: p.medidasCustomizadas ?? null,
    composicaoCustomizada: !!p.composicaoCustomizada,
    composicaoAtual: composicaoDoProduto(p)
  }));

  return (
    <section className="py-8">
      <p className="font-serif text-3xl mb-1">Painel de produtos</p>
      <p className="text-[14.5px] text-mozz-gray mb-6">
        Preço especial, destaque na home, outlet, ativar/desativar, composição e tabela de
        medidas - tudo isso é só do site, não mexe em nada dentro do Bling.
      </p>
      <ConfiguracoesLoja configuracaoInicial={configuracaoLoja} />
      <PainelProdutos produtosIniciais={linhas} />
    </section>
  );
}

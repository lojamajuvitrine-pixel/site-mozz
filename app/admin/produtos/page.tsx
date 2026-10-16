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
    composicaoAtual: composicaoDoProduto(p),
    // cores + fotos (ja' vem com a escolha de "1a foto" aplicada, ver aplicarCapaPorCor em
    // lib/produtos.ts) e o mapa cru salvo, pra o painel iniciar cada produto sem perder a
    // escolha de uma cor que o Brunno nao mexer nessa visita.
    cores: (p.cores ?? []).map((c) => ({ cor: c.cor, imagens: c.imagens })),
    capaPorCorSalva: p.capaPorCor ?? null
  }));

  return (
    <section className="py-8">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
        <p className="font-serif text-3xl">Painel de produtos</p>
        <a href="/admin/carrinhos-abandonados" className="text-[14px] underline">
          Carrinhos abandonados →
        </a>
      </div>
      <p className="text-[14.5px] text-mozz-gray mb-6">
        Preço especial, destaque na home, outlet, ativar/desativar, composição, tabela de
        medidas e qual foto vem primeiro no carrossel de cada cor - tudo isso é só do site, não
        mexe em nada dentro do Bling.
      </p>
      <ConfiguracoesLoja configuracaoInicial={configuracaoLoja} />
      <PainelProdutos produtosIniciais={linhas} />
    </section>
  );
}

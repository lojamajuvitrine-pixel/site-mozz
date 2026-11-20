import type { Metadata } from "next";
import { redirect } from "next/navigation";
import GradeProdutos from "@/components/GradeProdutos";
import ContagemRegressiva from "@/components/black-friday/ContagemRegressiva";
import FormCadastroBlack from "@/components/black-friday/FormCadastroBlack";
import { listarBlackFriday, type Produto } from "@/lib/produtos";
import {
  BLACK_FRIDAY_ABERTURA,
  BLACK_FRIDAY_FIM,
  CODIGO_ACESSO_ANTECIPADO,
  blackFridayAberta,
  blackFridayEncerrada,
  precosBlackFridayAtivos
} from "@/lib/blackFriday";
import { createClient } from "@/lib/supabase/server";
import { ehAdmin } from "@/lib/admin";
import { SITE_URL as siteUrl } from "@/lib/site";

// Pagina da Black Friday Mozz (textos e regras aprovados pelo Brunno em 20/11/2026) - ver as
// datas em lib/blackFriday.ts. Antes de abrir: contagem regressiva + cadastro. O admin ve a
// vitrine completa a qualquer momento (previa), pra ir montando as ofertas.
export const metadata: Metadata = {
  title: "Black Friday",
  description: "Black Friday Mozz: Farm, NV, Reserva, Animale e Foxton de 28 a 30/11. Cadastre-se e compre antes de todo mundo.",
  alternates: { canonical: `${siteUrl}/black-friday` }
};

export const dynamic = "force-dynamic";

const OURO = "#C9A24B";

function percentualDesconto(produto: Produto): number {
  if (!produto.precoOriginal || produto.precoOriginal <= produto.preco) return 0;
  return Math.round((1 - produto.preco / produto.precoOriginal) * 100);
}

async function usuarioEhAdmin(): Promise<boolean> {
  try {
    const supabase = createClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();
    return ehAdmin(user?.email);
  } catch {
    return false;
  }
}

export default async function PaginaBlackFriday({ searchParams }: { searchParams?: { acesso?: string } }) {
  if (blackFridayEncerrada()) redirect("/outlet");

  const admin = await usuarioEhAdmin();
  const aberta = blackFridayAberta();
  const acessoAntecipado = searchParams?.acesso === CODIGO_ACESSO_ANTECIPADO && precosBlackFridayAtivos();
  const mostrarVitrine = aberta || acessoAntecipado || admin;
  const previa = admin && !aberta && !acessoAntecipado;

  if (!mostrarVitrine) {
    return (
      <section className="-mx-4 sm:mx-0 bg-black px-6 py-12 sm:rounded-lg">
        <div className="mx-auto max-w-md text-center">
          <p className="text-4xl font-semibold" style={{ color: OURO, letterSpacing: "0.35em", paddingLeft: "0.35em" }}>
            MOZZ
          </p>
          <p className="mt-4 text-3xl sm:text-4xl font-extrabold tracking-tight text-white">BLACK FRIDAY</p>

          <div className="mt-8">
            <ContagemRegressiva alvo={BLACK_FRIDAY_ABERTURA} />
          </div>

          <h1 className="mt-8 text-xl font-medium leading-snug text-white">As melhores ofertas do ano estão chegando</h1>
          <p className="mt-3 text-[15px] leading-relaxed text-white/80">
            Farm, NV, Reserva, Animale e Foxton com descontos que só acontecem uma vez por ano. Cadastre-se e receba
            acesso antecipado: você compra antes de todo mundo, com a grade completa.
          </p>

          <div className="mt-7">
            <FormCadastroBlack />
          </div>

          <p className="mt-6 text-xs text-white/50">Black Friday Mozz: de 28 a 30/11, enquanto durarem os estoques.</p>
        </div>
      </section>
    );
  }

  const produtos = (await listarBlackFriday()).sort((a, b) => percentualDesconto(b) - percentualDesconto(a));
  const marcas = Array.from(new Set(produtos.map((p) => p.marca))).sort();
  const maiorDesconto = produtos.reduce((maior, p) => Math.max(maior, percentualDesconto(p)), 0);

  return (
    <section className="py-6">
      {previa && (
        <div className="mb-4 rounded-md bg-yellow-300 px-4 py-3 text-[14px] text-black">
          <strong>PRÉVIA</strong> - só você está vendo. Acesso antecipado em 27/11 às 21h e abertura para todos em
          28/11 à 00h00. Monte as ofertas em{" "}
          <a href="/admin/black-friday" className="underline">
            /admin/black-friday
          </a>
          .
        </div>
      )}

      <div className="-mx-4 sm:mx-0 mb-6 bg-black px-6 py-8 text-center sm:rounded-lg">
        <p className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">BLACK FRIDAY</p>
        {maiorDesconto > 0 && (
          <div className="mx-auto mt-3 inline-block bg-white px-4 py-1">
            <p className="text-xl font-extrabold text-black">ATÉ {maiorDesconto}% OFF</p>
          </div>
        )}
        <p className="mt-4 text-[14px] uppercase tracking-[0.2em]" style={{ color: OURO }}>
          {acessoAntecipado && !aberta ? "Acesso antecipado · " : ""}termina em{" "}
          <span className="text-white">
            <ContagemRegressiva alvo={BLACK_FRIDAY_FIM} compacta recarregarAoFim={false} />
          </span>
        </p>
      </div>

      {produtos.length > 0 ? (
        <GradeProdutos produtos={produtos} marcas={marcas} />
      ) : (
        <p className="py-10 text-center text-mozz-gray">
          {previa ? "Nenhuma peça marcada ainda. Marque as peças em /admin/black-friday." : "As ofertas aparecem aqui em instantes."}
        </p>
      )}
    </section>
  );
}

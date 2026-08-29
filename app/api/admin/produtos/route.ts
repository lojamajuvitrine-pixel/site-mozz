import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ehAdmin } from "@/lib/admin";
import { listarProdutos } from "@/lib/produtos";
import { categoriaDoProduto, composicaoDoProduto, tabelaDeMedidas, tabelaParaCsv } from "@/lib/detalhesProduto";
import PainelProdutos from "@/components/admin/PainelProdutos";

// Painel interno pra mexer em preco especial, destaque (vitrine da home) e outlet de qualquer
// peca, direto no site - sem tocar em nada dentro do Bling. So' o e-mail admin acessa (ver
// lib/admin.ts); o middleware.ts ja bloqueia visitante nao-logado/nao-admin antes de chegar
// aqui, essa checagem e' so' uma segunda camada.
//
// force-dynamic: essa pagina depende da sessao (cookies) de quem esta logado, entao nao da'
// pra pre-renderizar - sempre roda no servidor a cada visita.
export const dynamic = "force-dynamic";

export default async function PaginaAdminProdutos() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) redirect("/conta/entrar?next=/admin/produtos");
  if (!ehAdmin(user.email)) redirect("/");

  // incluirSemFoto: true - o painel precisa mostrar TAMBEM as pecas sem foto ainda (fora do
  // catalogo publico - ver comentario em lib/produtos.ts), pra dar pra preparar preco
  // especial/destaque/outlet ja' esperando a foto subir.
  const produtos = await listarProdutos({ incluirSemFoto: true });

  // O painel precisa do preco ORIGINAL do Bling separado do preco especial (pra mostrar as
  // duas colunas) - listarProdutos() ja devolve isso pronto: quando ha' oferta ativa,
  // "precoOriginal" e' o preco do Bling e "preco" e' o especial; sem oferta, "preco" ja e' o
  // proprio preco do Bling.
  const linhas = produtos.map((p) => {
    // Ponto de partida pro campo de medidas no painel: se ja tem tabela customizada salva,
    // mostra ela; senao, pre-preenche com a tabela GENERICA da categoria (so' de referencia,
    // pra' facilitar - o Brunno so' precisa trocar os numeros em vez de digitar do zero).
    const tabelaGenerica = tabelaDeMedidas(categoriaDoProduto(p.nome));
    const tabelaBase = p.medidasCustomizadas ?? tabelaGenerica;
    return {
      id: p.id,
      nome: p.nome,
      marca: p.marca,
      imagem: p.imagem,
      precoBling: p.precoOriginal ?? p.preco,
      precoEspecialAtual: p.precoOriginal ? p.preco : null,
      destaque: !!p.destaque,
      outlet: !!p.outlet,
      medidasCustomizada: !!p.medidasCustomizadas,
      medidasCsv: tabelaBase ? tabelaParaCsv(tabelaBase) : "",
      // Mesma logica da tabela de medidas: se ja tem composicao customizada salva, mostra
      // ela; senao pre-preenche com o que a pagina do produto mostraria hoje (a do Bling se
      // tiver, senao a generica da categoria) - so' de ponto de partida.
      composicaoCustomizada: !!p.composicaoCustomizada,
      composicaoAtual: composicaoDoProduto(p)
    };
  });

  return (
    <section className="py-8">
      <p className="font-serif text-3xl mb-1">Painel de produtos</p>
      <p className="text-[14.5px] text-mozz-gray mb-6">
        Preço especial, destaque na home, outlet, composição e tabela de medidas - tudo isso é
        só do site, não mexe em nada dentro do Bling.
      </p>
      <PainelProdutos produtosIniciais={linhas} />
    </section>
  );
}

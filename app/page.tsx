import type { Metadata } from "next";
import BannerHero, { type BannerItem } from "@/components/BannerHero";
import FaixaCashback from "@/components/FaixaCashback";
import SecaoMarcas from "@/components/SecaoMarcas";
import VitrineDeMarca from "@/components/VitrineDeMarca";
import { listarPorMarca, produtosComFoto } from "@/lib/produtos";
import { SITE_URL as siteUrl } from "@/lib/site";

export const revalidate = 30;

// Repete os mesmos titulo/descricao do metadata base (app/layout.tsx) porque o Next.js NAO
// faz merge campo a campo dentro de "openGraph" - se a pagina define openGraph, ele substitui
// o objeto inteiro do layout pai, entao title/description precisam vir de novo aqui, senao
// somem do preview de compartilhamento da home. So' a home precisava disso (as paginas de
// produto ja tem generateMetadata proprio - ver app/produto/[slug]/page.tsx); as demais
// paginas continuam herdando o openGraph do layout normalmente.
export async function generateMetadata(): Promise<Metadata> {
  const comFoto = await produtosComFoto();
  const imagemDestaque = comFoto.find((p) => p.imagem)?.imagem;

  return {
    alternates: { canonical: siteUrl },
    openGraph: {
      type: "website",
      locale: "pt_BR",
      siteName: "MOZZ",
      title: "MOZZ — Animale, NV, Reserva e Foxton em um só lugar",
      description: "Loja multimarcas com peças da Animale, NV, Reserva e Foxton.",
      images: imagemDestaque ? [`${siteUrl}${imagemDestaque}`] : undefined
    }
  };
}

export default async function Home() {
  const comFoto = await produtosComFoto();

  // Banner principal rotativo: uma foto de cada uma das 4 marcas ativas, alternando
  // masculino/feminino - Reserva e Foxton sao 100% masculinas, Animale e NV sao focadas em
  // moda feminina (confirmado por pesquisa em 23/08/2026, ver PROXIMOS_PASSOS.md).
  const [reserva, animale, foxton, nv] = await Promise.all([
    listarPorMarca("Reserva"),
    listarPorMarca("Animale"),
    listarPorMarca("Foxton"),
    listarPorMarca("NV")
  ]);
  const produtoReserva = reserva.find((p) => p.imagem);
  const produtoAnimale = animale.find((p) => p.imagem);
  const produtoFoxton = foxton.find((p) => p.imagem);
  const produtoNV = nv.find((p) => p.imagem);
  const banners: BannerItem[] = [
    produtoReserva?.imagem
      ? { imagem: produtoReserva.imagem, marca: "Reserva", label: "Masculino", href: "/marca/reserva" }
      : null,
    produtoAnimale?.imagem
      ? { imagem: produtoAnimale.imagem, marca: "Animale", label: "Feminino", href: "/marca/animale" }
      : null,
    produtoFoxton?.imagem
      ? { imagem: produtoFoxton.imagem, marca: "Foxton", label: "Masculino", href: "/marca/foxton" }
      : null,
    produtoNV?.imagem
      ? { imagem: produtoNV.imagem, marca: "NV", label: "Feminino", href: "/marca/nv" }
      : null
  ].filter((b): b is BannerItem => !!b);
  // fallback se por algum motivo nenhuma das quatro tiver foto ainda (ex: sync incompleto)
  const bannersFinal = banners.length > 0 ? banners : comFoto[0]?.imagem
    ? [{ imagem: comFoto[0].imagem, marca: comFoto[0].marca, label: "", href: "/produtos" }]
    : [];

  // Vitrines por marca (carrossel + texto/CTA do lado) - inspiradas no site oqvestir (print
  // mandado pelo Brunno em 27/09/2026). Reaproveita as listas de cada marca ja' buscadas acima
  // pro banner, filtrando so' as marcadas como destaque no painel - marca sem nenhuma destaque
  // marcada (ex: Reserva, em 27/09/2026) simplesmente nao mostra o bloco (ver VitrineDeMarca).
  const destaquesAnimale = animale.filter((p) => p.destaque && p.imagem);
  const destaquesNV = nv.filter((p) => p.destaque && p.imagem);
  const destaquesReserva = reserva.filter((p) => p.destaque && p.imagem);
  const destaquesFoxton = foxton.filter((p) => p.destaque && p.imagem);

  return (
    <div>
      <BannerHero banners={bannersFinal} />
      <FaixaCashback />

      <SecaoMarcas />

      <VitrineDeMarca
        marca="Animale"
        slug="animale"
        categoria="Animale"
        headline="Elegância que atravessa estações"
        descricao="Alfaiataria e tecidos nobres pra quem não abre mão de sofisticação no dia a dia."
        produtos={destaquesAnimale}
      />
      <VitrineDeMarca
        marca="NV"
        slug="nv"
        categoria="NV"
        headline="Conforto com design autoral"
        descricao="Modelagens exclusivas e tecidos selecionados, pensados pra acompanhar a rotina real da mulher."
        produtos={destaquesNV}
      />
      <VitrineDeMarca
        marca="Reserva"
        slug="reserva"
        categoria="Reserva"
        headline="Essenciais com atitude"
        descricao="Camisetas, jaquetas e calças que resolvem o guarda-roupa masculino sem esforço."
        produtos={destaquesReserva}
      />
      <VitrineDeMarca
        marca="Foxton"
        slug="foxton"
        categoria="Foxton"
        headline="Básicos premium, sem enrolação"
        descricao="Algodão Pima e cortes atuais pra um visual limpo em qualquer ocasião."
        produtos={destaquesFoxton}
      />
    </div>
  );
}

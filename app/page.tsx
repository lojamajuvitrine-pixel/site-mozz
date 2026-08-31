import Image from "next/image";
import Link from "next/link";
import ProductCard from "@/components/ProductCard";
import BannerHero, { type BannerItem } from "@/components/BannerHero";
import FaixaCashback from "@/components/FaixaCashback";
import { listarPorMarca, produtosComFoto } from "@/lib/produtos";

// Quantos produtos aparecem na vitrine "Novidades" da home - o catalogo completo (com todos
// os produtos, com ou sem foto) fica em /produtos.
const QTD_VITRINE = 8;

export const revalidate = 30;

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

  // pra nao repetir a MESMA foto do hero rotativo aqui embaixo (a marca pode repetir, ja que
  // agora as 4 marcas ativas ja aparecem todas no hero - mas a foto do produto e' diferente)
  const imagensDoHero = new Set(bannersFinal.map((b) => b.imagem));
  const bannerProduto = comFoto.find((p) => p.imagem && !imagensDoHero.has(p.imagem)) ?? comFoto[2] ?? comFoto[1];

  // Vitrine "Novidades": prioriza pecas marcadas como destaque no painel /admin/produtos - se
  // o Brunno ainda nao marcou nenhuma, cai no comportamento automatico de sempre (primeiros
  // produtos com foto, na ordem do Bling), pra home nunca ficar vazia.
  const destaques = comFoto.filter((p) => p.destaque);
  const vitrine = (destaques.length > 0 ? destaques : comFoto).slice(0, QTD_VITRINE);

  return (
    <div>
      <BannerHero banners={bannersFinal} />
      <FaixaCashback />

      {bannerProduto?.imagem && (
        <section className="grid md:grid-cols-2 -mx-6 border-b border-black/10">
          <div className="relative aspect-[4/5] md:aspect-auto">
            <Image
              src={bannerProduto.imagem}
              alt={bannerProduto.nome}
              fill
              sizes="(max-width: 768px) 100vw, 50vw"
              quality={85}
              className="object-cover"
            />
          </div>
          <div className="flex flex-col items-start justify-center px-8 py-12 md:px-14">
            <p className="font-serif text-[29px] md:text-[33px] leading-tight mb-4">
              Quatro marcas,
              <br />
              um só lugar
            </p>
            <p className="text-[14.5px] text-mozz-gray max-w-xs mb-6">
              Curadoria Animale, NV, Reserva e Foxton reunida na MOZZ, com entrega pra todo o
              Brasil.
            </p>
            <Link href="/produtos" className="text-[14.5px] underline">
              Explorar catálogo
            </Link>
          </div>
        </section>
      )}

      <section id="novidades" className="py-8">
        <div className="flex items-baseline justify-between mb-4">
          <p className="text-[14.5px] text-mozz-gray">Novidades</p>
          <Link href="/produtos" className="text-[13.5px] text-mozz-gray underline">
            Ver todos os produtos
          </Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {vitrine.map((produto) => (
            <ProductCard key={produto.id} produto={produto} />
          ))}
        </div>
      </section>
    </div>
  );
}

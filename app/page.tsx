import Image from "next/image";
import Link from "next/link";
import ProductCard from "@/components/ProductCard";
import BannerHero, { type BannerItem } from "@/components/BannerHero";
import { listarPorMarca, produtosComFoto } from "@/lib/produtos";

// Quantos produtos aparecem na vitrine "Novidades" da home - o catalogo completo (com todos
// os produtos, com ou sem foto) fica em /produtos.
const QTD_VITRINE = 8;

export default function Home() {
  const comFoto = produtosComFoto();

  // Banner principal rotativo: Reserva (marca 100% masculina) e Animale (a marca feminina
  // mais forte do portfolio) - ver PROXIMOS_PASSOS.md/conversa sobre a escolha dessas duas.
  const produtoReserva = listarPorMarca("Reserva").find((p) => p.imagem);
  const produtoAnimale = listarPorMarca("Animale").find((p) => p.imagem);
  const banners: BannerItem[] = [
    produtoReserva?.imagem
      ? { imagem: produtoReserva.imagem, marca: "Reserva", label: "Masculino", href: "/marca/reserva" }
      : null,
    produtoAnimale?.imagem
      ? { imagem: produtoAnimale.imagem, marca: "Animale", label: "Feminino", href: "/marca/animale" }
      : null
  ].filter((b): b is BannerItem => !!b);
  // fallback se por algum motivo nenhuma das duas tiver foto ainda (ex: sync incompleto)
  const bannersFinal = banners.length > 0 ? banners : comFoto[0]?.imagem
    ? [{ imagem: comFoto[0].imagem, marca: comFoto[0].marca, label: "", href: "/produtos" }]
    : [];

  // pra variar a marca do banner editorial em relacao ao que ja aparece no hero rotativo
  const bannerProduto =
    comFoto.find((p) => p.marca !== "Reserva" && p.marca !== "Animale") ?? comFoto[2] ?? comFoto[1];
  const vitrine = comFoto.slice(0, QTD_VITRINE);

  return (
    <div>
      <BannerHero banners={bannersFinal} />

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
              um so lugar
            </p>
            <p className="text-[14.5px] text-mozz-gray max-w-xs mb-6">
              Curadoria Animale, NV, Reserva e Foxton reunida na MOZZ, com entrega pra todo o
              Brasil.
            </p>
            <Link href="/produtos" className="text-[14.5px] underline">
              Explorar catalogo
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

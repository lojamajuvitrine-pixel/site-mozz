import Image from "next/image";
import Link from "next/link";
import ProductCard from "@/components/ProductCard";
import { marcasDisponiveis, produtosComFoto } from "@/lib/produtos";

// Quantos produtos aparecem na vitrine "Novidades" da home - o catalogo completo (com todos
// os produtos, com ou sem foto) fica em /produtos.
const QTD_VITRINE = 8;

export default function Home() {
  const comFoto = produtosComFoto();
  const marcas = marcasDisponiveis();

  const heroProduto = comFoto[0];
  // pra variar a marca do banner editorial em relacao ao hero, se der
  const bannerProduto = comFoto.find((p) => p.marca !== heroProduto?.marca) ?? comFoto[1];
  const vitrine = comFoto.slice(0, QTD_VITRINE);

  return (
    <div>
      <section className="relative -mx-6 h-[560px] md:h-[640px] bg-mozz-black">
        {heroProduto?.imagem && (
          <Image
            src={heroProduto.imagem}
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover opacity-80"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-black/30" />
        <div className="absolute inset-0 flex flex-col items-center justify-end text-center pb-16 px-6">
          <p className="font-serif text-white text-[40px] md:text-[52px] tracking-wide leading-none">
            Inverno 26
          </p>
          <p className="text-[13px] text-white/80 mt-3 mb-7">
            Animale · NV · Reserva · Foxton
          </p>
          <Link
            href="/produtos"
            className="inline-block text-[13px] px-7 py-2.5 bg-white text-mozz-black"
          >
            Ver colecao
          </Link>
        </div>
      </section>

      <section className="grid grid-cols-2 md:grid-cols-4 border-b border-black/10 -mx-6">
        {marcas.map((marca) => (
          <Link
            key={marca}
            href={`/marca/${marca.toLowerCase()}`}
            className="text-center py-8 border-black/10 border-r last:border-r-0"
          >
            <p className="text-[11px] text-mozz-gray">Marca</p>
            <p className="font-serif text-[15px] mt-1">{marca}</p>
          </Link>
        ))}
      </section>

      {bannerProduto?.imagem && (
        <section className="grid md:grid-cols-2 -mx-6 border-b border-black/10">
          <div className="relative aspect-[4/5] md:aspect-auto">
            <Image
              src={bannerProduto.imagem}
              alt={bannerProduto.nome}
              fill
              sizes="(max-width: 768px) 100vw, 50vw"
              className="object-cover"
            />
          </div>
          <div className="flex flex-col items-start justify-center px-8 py-12 md:px-14">
            <p className="text-[11px] text-mozz-gray mb-2">{bannerProduto.marca}</p>
            <p className="font-serif text-[26px] md:text-[30px] leading-tight mb-4">
              Quatro marcas,
              <br />
              um so lugar
            </p>
            <p className="text-[13px] text-mozz-gray max-w-xs mb-6">
              Curadoria Animale, NV, Reserva e Foxton reunida na MOZZ, com entrega pra todo o
              Brasil.
            </p>
            <Link href="/produtos" className="text-[13px] underline">
              Explorar catalogo
            </Link>
          </div>
        </section>
      )}

      <section id="novidades" className="py-8">
        <div className="flex items-baseline justify-between mb-4">
          <p className="text-[13px] text-mozz-gray">Novidades</p>
          <Link href="/produtos" className="text-[12px] text-mozz-gray underline">
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

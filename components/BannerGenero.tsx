import Image from "next/image";
import Link from "next/link";

export type BannerGeneroItem = { imagem: string; nome: string; href: string };

// Dois banners grandes (FEMININO e MASCULINO), um embaixo do outro, so' no celular - e' a
// primeira coisa que a cliente ve na home, pra escolher o lado da loja logo de cara (pedido do
// Brunno em 19/10/2026). No desktop a home continua com o carrossel de antes (ver app/page.tsx).
// So' o nome, sem frase nem botao (decisao dele). A foto e' de uma peca do catalogo, escolhida
// em app/page.tsx. Sem foto disponivel, o banner vira um bloco liso escuro com o nome.
export default function BannerGenero({ banners }: { banners: BannerGeneroItem[] }) {
  if (banners.length === 0) return null;
  return (
    <section className="md:hidden -mx-6 flex flex-col gap-1 bg-white" aria-label="Escolha por gênero">
      {banners.map((banner, i) => (
        <Link
          key={banner.nome}
          href={banner.href}
          className="relative block aspect-[4/3] bg-mozz-black overflow-hidden"
          aria-label={`Ver coleção ${banner.nome.toLowerCase()}`}
        >
          {banner.imagem && (
            <Image
              src={banner.imagem}
              alt=""
              fill
              sizes="100vw"
              quality={80}
              priority={i === 0}
              className="object-cover object-top"
            />
          )}
          <span className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/70 to-transparent" />
          <span className="absolute inset-x-0 bottom-0 px-5 pb-5 text-white font-serif text-[28px] tracking-[0.18em] uppercase">
            {banner.nome}
          </span>
        </Link>
      ))}
    </section>
  );
}

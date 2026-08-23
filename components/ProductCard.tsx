import Image from "next/image";
import Link from "next/link";
import type { Produto } from "@/lib/produtos";
import { formatarPreco } from "@/lib/formato";

export default function ProductCard({ produto }: { produto: Produto }) {
  return (
    <Link href={`/produto/${produto.id}`} className="block group">
      <div className="relative aspect-[3/4] bg-mozz-stone flex items-center justify-center overflow-hidden">
        {produto.novo && (
          <span className="absolute top-2 left-2 z-10 text-[10px] bg-mozz-black text-white px-2 py-0.5">
            Novo
          </span>
        )}
        {produto.imagem ? (
          <Image
            src={produto.imagem}
            alt={produto.nome}
            fill
            sizes="(max-width: 768px) 50vw, 25vw"
            // card pequeno do mosaico - qualidade mais baixa (o olho nao percebe nesse
            // tamanho) pra carregar rapido mesmo com varios produtos na tela ao mesmo tempo.
            // A foto grande da pagina do produto usa qualidade alta (ver SeletorProduto.tsx).
            quality={60}
            className="object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <span className="text-mozz-gray text-xs">foto do produto</span>
        )}
      </div>
      <p className="text-[12.5px] mt-2">{produto.nome}</p>
      <p className="text-[12.5px] text-mozz-gray">{formatarPreco(produto.preco)}</p>
    </Link>
  );
}

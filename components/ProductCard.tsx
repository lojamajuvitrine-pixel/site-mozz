import Link from "next/link";
import type { Produto } from "@/lib/produtos";
import { formatarPreco } from "@/lib/formato";

export default function ProductCard({ produto }: { produto: Produto }) {
  return (
    <Link href={`/produto/${produto.id}`} className="block group">
      <div className="relative aspect-[3/4] bg-mozz-stone flex items-center justify-center">
        {produto.novo && (
          <span className="absolute top-2 left-2 text-[10px] bg-mozz-black text-white px-2 py-0.5">
            Novo
          </span>
        )}
        <span className="text-mozz-gray text-xs">foto do produto</span>
      </div>
      <p className="text-[12.5px] mt-2">{produto.nome}</p>
      <p className="text-[12.5px] text-mozz-gray">{formatarPreco(produto.preco)}</p>
    </Link>
  );
}

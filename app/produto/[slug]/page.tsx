import Image from "next/image";
import { buscarProduto } from "@/lib/produtos";
import { formatarPreco } from "@/lib/formato";
import { notFound } from "next/navigation";
import BotaoAdicionarCarrinho from "@/components/BotaoAdicionarCarrinho";

export default function PaginaProduto({ params }: { params: { slug: string } }) {
  const produto = buscarProduto(params.slug);
  if (!produto) notFound();

  return (
    <section className="py-8 grid md:grid-cols-2 gap-10">
      <div className="relative aspect-[3/4] bg-mozz-stone flex items-center justify-center overflow-hidden">
        {produto.imagem ? (
          <Image
            src={produto.imagem}
            alt={produto.nome}
            fill
            sizes="(max-width: 768px) 100vw, 50vw"
            className="object-cover"
            priority
          />
        ) : (
          <span className="text-mozz-gray text-xs">foto do produto</span>
        )}
      </div>
      <div>
        <p className="text-[12px] text-mozz-gray">{produto.marca}</p>
        <p className="font-serif text-2xl mt-1">{produto.nome}</p>
        <p className="text-[15px] mt-2">{formatarPreco(produto.preco)}</p>
        <p className="text-[13px] text-mozz-gray mt-4">{produto.descricao}</p>
        <BotaoAdicionarCarrinho produto={produto} />
      </div>
    </section>
  );
}

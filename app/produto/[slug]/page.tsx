import { buscarProduto } from "@/lib/produtos";
import { notFound } from "next/navigation";
import SeletorProduto from "@/components/SeletorProduto";
import DetalhesProduto from "@/components/DetalhesProduto";
import ProdutosRelacionados from "@/components/ProdutosRelacionados";

export default function PaginaProduto({ params }: { params: { slug: string } }) {
  const produto = buscarProduto(params.slug);
  if (!produto) notFound();

  return (
    <div>
      <SeletorProduto produto={produto} />
      <DetalhesProduto produto={produto} />
      <ProdutosRelacionados produto={produto} />
    </div>
  );
}

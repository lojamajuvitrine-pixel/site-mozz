import { buscarProduto } from "@/lib/produtos";
import { notFound } from "next/navigation";
import SeletorProduto from "@/components/SeletorProduto";

export default function PaginaProduto({ params }: { params: { slug: string } }) {
  const produto = buscarProduto(params.slug);
  if (!produto) notFound();

  return <SeletorProduto produto={produto} />;
}

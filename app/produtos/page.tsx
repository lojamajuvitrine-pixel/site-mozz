import ProductCard from "@/components/ProductCard";
import { listarProdutos } from "@/lib/produtos";

// Catalogo completo - a home mostra so' uma vitrine curada, aqui e' tudo que tem estoque.
export default function PaginaProdutos() {
  const produtos = listarProdutos();

  return (
    <section className="py-8">
      <p className="font-serif text-2xl mb-1">Todos os produtos</p>
      <p className="text-[13px] text-mozz-gray mb-6">{produtos.length} pecas disponiveis</p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        {produtos.map((produto) => (
          <ProductCard key={produto.id} produto={produto} />
        ))}
      </div>
    </section>
  );
}

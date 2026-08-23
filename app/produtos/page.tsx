import GradeProdutos from "@/components/GradeProdutos";
import { listarProdutos, marcasDisponiveis } from "@/lib/produtos";

// Catalogo completo - a home mostra so' uma vitrine curada, aqui e' tudo que tem estoque.
export default function PaginaProdutos() {
  const produtos = listarProdutos();
  const marcas = marcasDisponiveis().sort();

  return (
    <section className="py-8">
      <p className="font-serif text-2xl mb-1">Todos os produtos</p>
      <p className="text-[13px] text-mozz-gray mb-6">{produtos.length} pecas disponiveis</p>
      <GradeProdutos produtos={produtos} marcas={marcas} />
    </section>
  );
}

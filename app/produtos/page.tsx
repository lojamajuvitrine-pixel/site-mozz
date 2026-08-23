import GradeProdutos from "@/components/GradeProdutos";
import { listarProdutos, marcasDisponiveis } from "@/lib/produtos";

// Catalogo completo - a home mostra so' uma vitrine curada, aqui e' tudo que tem estoque.
// searchParams.busca vem da barra de busca do menu (Nav > BarraBusca), que manda pra ca'
// com o termo na URL - GradeProdutos usa isso so' como valor inicial do campo de busca dela.
export default function PaginaProdutos({ searchParams }: { searchParams?: { busca?: string } }) {
  const produtos = listarProdutos();
  const marcas = marcasDisponiveis().sort();

  return (
    <section className="py-8">
      <p className="font-serif text-3xl mb-1">Todos os produtos</p>
      <p className="text-[14.5px] text-mozz-gray mb-6">{produtos.length} pecas disponiveis</p>
      <GradeProdutos produtos={produtos} marcas={marcas} buscaInicial={searchParams?.busca} />
    </section>
  );
}

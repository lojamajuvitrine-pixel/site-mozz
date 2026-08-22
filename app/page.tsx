import ProductCard from "@/components/ProductCard";
import { listarProdutos, marcasDisponiveis } from "@/lib/produtos";

export default function Home() {
  const produtos = listarProdutos();
  const marcas = marcasDisponiveis();

  return (
    <div>
      <section className="text-center py-16 bg-mozz-stone -mx-6 px-6">
        <p className="font-serif text-[34px] tracking-wide">Inverno 26</p>
        <p className="text-[13px] text-mozz-gray mt-2 mb-6">
          Animale · NV · Reserva · Foxton
        </p>
        <a
          href="#novidades"
          className="inline-block text-[13px] px-6 py-2.5 bg-mozz-black text-white"
        >
          Ver colecao
        </a>
      </section>

      <section className="grid grid-cols-2 md:grid-cols-4 border-t border-b border-black/10 -mx-6">
        {marcas.map((marca) => (
          <a
            key={marca}
            href={`/marca/${marca.toLowerCase()}`}
            className="text-center py-8 border-black/10 border-r last:border-r-0"
          >
            <p className="text-[11px] text-mozz-gray">Marca</p>
            <p className="font-serif text-[15px] mt-1">{marca}</p>
          </a>
        ))}
      </section>

      <section id="novidades" className="py-8">
        <p className="text-[13px] text-mozz-gray mb-4">Novidades</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {produtos.map((produto) => (
            <ProductCard key={produto.id} produto={produto} />
          ))}
        </div>
      </section>
    </div>
  );
}

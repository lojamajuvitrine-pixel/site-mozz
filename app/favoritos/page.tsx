import ListaFavoritos from "@/components/ListaFavoritos";
import { listarProdutos } from "@/lib/produtos";

export const revalidate = 30;

export const metadata = { title: "Favoritos" };

// So' precisa do catalogo completo pronto - quem decide QUAIS aparecem e' o
// ListaFavoritos (client), cruzando com o localStorage de favoritos de quem esta' vendo.
export default async function PaginaFavoritos() {
  const produtos = await listarProdutos();

  return (
    <section className="py-8">
      <p className="font-serif text-3xl mb-6">Favoritos</p>
      <ListaFavoritos produtos={produtos} />
    </section>
  );
}

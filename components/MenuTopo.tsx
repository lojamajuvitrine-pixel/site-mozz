import Nav from "@/components/Nav";
import { listarPorGenero } from "@/lib/produtos";
import { categoriasComEstoque } from "@/lib/categorias";

// Cabecalho do site (pacote 2, 07/11/2026): calcula no servidor as categorias que tem peca em
// estoque em cada genero e entrega pro Nav montar o painel que abre ao passar o mouse em
// Feminino / Masculino. Se o catalogo falhar por algum motivo, o menu continua funcionando so'
// com as marcas (listas vazias), sem derrubar a pagina.
export default async function MenuTopo() {
  let categoriasFeminino: string[] = [];
  let categoriasMasculino: string[] = [];
  try {
    const [feminino, masculino] = await Promise.all([listarPorGenero("Feminino"), listarPorGenero("Masculino")]);
    categoriasFeminino = categoriasComEstoque(feminino);
    categoriasMasculino = categoriasComEstoque(masculino);
  } catch (erro) {
    console.error("[menu] nao consegui calcular as categorias do menu:", erro);
  }

  return <Nav categoriasFeminino={categoriasFeminino} categoriasMasculino={categoriasMasculino} />;
}

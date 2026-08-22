// Script standalone (npm run sync:bling) que puxa o catalogo do Bling e sobrescreve
// data/produtos.json - assim o site sempre builda com o catalogo mais recente sem
// precisar de banco de dados pra uma loja desse tamanho.
import { writeFileSync } from "fs";
import { listarProdutosBling } from "../lib/bling";

async function main() {
  console.log("Buscando produtos no Bling...");
  const resposta = await listarProdutosBling();
  console.log(`${resposta.data.length} produtos encontrados. TODO: mapear pro formato de data/produtos.json`);
  // TODO: mapear cada produto do Bling (nome, preco, marca/categoria, tamanhos, imagem)
  // pro formato de lib/produtos.ts::Produto, e so' entao:
  // writeFileSync("data/produtos.json", JSON.stringify(produtosMapeados, null, 2));
}

main().catch((erro) => {
  console.error(erro);
  process.exit(1);
});

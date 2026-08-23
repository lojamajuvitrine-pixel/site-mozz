// Script temporario so' pra investigar onde o Bling guarda a foto em resolucao maior.
// O endpoint de lista (/produtos) so' traz um link de foto pequena (thumbnail, ~70x70px) -
// esse script imprime o JSON completo do endpoint de DETALHE de um produto, pra gente ver
// se existe algum outro campo (ex: midia.imagens) com a foto em tamanho grande.
//
// Uso: npx tsx scripts/diagnostico-imagem.ts <id_do_produto>
// (pega um id de public/produtos/, ex: 16434105047.jpg -> id e' 16434105047)
import { config as carregarEnv } from "dotenv";
carregarEnv({ path: ".env.local" });

import { buscarProdutoDetalheBling } from "../lib/bling";

async function main() {
  const id = process.argv[2];
  if (!id) {
    console.error("Uso: npx tsx scripts/diagnostico-imagem.ts <id_do_produto>");
    process.exit(1);
  }
  const detalhe = await buscarProdutoDetalheBling(Number(id));
  console.log(JSON.stringify(detalhe, null, 2));
}

main().catch((erro) => {
  console.error(erro);
  process.exit(1);
});

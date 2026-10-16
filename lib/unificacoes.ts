// Unificacao manual de anuncios (16/10/2026, pedido do Brunno): pecas que no Bling estao em
// cadastros DIFERENTES (ex: cadastro antigo com variacoes + cadastro novo VER26 por cor), mas
// que no site devem aparecer como UM anuncio so', com todas as cores juntas. Nada muda no
// Bling - a juncao acontece so' na hora de montar o catalogo do site (ver aplicarUnificacoes
// em lib/produtos.ts). O sync continua gravando cada cadastro separado em data/produtos.json,
// e o estoque de cada um continua sendo atualizado normalmente.
//
// Como funciona:
// - "principal": o anuncio que fica no ar (nome, preco, descricao e fotos dele).
// - "absorver": os outros cadastros que somem como anuncio proprio e viram cores extras do
//   principal. So' entram as cores que tem estoque (cor esgotada do cadastro absorvido nao
//   aparece). Se a cor tiver o mesmo nome de uma cor do principal, os tamanhos se juntam.
// - "nomeCor": troca o nome da cor vinda do cadastro absorvido (ex: "Único" -> "Marrom").
// - "semFotos": ignora as fotos do cadastro absorvido (use quando as fotos dele estao erradas,
//   ex: as mesmas fotos repetidas em todas as cores). A cor aparece com o aviso "foto do
//   produto" ate' ter foto certa.
// O pedido no Bling continua saindo pro produto certo: cada cor/tamanho absorvido guarda o id
// do cadastro de origem (ver resolverProdutoIdBling em lib/produtos.ts).
export type Unificacao = {
  principal: string;
  absorver: { id: string; nomeCor?: Record<string, string>; semFotos?: boolean }[];
};

export const UNIFICACOES: Unificacao[] = [
  // T-shirt Tricot Basica Gola Alta Color (Animale) - cadastro novo VER26 (principal) + o
  // cadastro antigo com variacoes (fotos repetidas da marrom em todas as cores) + a "MARROM"
  // avulsa.
  {
    principal: "16713909215",
    absorver: [
      {
        id: "16628498405",
        semFotos: true,
        nomeCor: {
          PRETO: "Preto",
          "MARROM DRIES": "Marrom Dries",
          "LARANJA VELUDO": "Laranja Veludo",
          "BEGE SISAL": "Bege Sisal"
        }
      },
      { id: "16648766235", nomeCor: { "Único": "Marrom" } }
    ]
  }
];

// id de um cadastro absorvido -> id do anuncio principal (pra link antigo, carrinho antigo e
// anuncio que ainda aponte pro id velho continuarem funcionando).
export function idPrincipalUnificado(id: string): string | null {
  const regra = UNIFICACOES.find((u) => u.absorver.some((a) => a.id === id));
  return regra ? regra.principal : null;
}

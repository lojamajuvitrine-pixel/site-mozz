// Helpers de parsing do formato do Bling, compartilhados entre o sync completo
// (scripts/sync-bling.ts) e o sync rapido de estoque (scripts/sync-estoque.ts) - ficam aqui
// pra garantir que os dois calculam disponibilidade por tamanho exatamente da mesma forma.

export function extrairTamanho(nome: string): string | null {
  const m = nome.match(/Tamanho:\s*([^;]+)/i);
  return m ? m[1].trim() : null;
}

export function extrairCor(nome: string): string | null {
  const m = nome.match(/Cor:\s*([^;]+)/i);
  return m ? m[1].trim() : null;
}

export function limparNomeBase(nome: string): string {
  return nome
    .replace(/\s*Cor:[^;]+;?/i, "")
    .replace(/\s*Tamanho:[^;]+;?/i, "")
    .trim();
}

export type SkuComEstoque = { nome: string; estoque?: { saldoVirtualTotal: number } };

// Pra uma cor especifica de um produto, calcula quais tamanhos tem saldo em estoque AGORA,
// a partir da lista de SKUs (formato bruto do Bling, "Cor:X;Tamanho:Y" embutido no nome).
// Produto sem variacao de tamanho cadastrada (SKU unico) devolve ["Único"] quando tem saldo,
// ou [] quando esgotou.
export function tamanhosDisponiveisDaCor(cor: string, skusDoGrupo: SkuComEstoque[]): string[] {
  const skusDaCor = skusDoGrupo.filter((s) => (extrairCor(s.nome) ?? "Único") === cor);
  const temTamanhoVariado = skusDaCor.some((s) => !!extrairTamanho(s.nome));

  if (!temTamanhoVariado) {
    const disponivel = skusDaCor.some((s) => (s.estoque?.saldoVirtualTotal ?? 0) > 0);
    return disponivel ? ["Único"] : [];
  }

  return Array.from(
    new Set(
      skusDaCor
        .filter((s) => (s.estoque?.saldoVirtualTotal ?? 0) > 0)
        .map((s) => extrairTamanho(s.nome))
        .filter((t): t is string => !!t)
    )
  );
}

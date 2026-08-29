// Configuracoes gerais da loja (nao por produto) - hoje frete gratis a partir de um valor
// minimo, e a opcao de retirada na loja (com as instrucoes/endereco que aparecem pro
// cliente) - pedido do Brunno em 29/08/2026. Fica numa linha unica (id fixo = 1) na tabela
// configuracoes_loja no Supabase, editavel pelo painel /admin/produtos (ver
// components/admin/ConfiguracoesLoja.tsx) - o mesmo padrao ja usado pra preco especial/
// destaque/outlet/medidas em lib/produtoConfig.ts.
import { clientePublico } from "@/lib/supabase/publico";
import { SUPABASE_CONFIGURADO } from "@/lib/supabase/config";

export type ConfiguracaoLoja = {
  // null/0 = frete gratis desativado - abaixo disso o cliente paga o frete calculado normal.
  freteGratisAcimaDe: number | null;
  // false = a opcao "Retirar na loja" nem aparece no carrinho.
  retiradaHabilitada: boolean;
  // Texto livre (endereco, horario de funcionamento etc) mostrado pro cliente quando ele
  // escolhe retirar na loja.
  retiradaInstrucoes: string | null;
};

// Usada quando o Supabase ainda nao foi configurado, a linha nao existe por algum motivo, ou
// a leitura falha - a loja nunca pode quebrar por causa disso, so' fica sem frete gratis/
// retirada ate' o Brunno configurar (mesmo principio de buscarConfigProdutos em
// lib/produtoConfig.ts).
const CONFIGURACAO_PADRAO: ConfiguracaoLoja = {
  freteGratisAcimaDe: null,
  retiradaHabilitada: false,
  retiradaInstrucoes: null
};

type LinhaConfiguracoesLoja = {
  frete_gratis_acima_de: number | null;
  retirada_habilitada: boolean;
  retirada_instrucoes: string | null;
};

export async function buscarConfiguracaoLoja(): Promise<ConfiguracaoLoja> {
  if (!SUPABASE_CONFIGURADO) return CONFIGURACAO_PADRAO;
  try {
    const supabase = clientePublico();
    const { data, error } = await supabase
      .from("configuracoes_loja")
      .select("frete_gratis_acima_de, retirada_habilitada, retirada_instrucoes")
      .eq("id", 1)
      .maybeSingle();
    if (error || !data) return CONFIGURACAO_PADRAO;

    const linha = data as LinhaConfiguracoesLoja;
    return {
      freteGratisAcimaDe: linha.frete_gratis_acima_de !== null ? Number(linha.frete_gratis_acima_de) : null,
      retiradaHabilitada: !!linha.retirada_habilitada,
      retiradaInstrucoes: linha.retirada_instrucoes?.trim() || null
    };
  } catch {
    return CONFIGURACAO_PADRAO;
  }
}

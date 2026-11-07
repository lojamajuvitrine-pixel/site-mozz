// Gravacao do estoque ao vivo (tabela estoque_bling no Supabase - ver lib/estoqueAoVivo.ts) - 07/11/2026.
// So' roda no servidor (webhooks) e no sync do GitHub, sempre com a chave de servico: a tabela e
// as funcoes de gravacao nao aceitam escrita de visitante nenhum.
//
// Sem import com "@/..." de proposito: esse arquivo tambem e' usado pelo scripts/sync-estoque.ts,
// que roda fora do Next (GitHub Actions).
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cliente: SupabaseClient | null | undefined;

function clienteServico(): SupabaseClient | null {
  if (cliente !== undefined) return cliente;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  cliente = url && chave ? createClient(url, chave, { auth: { persistSession: false } }) : null;
  return cliente;
}

export type LinhaEstoqueSync = { id: number; id_pai: number | null; nome: string; saldo: number };

// Sync de 5 em 5 min: grava o retrato completo do Bling. "inicio" = hora em que o sync comecou a
// ler o Bling - o banco NAO passa por cima de um saldo que um aviso do Bling ou uma venda do site
// gravou depois disso (ver gravar_estoque_sync no Supabase). Nunca derruba o sync se falhar.
export async function gravarEstoqueSync(linhas: LinhaEstoqueSync[], inicio: string): Promise<void> {
  const supabase = clienteServico();
  if (!supabase) {
    console.warn("[estoque] Supabase nao configurado - estoque ao vivo nao foi atualizado nesse sync.");
    return;
  }
  try {
    const { data, error } = await supabase.rpc("gravar_estoque_sync", { p_linhas: linhas, p_inicio: inicio });
    if (error) throw error;
    console.log(`[estoque] ${data ?? linhas.length} variacao(oes) gravadas no estoque ao vivo.`);
  } catch (erro) {
    console.error("[estoque] falha ao gravar o estoque ao vivo no Supabase:", erro);
  }
}

// Aviso do Bling (app/api/bling/webhook): grava o saldo novo de uma ou mais variacoes. "data" e'
// a hora do evento no Bling - aviso atrasado (o Bling nao garante a ordem) nao passa por cima de
// um saldo mais novo. Lanca erro se o banco falhar, pra o Bling tentar de novo.
export async function gravarSaldosBling(
  saldos: { id: number; saldo: number }[],
  origem: string,
  data?: string
): Promise<void> {
  const supabase = clienteServico();
  if (!supabase) throw new Error("Supabase nao configurado (falta NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY)");
  for (const { id, saldo } of saldos) {
    const { error } = await supabase.rpc("gravar_saldo_bling", {
      p_id: id,
      p_saldo: saldo,
      p_origem: origem.slice(0, 60),
      p_data: data ?? new Date().toISOString()
    });
    if (error) throw error;
  }
}

// Venda do site aprovada (webhook do Mercado Pago): baixa as pecas na hora, sem esperar o Bling
// avisar. Nunca lanca erro - o pedido ja' foi pago, isso nao pode atrapalhar o resto.
export async function baixarEstoqueVenda(itens: { id: number; qtd: number }[]): Promise<void> {
  if (itens.length === 0) return;
  const supabase = clienteServico();
  if (!supabase) return;
  try {
    const { error } = await supabase.rpc("baixar_estoque_venda", { p_itens: itens });
    if (error) throw error;
  } catch (erro) {
    console.error("[estoque] falha ao baixar o estoque da venda do site:", erro);
  }
}

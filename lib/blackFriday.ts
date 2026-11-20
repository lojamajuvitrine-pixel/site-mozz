// Black Friday Mozz 2026 (pedido do Brunno em 20/11/2026):
// - ate' 27/11 21h: pagina /black-friday mostra contagem regressiva + cadastro;
// - 27/11 21h ate' 23h59: acesso antecipado pra quem se cadastrou (link com ?acesso=...);
// - 28/11 00h ate' 30/11 23h59: pagina aberta pra todo mundo;
// - depois disso: /black-friday manda pro /outlet.
// O preco da Black Friday de cada peca e' cadastrado em /admin/black-friday e fica na tabela
// black_friday_produtos (Supabase). Ele so' passa a valer no site inteiro (vitrine, pagina do
// produto, carrinho e cobranca) a partir do acesso antecipado - antes disso nenhum visitante ve.
// As duas tabelas nao tem policy de leitura publica: so' o servidor do site le (service role),
// pra ninguem descobrir os precos antes da hora.
import { cache } from "react";
import { createClient } from "@supabase/supabase-js";

import { BLACK_FRIDAY_ACESSO_ANTECIPADO, BLACK_FRIDAY_ABERTURA, BLACK_FRIDAY_FIM } from "./blackFridayDatas";
export { BLACK_FRIDAY_ACESSO_ANTECIPADO, BLACK_FRIDAY_ABERTURA, BLACK_FRIDAY_FIM };

// Codigo do link de acesso antecipado (vai no e-mail e na mensagem de WhatsApp). So' funciona a
// partir de 27/11 21h, entao vazar antes nao adianta nada.
export { CODIGO_ACESSO_ANTECIPADO } from "./blackFridayDatas";

// A partir de quando o botao "Enviar e-mail de acesso antecipado" funciona (meia hora antes,
// pra dar tempo de o Brunno disparar e os e-mails chegarem ate' as 21h).
export const LIBERAR_ENVIO_EMAIL_EM = "2026-11-27T20:30:00-03:00";

const ms = (iso: string) => Date.parse(iso);

export function precosBlackFridayAtivos(agora: Date = new Date()): boolean {
  const t = agora.getTime();
  return t >= ms(BLACK_FRIDAY_ACESSO_ANTECIPADO) && t <= ms(BLACK_FRIDAY_FIM);
}

export function blackFridayAberta(agora: Date = new Date()): boolean {
  const t = agora.getTime();
  return t >= ms(BLACK_FRIDAY_ABERTURA) && t <= ms(BLACK_FRIDAY_FIM);
}

export function blackFridayEncerrada(agora: Date = new Date()): boolean {
  return agora.getTime() > ms(BLACK_FRIDAY_FIM);
}

export function clienteServicoBlackFriday() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !chave) return null;
  return createClient(url, chave, { auth: { persistSession: false } });
}

// Mapa produto_id -> preco da Black Friday. Se o Supabase falhar, volta vazio (o site segue
// com os precos normais em vez de quebrar).
export async function buscarPrecosBlackFriday(): Promise<Map<string, number>> {
  const supabase = clienteServicoBlackFriday();
  if (!supabase) return new Map();
  try {
    const { data, error } = await supabase.from("black_friday_produtos").select("produto_id, preco");
    if (error || !data) return new Map();
    return new Map(data.map((linha) => [String(linha.produto_id), Number(linha.preco)]));
  } catch {
    return new Map();
  }
}

export const buscarPrecosBlackFridayCache = cache(buscarPrecosBlackFriday);

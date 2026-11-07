import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { listarSaldosEstoqueBling } from "@/lib/bling";
import { gravarSaldosBling } from "@/lib/estoqueGravacao";

// Aviso do Bling quando o estoque muda (07/11/2026, estoque ao vivo - ver lib/estoqueAoVivo.ts).
// Cadastrado no aplicativo do Bling (aba Webhooks, recurso "Estoque" - o "Estoque virtual" vem
// junto) apontando pra https://www.lojamozz.com.br/api/bling/webhook.
//
// Regras do Bling (developer.bling.com.br/webhooks):
//  - assinatura no cabecalho X-Bling-Signature-256 = "sha256=" + HMAC-SHA256 (hex) do corpo,
//    com o client secret do aplicativo (BLING_CLIENT_SECRET, o mesmo do login do Bling);
//  - precisa responder 2xx em ate' 5 segundos, senao ele tenta de novo por ate' 3 dias - e se
//    continuar falhando, DESLIGA o webhook sozinho. Por isso aviso sem assinatura valida volta
//    200 (e nao e' processado): uma falha de configuracao nao desliga o webhook pra sempre, e o
//    log mostra o problema;
//  - nao garante a ordem dos avisos (ver gravar_saldo_bling no Supabase, que usa a data do evento).
export const dynamic = "force-dynamic";

type CorpoBling = {
  event?: string;
  date?: string;
  data?: {
    produto?: { id?: number | string };
    saldoVirtualTotal?: number | string;
  };
};

function assinaturaValida(corpoBruto: string, cabecalho: string | null): boolean {
  const segredo = process.env.BLING_CLIENT_SECRET;
  if (!segredo || !cabecalho) return false;
  const recebida = cabecalho.trim().replace(/^sha256=/i, "").toLowerCase();
  const calculada = createHmac("sha256", segredo).update(corpoBruto, "utf8").digest("hex");
  const a = Buffer.from(calculada);
  const b = Buffer.from(recebida);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  const corpoBruto = await request.text();

  if (!assinaturaValida(corpoBruto, request.headers.get("x-bling-signature-256"))) {
    console.error("[bling-webhook] aviso com assinatura invalida - ignorado (confira BLING_CLIENT_SECRET na Vercel)");
    return NextResponse.json({ recebido: true, ignorado: "assinatura" });
  }

  let corpo: CorpoBling;
  try {
    corpo = JSON.parse(corpoBruto) as CorpoBling;
  } catch {
    return NextResponse.json({ recebido: true, ignorado: "corpo" });
  }

  const evento = String(corpo.event ?? "");
  const recurso = evento.split(".")[0];
  if (recurso !== "stock" && recurso !== "virtual_stock") {
    return NextResponse.json({ recebido: true, ignorado: evento || "sem evento" });
  }

  const idProduto = Number(corpo.data?.produto?.id);
  if (!Number.isFinite(idProduto) || idProduto <= 0) {
    console.warn(`[bling-webhook] ${evento} sem id de produto - ignorado (o sync de 5 em 5 min corrige)`);
    return NextResponse.json({ recebido: true, ignorado: "sem produto" });
  }

  try {
    // Usa o saldo que veio no proprio aviso (mais rapido, sem chamar o Bling); se nao veio,
    // pergunta o saldo de agora pra API do Bling.
    const saldoNoAviso = Number(corpo.data?.saldoVirtualTotal);
    if (corpo.data?.saldoVirtualTotal !== undefined && Number.isFinite(saldoNoAviso)) {
      await gravarSaldosBling([{ id: idProduto, saldo: saldoNoAviso }], `bling:${evento}`, corpo.date);
      console.log(`[bling-webhook] ${evento} produto ${idProduto}: saldo ${saldoNoAviso}`);
    } else {
      const resposta = await listarSaldosEstoqueBling([idProduto]);
      const linhas = (resposta.data ?? []) as { produto?: { id?: number | string }; saldoVirtualTotal?: number }[];
      const saldos = linhas
        .filter((l) => Number(l.produto?.id) > 0 && Number.isFinite(Number(l.saldoVirtualTotal)))
        .map((l) => ({ id: Number(l.produto!.id), saldo: Number(l.saldoVirtualTotal) }));
      await gravarSaldosBling(saldos, `bling:${evento}`);
      console.log(`[bling-webhook] ${evento} produto ${idProduto}: saldo ${saldos.map((s) => s.saldo).join(",") || "nao informado"} (consultado na API)`);
    }
  } catch (erro) {
    console.error(`[bling-webhook] erro ao atualizar o saldo do produto ${idProduto}:`, erro);
    // erro de verdade (Supabase/Bling fora do ar): 500 pra o Bling tentar de novo mais tarde
    return NextResponse.json({ erro: "falha temporaria" }, { status: 500 });
  }

  return NextResponse.json({ recebido: true });
}

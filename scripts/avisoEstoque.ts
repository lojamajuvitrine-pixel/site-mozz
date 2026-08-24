// Dispara os e-mails de "voltou ao estoque" (ver components/AvisoEstoque.tsx, onde a
// cliente deixa o e-mail, e app/api/avisos-estoque/route.ts, onde isso e' salvo). So' chamado
// pelo scripts/sync-estoque.ts, depois de recalcular disponibilidade - nunca roda em nada que
// o navegador carrega.
//
// Usa a chave SERVICE ROLE do Supabase (bypassa RLS de proposito - e' o UNICO lugar do
// projeto que le e marca como notificado essa tabela, que guarda e-mail de cliente). Nunca
// deve ir pro NEXT_PUBLIC_*, nem aparecer em nenhum arquivo que o navegador baixa.
import { createClient } from "@supabase/supabase-js";
import type { Produto } from "../lib/produtos";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const REMETENTE = "MOZZ <avisos@notificacoes.lojamozz.com.br>";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://lojamozz.com.br";

type AvisoRow = { id: string; produto_id: string; tamanho: string; email: string };

async function enviarEmail(email: string, produto: Produto, tamanho: string) {
  const link = `${SITE_URL}/produto/${produto.id}`;
  const resposta = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: REMETENTE,
      to: [email],
      subject: `${produto.nome} - tamanho ${tamanho} voltou ao estoque!`,
      html: `
        <p>Boas notícias! O tamanho <strong>${tamanho}</strong> de <strong>${produto.nome}</strong> voltou a ter estoque na MOZZ.</p>
        <p><a href="${link}">Ver a peça no site</a></p>
        <p style="color:#8a8a86;font-size:12.5px;margin-top:24px;">Você recebeu esse e-mail porque pediu pra ser avisado(a) quando esse tamanho voltasse.</p>
      `
    })
  });
  if (!resposta.ok) {
    throw new Error(`Resend falhou (${resposta.status}): ${await resposta.text()}`);
  }
}

// novosDisponiveis: produtoId -> conjunto de tamanhos que ACABARAM de ficar disponiveis
// nesse sync (comparado com o estado anterior salvo em data/produtos.json).
export async function notificarAvisosDeEstoque(
  novosDisponiveis: Map<string, Set<string>>,
  produtos: Produto[]
) {
  if (novosDisponiveis.size === 0) return;

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !RESEND_API_KEY) {
    console.log(
      "Aviso de estoque: SUPABASE_SERVICE_ROLE_KEY e/ou RESEND_API_KEY não configurados ainda - pulando envio de e-mail (ver PROXIMOS_PASSOS.md)."
    );
    return;
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const produtosPorId = new Map(produtos.map((p) => [p.id, p]));

  const { data: pendentes, error } = await supabase
    .from("avisos_estoque")
    .select("id, produto_id, tamanho, email")
    .eq("notificado", false)
    .in("produto_id", Array.from(novosDisponiveis.keys()));

  if (error) {
    console.error("Aviso de estoque: falha ao buscar pendentes no Supabase:", error.message);
    return;
  }
  if (!pendentes || pendentes.length === 0) return;

  let enviados = 0;
  for (const linha of pendentes as AvisoRow[]) {
    const tamanhosNovos = novosDisponiveis.get(linha.produto_id);
    if (!tamanhosNovos || !tamanhosNovos.has(linha.tamanho)) continue;

    const produto = produtosPorId.get(linha.produto_id);
    if (!produto) continue;

    try {
      await enviarEmail(linha.email, produto, linha.tamanho);
      await supabase
        .from("avisos_estoque")
        .update({ notificado: true, notificado_em: new Date().toISOString() })
        .eq("id", linha.id);
      enviados++;
    } catch (erro) {
      console.error(`Aviso de estoque: falha ao notificar ${linha.email} (produto ${linha.produto_id}):`, erro);
    }
  }

  if (enviados > 0) console.log(`Aviso de estoque: ${enviados} e-mail(s) de "voltou ao estoque" enviado(s).`);
}

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { hostMelhorEnvio } from "@/lib/frete";
import { CALLBACK_URL } from "@/lib/melhorEnvio";

export const dynamic = "force-dynamic";

// Fluxo de autorizacao OAuth do Melhor Envio - mesmo padrao ja usado pro Bling (ver
// app/api/bling/callback), so' que aqui SO EXISTE esse endpoint (nao tem uma rota separada
// que "inicia" a autorizacao) - o link de autorizacao e' montado na mao (ver instrucoes no
// chat com o Brunno em 31/08/2026) porque essa parte, diferente do resto, nao depende de
// nenhum dado que so' o servidor tem.
//
// IMPORTANTE (31/08/2026): a documentacao oficial do Melhor Envio nao publica o endpoint de
// troca de token de forma clara - o endpoint e o formato do corpo abaixo (POST /oauth/token
// com grant_type/client_id/client_secret/redirect_uri/code em JSON) vem confirmado pela
// pagina de referencia "Solicitacao do token" deles, mas nunca foi testado ao vivo (sem
// sandbox, por pedido do Brunno) - se der erro na primeira tentativa, a mensagem de erro
// abaixo mostra a resposta crua que o Melhor Envio devolveu, pra dar pra ajustar rapido.
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const erroMelhorEnvio = request.nextUrl.searchParams.get("error");

  if (erroMelhorEnvio) {
    return new NextResponse(paginaHtml(`Melhor Envio recusou a autorização: ${erroMelhorEnvio}`), {
      status: 400,
      headers: { "Content-Type": "text/html; charset=utf-8" }
    });
  }

  if (!code) {
    return new NextResponse(paginaHtml("Faltou o parâmetro 'code' na URL."), {
      status: 400,
      headers: { "Content-Type": "text/html; charset=utf-8" }
    });
  }

  const clientId = process.env.MELHOR_ENVIO_CLIENT_ID;
  const clientSecret = process.env.MELHOR_ENVIO_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return new NextResponse(
      paginaHtml("MELHOR_ENVIO_CLIENT_ID e/ou MELHOR_ENVIO_CLIENT_SECRET não estão configurados na Vercel."),
      { status: 500, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  const resposta = await fetch(`${hostMelhorEnvio("auth")}/oauth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "User-Agent": "MOZZ Ecommerce (loja.majuvitrine@gmail.com)"
    },
    body: JSON.stringify({
      grant_type: "authorization_code",
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: CALLBACK_URL,
      code
    })
  });

  const dados = await resposta.json().catch(() => null);

  if (!resposta.ok || !dados?.access_token || !dados?.refresh_token) {
    return new NextResponse(
      paginaHtml(
        `Erro ao trocar o code pelos tokens (status ${resposta.status}): <pre>${JSON.stringify(dados, null, 2)}</pre>`
      ),
      { status: 500, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseServiceKey) {
    return new NextResponse(
      paginaHtml(
        "Token recebido do Melhor Envio, mas NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não estão configurados na Vercel."
      ),
      { status: 500, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const expiraEm = new Date(Date.now() + (Number(dados.expires_in ?? 2592000) - 300) * 1000).toISOString();

  const { error: erroSupabase } = await supabase.from("melhor_envio_oauth_token").upsert({
    id: 1,
    access_token: dados.access_token,
    refresh_token: dados.refresh_token,
    expira_em: expiraEm,
    atualizado_em: new Date().toISOString()
  });

  if (erroSupabase) {
    return new NextResponse(
      paginaHtml(`Token recebido do Melhor Envio, mas houve erro ao salvar no Supabase: ${erroSupabase.message}`),
      { status: 500, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  return new NextResponse(
    paginaHtml("Autorização concluída! O token do Melhor Envio foi salvo automaticamente. Pode fechar esta aba."),
    { headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

function paginaHtml(mensagem: string) {
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>Melhor Envio - autorização</title>
<style>
body {
  font-family: sans-serif;
  max-width: 640px;
  margin: 60px auto;
  padding: 0 20px;
  color: #111;
}
pre { white-space: pre-wrap; background: #f4f4f4; padding: 12px; border-radius: 4px; }
</style>
</head>
<body>
<h2>Site Mozz - Melhor Envio</h2>
<p>${mensagem}</p>
</body>
</html>`;
}

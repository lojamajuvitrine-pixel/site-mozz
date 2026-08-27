import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const erroBling = request.nextUrl.searchParams.get("error");

  if (erroBling) {
    return new NextResponse(
      paginaHtml(`Bling recusou a autorizacao: ${erroBling}`),
      {
        status: 400,
        headers: { "Content-Type": "text/html; charset=utf-8" }
      }
    );
  }

  if (!code) {
    return new NextResponse(
      paginaHtml("Faltou o parametro 'code' na URL."),
      {
        status: 400,
        headers: { "Content-Type": "text/html; charset=utf-8" }
      }
    );
  }

  const clientId = process.env.BLING_CLIENT_ID;
  const clientSecret = process.env.BLING_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return new NextResponse(
      paginaHtml(
        "BLING_CLIENT_ID e/ou BLING_CLIENT_SECRET nao estao configurados na Vercel."
      ),
      {
        status: 500,
        headers: { "Content-Type": "text/html; charset=utf-8" }
      }
    );
  }

  const basicAuth = Buffer.from(
    `${clientId}:${clientSecret}`
  ).toString("base64");

  // Troca o authorization code pelos tokens do Bling
  const resposta = await fetch(
    "https://api.bling.com.br/Api/v3/oauth/token",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${basicAuth}`,
        "enable-jwt": "1"
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code
      }),
      cache: "no-store"
    }
  );

  const dados = await resposta.json();

  if (!resposta.ok) {
    return new NextResponse(
      paginaHtml(
        `Erro ao trocar o code pelos tokens: ${JSON.stringify(dados)}`
      ),
      {
        status: 500,
        headers: { "Content-Type": "text/html; charset=utf-8" }
      }
    );
  }

  if (!dados.refresh_token) {
    return new NextResponse(
      paginaHtml("O Bling nao retornou um refresh_token."),
      {
        status: 500,
        headers: { "Content-Type": "text/html; charset=utf-8" }
      }
    );
  }

  // Salva automaticamente o refresh token no Supabase
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return new NextResponse(
      paginaHtml(
        "Token recebido do Bling, mas NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY nao estao configurados na Vercel."
      ),
      {
        status: 500,
        headers: { "Content-Type": "text/html; charset=utf-8" }
      }
    );
  }

  const supabase = createClient(
    supabaseUrl,
    supabaseServiceKey
  );

  const { error: erroSupabase } = await supabase
    .from("bling_oauth_token")
    .upsert({
      id: 1,
      refresh_token: dados.refresh_token,
      atualizado_em: new Date().toISOString()
    });

  if (erroSupabase) {
    return new NextResponse(
      paginaHtml(
        `Token recebido do Bling, mas houve erro ao salvar no Supabase: ${erroSupabase.message}`
      ),
      {
        status: 500,
        headers: { "Content-Type": "text/html; charset=utf-8" }
      }
    );
  }

  return new NextResponse(
    paginaHtml(
      "Autorizacao concluida! O novo refresh_token foi salvo automaticamente no Supabase. Voce ja pode executar a sincronizacao do Bling."
    ),
    {
      headers: { "Content-Type": "text/html; charset=utf-8" }
    }
  );
}

function paginaHtml(mensagem: string) {
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>Bling - autorizacao</title>
<style>
body {
  font-family: sans-serif;
  max-width: 640px;
  margin: 60px auto;
  padding: 0 20px;
  color: #111;
}
</style>
</head>
<body>
<h2>Site Mozz - Bling</h2>
<p>${mensagem}</p>
</body>
</html>`;
}

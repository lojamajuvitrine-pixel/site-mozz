import { NextRequest, NextResponse } from "next/server";

// Rota de callback do fluxo OAuth2 do Bling. So' precisa ser acessada UMA vez, manualmente,
// pra gerar o primeiro refresh_token (ver PROXIMOS_PASSOS.md, secao 2). Depois de gerado o
// refresh_token e salvo como variavel de ambiente, essa rota nao e' mais necessaria no dia a dia
// - lib/bling.ts usa o refresh_token pra sempre pedir novos access_token sozinho.
//
// Fluxo: Bling redireciona pra ca com ?code=... depois que o Brunno autoriza o app. Aqui a
// gente troca esse code pelo access_token/refresh_token (POST /Api/v3/oauth/token, client_id
// + client_secret no header Basic) e mostra o refresh_token na tela pra ele copiar.
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const erroBling = request.nextUrl.searchParams.get("error");

  if (erroBling) {
    return new NextResponse(paginaHtml(`Bling recusou a autorizacao: ${erroBling}`), {
      status: 400,
      headers: { "Content-Type": "text/html; charset=utf-8" }
    });
  }

  if (!code) {
    return new NextResponse(paginaHtml("Faltou o parametro 'code' na URL."), {
      status: 400,
      headers: { "Content-Type": "text/html; charset=utf-8" }
    });
  }

  const clientId = process.env.BLING_CLIENT_ID;
  const clientSecret = process.env.BLING_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return new NextResponse(
      paginaHtml(
        "BLING_CLIENT_ID e/ou BLING_CLIENT_SECRET nao estao configurados nas variaveis de ambiente da Vercel. Adicione os dois, faca o redeploy, e tente autorizar de novo."
      ),
      { status: 500, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const resposta = await fetch("https://api.bling.com.br/Api/v3/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basicAuth}`
    },
    body: new URLSearchParams({ grant_type: "authorization_code", code })
  });

  const dados = await resposta.json();

  if (!resposta.ok) {
    return new NextResponse(paginaHtml(`Erro ao trocar o code pelos tokens: ${JSON.stringify(dados)}`), {
      status: 500,
      headers: { "Content-Type": "text/html; charset=utf-8" }
    });
  }

  return new NextResponse(
    paginaHtml(
      `Autorizacao concluida! Copie o valor abaixo e salve como BLING_REFRESH_TOKEN nas variaveis de ambiente da Vercel (Project Settings -> Environment Variables), depois faca o redeploy.`,
      dados.refresh_token
    ),
    { headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

function paginaHtml(mensagem: string, refreshToken?: string) {
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><title>Bling - autorizacao</title>
<style>body{font-family:sans-serif;max-width:640px;margin:60px auto;padding:0 20px;color:#111}
textarea{width:100%;height:80px;font-family:monospace;font-size:13px;padding:10px}</style>
</head><body>
<p>${mensagem}</p>
${refreshToken ? `<textarea readonly onclick="this.select()">${refreshToken}</textarea>` : ""}
</body></html>`;
}

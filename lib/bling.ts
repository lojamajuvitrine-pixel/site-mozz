// Cliente da API v3 do Bling (https://developer.bling.com.br/bling-api).
// Autenticacao OAuth2: o app e' cadastrado uma vez em developer.bling.com.br/aplicativos,
// o que gera client_id/client_secret. O usuario autoriza o app (fluxo "authorization code")
// uma unica vez, o que gera um refresh_token de longa duracao - e' esse refresh_token que
// fica guardado em BLING_REFRESH_TOKEN e usado aqui pra pedir novos access_token (que expiram
// rapido, tipicamente 6h) sem precisar o usuario logar de novo.
//
// Passo a passo de como gerar o primeiro refresh_token esta' em PROXIMOS_PASSOS.md.

import * as fs from "fs";
import * as path from "path";
import { createClient } from "@supabase/supabase-js";

const BLING_HOST = "https://api.bling.com.br/Api/v3";
const BLING_OAUTH_TOKEN_URL = "https://api.bling.com.br/Api/v3/oauth/token";

type BlingTokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
};

let cachedAccessToken: { token: string; expiraEm: number } | null = null;

// O Bling invalida o refresh_token antigo e devolve um NOVO a cada troca (rotacao de refresh
// token) - usar o valor antigo de novo depois disso da' "Invalid refresh token". Quando rodando
// localmente (scripts/sync-bling.ts via tsx), a gente atualiza o .env.local sozinho pra nao
// depender de copiar/colar toda vez. Em producao na Vercel isso nao persiste entre chamadas
// (sistema de arquivos efemero/somente leitura) - por isso o uso do Bling la' fica limitado
// a testes pontuais; o fluxo principal e' rodar o sync localmente.
function atualizarRefreshTokenLocal(novoToken: string) {
  try {
    const caminho = path.join(process.cwd(), ".env.local");
    if (!fs.existsSync(caminho)) return;
    const conteudo = fs.readFileSync(caminho, "utf-8");
    const jaTem = /^BLING_REFRESH_TOKEN=.*$/m.test(conteudo);
    const atualizado = jaTem
      ? conteudo.replace(
          /^BLING_REFRESH_TOKEN=.*$/m,
          `BLING_REFRESH_TOKEN=${novoToken}`,
        )
      : `${conteudo.trimEnd()}\nBLING_REFRESH_TOKEN=${novoToken}\n`;
    fs.writeFileSync(caminho, atualizado);
    console.log(
      "[bling] .env.local atualizado automaticamente com o novo refresh_token.",
    );
  } catch {
    // sistema de arquivos somente leitura (ex: Vercel em producao) - inofensivo, so' ignora
  }
}

// Fonte compartilhada do refresh_token entre os DOIS processos que usam o Bling: o webhook do
// Mercado Pago (roda na Vercel, sempre que um pagamento e' aprovado) e o sync automatico de
// estoque (roda no GitHub Actions, a cada 5min em horario comercial). Como o Bling ROTACIONA o
// refresh_token a cada uso (o antigo vira invalido na hora), esses dois processos brigavam pelo
// mesmo valor estatico guardado em dois lugares diferentes (variavel de ambiente da Vercel vs
// secret do GitHub) - qualquer um dos dois que usasse primeiro invalidava a copia do outro,
// causando "Invalid refresh token" aleatoriamente (foi o que quebrou o pedido de venda da
// primeira compra real, em 25/08/2026). A tabela bling_oauth_token no Supabase agora e' a UNICA
// fonte de verdade: os dois processos leem de la' antes de renovar e escrevem de volta depois -
// a variavel de ambiente BLING_REFRESH_TOKEN vira so' uma semente inicial/fallback pro caso do
// Supabase estar fora do ar. Ainda existe uma janela pequena de corrida se os dois renovarem ao
// mesmo tempo exato, mas o webhook do Mercado Pago se auto-recupera nesse caso (devolve 500,
// o Mercado Pago tenta de novo minutos depois, e a essa altura o token no Supabase ja' esta'
// atualizado).
function obterClienteSupabaseServico() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !chave) return null;
  return createClient(url, chave);
}

// Log leve e permanente (nunca a chave nem o token inteiro, so' os ultimos 6 caracteres, que
// ja trocam a cada uso) - descobriu, em 28/08/2026, que o sync-bling-completo.yml rodava sem
// NEXT_PUBLIC_SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY no ambiente (secret cadastrada no GitHub
// mas nunca referenciada no bloco env: do workflow) e caia silenciosamente no fallback antigo
// da env var BLING_REFRESH_TOKEN sem ninguem perceber. Vale manter pra pegar isso na hora, em
// vez de descobrir depois de varias falhas.
async function lerRefreshTokenCompartilhado(): Promise<string | null> {
  const supabase = obterClienteSupabaseServico();
  if (!supabase) {
    console.warn(
      "[bling] Supabase nao configurado nesse ambiente (falta NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY) - usando o fallback da env var BLING_REFRESH_TOKEN.",
    );
    return null;
  }
  try {
    const { data, error } = await supabase
      .from("bling_oauth_token")
      .select("refresh_token")
      .eq("id", 1)
      .maybeSingle();
    if (error) {
      console.warn(
        `[bling] Supabase respondeu com erro ao ler o token: ${error.message} (code: ${error.code ?? "?"})`,
      );
      return null;
    }
    if (!data?.refresh_token) {
      console.warn(
        "[bling] Supabase respondeu OK mas sem nenhuma linha/refresh_token (tabela vazia?) - usando o fallback da env var.",
      );
      return null;
    }
    return data.refresh_token;
  } catch (erro) {
    console.warn(
      "[bling] Excecao ao tentar ler o Supabase (rede/config?):",
      erro,
    );
    return null; // Supabase fora do ar/tabela ainda nao existe - cai pro fallback da env var
  }
}

// Tenta salvar ate' 3x (com um pequeno intervalo) antes de desistir. Esse valor e' o ULTIMO
// refresh_token valido que a gente tem - se essa gravacao falhar silenciosamente (like antes),
// o Bling ja' invalidou o token antigo mas ninguem mais tem o novo em lugar nenhum, e a unica
// saida vira uma reautorizacao manual (foi exatamente isso que aconteceu em 28/08/2026). Um
// blip transitorio do Supabase nao pode custar isso.
async function salvarRefreshTokenCompartilhado(novoToken: string) {
  const supabase = obterClienteSupabaseServico();
  if (!supabase) return;

  const tentativas = 3;
  for (let tentativa = 1; tentativa <= tentativas; tentativa++) {
    try {
      const { error } = await supabase
        .from("bling_oauth_token")
        .upsert({
          id: 1,
          refresh_token: novoToken,
          atualizado_em: new Date().toISOString(),
        });
      if (!error) return; // sucesso
      throw error;
    } catch (erro) {
      if (tentativa === tentativas) {
        // esgotou as tentativas - loga ALTO (nao so' warn) porque a partir daqui o token novo
        // so' existe na memoria desse processo, e some quando ele terminar.
        console.error(
          `[bling] FALHA ao salvar refresh_token compartilhado no Supabase apos ${tentativas} tentativas - ` +
            `o token novo pode se perder. Erro:`,
          erro,
        );
        return;
      }
      console.warn(
        `[bling] tentativa ${tentativa}/${tentativas} de salvar refresh_token falhou, tentando de novo:`,
        erro,
      );
      await aguardar(500 * tentativa);
    }
  }
}

function aguardar(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Troca um refresh_token pelos tokens novos. Isolado numa funcao a parte pra poder ser chamado
// de novo (com um refresh_token diferente) no retry de corrida logo abaixo, sem duplicar a
// chamada HTTP. Guarda o status HTTP no erro pra quem chama saber se vale tentar de novo.
async function trocarRefreshTokenPorTokens(
  refreshToken: string,
): Promise<BlingTokenResponse> {
  const clientId = process.env.BLING_CLIENT_ID;
  const clientSecret = process.env.BLING_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      "Credenciais do Bling ausentes. Configure BLING_CLIENT_ID e BLING_CLIENT_SECRET no .env.",
    );
  }

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString(
    "base64",
  );

  const resposta = await fetch(BLING_OAUTH_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basicAuth}`,
      "enable-jwt": "1",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!resposta.ok) {
    const texto = await resposta.text();
    const erro = new Error(
      `Falha ao renovar token do Bling (${resposta.status}): ${texto}`,
    ) as Error & {
      status?: number;
    };
    erro.status = resposta.status;
    throw erro;
  }

  return (await resposta.json()) as BlingTokenResponse;
}

async function obterAccessToken(): Promise<string> {
  if (cachedAccessToken && cachedAccessToken.expiraEm > Date.now()) {
    return cachedAccessToken.token;
  }

  // Supabase primeiro (fonte compartilhada e sempre mais recente) - so' cai pra variavel de
  // ambiente se o Supabase nao estiver configurado ou a tabela ainda nao tiver linha nenhuma.
  const doSupabase = await lerRefreshTokenCompartilhado();
  const refreshTokenInicial = doSupabase ?? process.env.BLING_REFRESH_TOKEN;
  if (!refreshTokenInicial) {
    throw new Error(
      "Credenciais do Bling ausentes. Nenhum refresh_token disponivel (Supabase nem BLING_REFRESH_TOKEN).",
    );
  }
  if (!doSupabase) {
    console.warn(
      "[bling] Usando o fallback da env var BLING_REFRESH_TOKEN, nao o Supabase - ver aviso acima.",
    );
  }

  let refreshTokenUsado = refreshTokenInicial;
  let dados: BlingTokenResponse;
  try {
    dados = await trocarRefreshTokenPorTokens(refreshTokenUsado);
  } catch (erroOriginal) {
    // 400 (invalid_grant) nesse ponto costuma ser CORRIDA, nao token morto de verdade: outro
    // processo (webhook do Mercado Pago, o sync de 5 em 5 min, uma execucao manual) rotacionou
    // esse MESMO refresh_token um instante antes (o Bling so' aceita cada refresh_token UMA vez
    // - ver comentario grande acima de lerRefreshTokenCompartilhado). Em vez de falhar na hora,
    // espera um pouco (tempo do outro processo terminar de salvar o token novo no Supabase) e
    // busca de novo - se mudou, tenta com o valor atualizado antes de desistir de verdade.
    const status = (erroOriginal as { status?: number })?.status;
    if (status !== 400) throw erroOriginal;

    await aguardar(2500);
    const refreshTokenAtualizado = await lerRefreshTokenCompartilhado();
    if (
      !refreshTokenAtualizado ||
      refreshTokenAtualizado === refreshTokenUsado
    ) {
      throw erroOriginal; // Supabase nao mudou - nao era corrida, o token esta' morto mesmo
    }

    refreshTokenUsado = refreshTokenAtualizado;
    dados = await trocarRefreshTokenPorTokens(refreshTokenUsado); // se falhar aqui, propaga normalmente
  }

  cachedAccessToken = {
    token: dados.access_token,
    // renova um pouco antes de expirar de verdade, pra nao correr risco de token vencido
    expiraEm: Date.now() + (dados.expires_in - 60) * 1000,
  };

  if (dados.refresh_token && dados.refresh_token !== refreshTokenUsado) {
    process.env.BLING_REFRESH_TOKEN = dados.refresh_token; // vale pro resto

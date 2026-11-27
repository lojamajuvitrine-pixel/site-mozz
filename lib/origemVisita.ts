// 27/11/2026 (Brunno): guardar de onde a cliente chegou (anuncio, grupo, Instagram...) para
// salvar junto com o pedido. Roda so' no navegador. Regra: um link com etiqueta (origem=, utm_,
// gclid, fbclid) sempre substitui a origem guardada; sem etiqueta, o "de onde veio" do navegador
// (referrer) so' e' usado quando ainda nao ha nada guardado. Vale 30 dias.

const CHAVE = "mozz_origem";
const VALIDADE_MS = 30 * 24 * 60 * 60 * 1000;

function limpar(valor: string): string {
  return valor.toLowerCase().replace(/[^a-z0-9_\-./]/g, "").slice(0, 60);
}

function origemDaUrl(params: URLSearchParams): string | null {
  const origem = params.get("origem");
  if (origem) return limpar(origem);
  const fonte = params.get("utm_source");
  if (fonte) {
    const meio = params.get("utm_medium");
    return limpar(meio ? `${fonte}/${meio}` : fonte);
  }
  if (params.get("gclid") || params.get("gbraid") || params.get("wbraid")) return "google-ads";
  if (params.get("fbclid")) return "meta";
  return null;
}

function origemDoReferrer(referrer: string): string | null {
  if (!referrer) return null;
  let host = "";
  try {
    host = new URL(referrer).hostname.toLowerCase();
  } catch {
    return null;
  }
  if (!host || host.endsWith("lojamozz.com.br") || host.includes("mercadopago")) return null;
  if (host.includes("instagram")) return "instagram";
  if (host.includes("facebook") || host === "fb.com") return "facebook";
  if (host.includes("whatsapp") || host === "wa.me") return "whatsapp";
  if (host.includes("google")) return "google-organico";
  return limpar(`site/${host.replace(/^www\./, "")}`);
}

export function registrarOrigemVisita(): void {
  try {
    const daUrl = origemDaUrl(new URLSearchParams(window.location.search));
    const guardada = lerOrigemVisita();
    const nova = daUrl ?? (guardada ? null : origemDoReferrer(document.referrer));
    if (nova) localStorage.setItem(CHAVE, JSON.stringify({ o: nova, t: Date.now() }));
  } catch {
    /* navegador sem localStorage: segue sem origem */
  }
}

export function lerOrigemVisita(): string | undefined {
  try {
    const bruto = localStorage.getItem(CHAVE);
    if (!bruto) return undefined;
    const { o, t } = JSON.parse(bruto) as { o?: string; t?: number };
    if (!o || !t || Date.now() - t > VALIDADE_MS) return undefined;
    return o;
  } catch {
    return undefined;
  }
}

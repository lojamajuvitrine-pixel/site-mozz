import { cookies } from "next/headers";
import { CODIGO_ACESSO_ANTECIPADO, COOKIE_ACESSO_VIP } from "./blackFridayDatas";

// So' no servidor, dentro de uma requisicao (rota de API ou pagina dinamica): diz se este
// visitante abriu o link de acesso antecipado da Black Friday (cookie gravado pelo middleware).
export function temAcessoVipBlackFriday(): boolean {
  try {
    return cookies().get(COOKIE_ACESSO_VIP)?.value === CODIGO_ACESSO_ANTECIPADO;
  } catch {
    return false;
  }
}

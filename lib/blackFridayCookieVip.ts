import type { NextResponse } from "next/server";
import {
  BLACK_FRIDAY_ACESSO_ANTECIPADO,
  BLACK_FRIDAY_FIM,
  CODIGO_ACESSO_ANTECIPADO,
  COOKIE_ACESSO_VIP
} from "./blackFridayDatas";

// 26/11/2026 (Brunno): acesso antecipado tambem pelo e-mail cadastrado. Janela em que o cookie
// VIP pode ser gravado: do acesso antecipado (26/11 21h) ate' o fim da Black.
export function janelaAcessoAntecipadoAberta(agora: number = Date.now()): boolean {
  return agora >= Date.parse(BLACK_FRIDAY_ACESSO_ANTECIPADO) && agora <= Date.parse(BLACK_FRIDAY_FIM);
}

export function gravarCookieVip(resposta: NextResponse): NextResponse {
  resposta.cookies.set(COOKIE_ACESSO_VIP, CODIGO_ACESSO_ANTECIPADO, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    expires: new Date(Date.parse(BLACK_FRIDAY_FIM))
  });
  return resposta;
}

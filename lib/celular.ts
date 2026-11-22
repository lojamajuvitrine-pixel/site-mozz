// Validacao de celular brasileiro (22/11/2026, Brunno): so' aceita DDD que existe + 9 digitos
// comecando com 9. Usado no formulario da Black Friday (cliente) e na rota de cadastro (servidor).

const DDDS_VALIDOS = new Set([
  11, 12, 13, 14, 15, 16, 17, 18, 19,
  21, 22, 24, 27, 28,
  31, 32, 33, 34, 35, 37, 38,
  41, 42, 43, 44, 45, 46, 47, 48, 49,
  51, 53, 54, 55,
  61, 62, 63, 64, 65, 66, 67, 68, 69,
  71, 73, 74, 75, 77, 79,
  81, 82, 83, 84, 85, 86, 87, 88, 89,
  91, 92, 93, 94, 95, 96, 97, 98, 99
]);

export const MENSAGEM_CELULAR_INVALIDO = "Confira seu WhatsApp: use DDD + número, ex.: (42) 99999-9999";

// Tira tudo que nao e' digito e o +55 da frente, se vier.
export function normalizarCelular(valor: string): string {
  let digitos = valor.replace(/\D/g, "");
  if (digitos.startsWith("55") && digitos.length >= 12) digitos = digitos.slice(2);
  return digitos;
}

export function celularValido(valor: string): boolean {
  const digitos = normalizarCelular(valor);
  if (digitos.length !== 11) return false;
  if (!DDDS_VALIDOS.has(Number(digitos.slice(0, 2)))) return false;
  return digitos[2] === "9";
}

// Mascara enquanto digita: (42) 99999-9999
export function mascararCelular(valor: string): string {
  let d = valor.replace(/\D/g, "");
  if (d.startsWith("55") && d.length >= 12) d = d.slice(2); // colou com +55
  d = d.slice(0, 11);
  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

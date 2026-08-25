// Validacao de CPF (algoritmo padrao dos 2 digitos verificadores) - usado no formulario de
// identificacao do carrinho (components/FormularioCliente.tsx) e revalidado no servidor
// (app/api/mercadopago/criar-preferencia) antes de criar a preferencia de pagamento, ja que
// esse CPF vira o numeroDocumento do pedido de venda no Bling (nota fiscal).
export function validarCpf(cpfComPontuacao: string): boolean {
  const cpf = cpfComPontuacao.replace(/\D/g, "");
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false; // todos os digitos iguais (ex: 111.111.111-11)

  function digitoVerificador(base: string, pesoInicial: number): number {
    const soma = base
      .split("")
      .reduce((total, digito, indice) => total + Number(digito) * (pesoInicial - indice), 0);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  }

  const digito1 = digitoVerificador(cpf.slice(0, 9), 10);
  const digito2 = digitoVerificador(cpf.slice(0, 10), 11);
  return digito1 === Number(cpf[9]) && digito2 === Number(cpf[10]);
}

export function formatarCpf(cpf: string): string {
  const limpo = cpf.replace(/\D/g, "").slice(0, 11);
  return limpo
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

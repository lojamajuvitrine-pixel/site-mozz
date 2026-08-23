// Formatacao e validacao de campos brasileiros (CPF, telefone) usados no formulario de
// perfil do cliente (components/PerfilForm.tsx) - sem depender de nenhuma lib externa, e'
// pouca coisa e bem conhecida.

export function apenasDigitos(valor: string): string {
  return valor.replace(/\D/g, "");
}

export function formatarCPF(valor: string): string {
  const d = apenasDigitos(valor).slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

// Algoritmo padrao de validacao de CPF (dois digitos verificadores) - pega erro de
// digitacao na hora, em vez de descobrir so' quando for emitir a nota fiscal do pedido.
export function validarCPF(valor: string): boolean {
  const cpf = apenasDigitos(valor);
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false; // todos os digitos iguais (ex: 111.111.111-11)

  const calculaDigito = (base: string, pesoInicial: number): number => {
    let soma = 0;
    for (let i = 0; i < base.length; i++) {
      soma += Number(base[i]) * (pesoInicial - i);
    }
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };

  const digito1 = calculaDigito(cpf.slice(0, 9), 10);
  const digito2 = calculaDigito(cpf.slice(0, 10), 11);
  return digito1 === Number(cpf[9]) && digito2 === Number(cpf[10]);
}

export function formatarTelefone(valor: string): string {
  const d = apenasDigitos(valor).slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`; // celular, 9 digitos
}

export function formatarCEP(valor: string): string {
  const d = apenasDigitos(valor).slice(0, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

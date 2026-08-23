// Busca de endereco por CEP via ViaCEP (viacep.com.br) - servico publico e gratuito,
// amplamente usado em formularios de cadastro no Brasil. So' preenche rua/bairro/cidade/UF
// automaticamente pra ajudar o cliente; se falhar por qualquer motivo (CEP nao existe, sem
// rede, etc.) o formulario continua funcionando normalmente com preenchimento manual - por
// isso NUNCA lanca erro, so' devolve null quando nao acha.
export type EnderecoPorCep = {
  rua: string;
  bairro: string;
  cidade: string;
  uf: string;
};

export async function buscarEnderecoPorCep(cep: string): Promise<EnderecoPorCep | null> {
  const cepLimpo = cep.replace(/\D/g, "");
  if (cepLimpo.length !== 8) return null;

  try {
    const resposta = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
    if (!resposta.ok) return null;
    const dados = await resposta.json();
    if (dados.erro) return null;

    return {
      rua: dados.logradouro ?? "",
      bairro: dados.bairro ?? "",
      cidade: dados.localidade ?? "",
      uf: dados.uf ?? ""
    };
  } catch {
    return null;
  }
}

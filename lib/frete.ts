// Calculo de frete por CEP via Melhor Envio (agregador de transportadoras - Correios,
// Jadlog etc numa API so). Documentacao: docs.melhorenvio.com.br
//
// Pre-requisitos (fazer antes de usar em producao - ver PROXIMOS_PASSOS.md):
// 1. Criar conta gratis em melhorenvio.com.br
// 2. Gerar um token de API (Painel > Gerenciar > Tokens, ou via app OAuth se a conta exigir)
//    e colocar em MELHOR_ENVIO_TOKEN no .env
// 3. Preencher MELHOR_ENVIO_CEP_ORIGEM com o CEP de onde a MOZZ despacha os pedidos
//
// IMPORTANTE sobre peso/dimensao: o Bling nao guarda peso/dimensao por produto no que a
// gente sincroniza hoje, entao o calculo usa um pacote PADRAO aproximado (peso medio de
// roupa dobrada por peca) em vez do peso real de cada produto - da' um frete proximo do
// real, mas nao exato. Se um dia cadastrarmos peso/dimensao reais no Bling, e' so' passar
// isso aqui em vez do padrao.
const PESO_MEDIO_POR_PECA_KG = 0.3;
const PESO_MINIMO_KG = 0.3;
const PACOTE_PADRAO = { width: 30, height: 8, length: 40 }; // cm - caixa media de roupa dobrada

function hostMelhorEnvio(): string {
  return process.env.MELHOR_ENVIO_SANDBOX === "true"
    ? "https://sandbox.melhorenvio.com.br/api/v2"
    : "https://www.melhorenvio.com.br/api/v2";
}

export type OpcaoFrete = { servico: string; transportadora: string; preco: number; prazoDias: number };

type RespostaMelhorEnvio = Array<{
  name?: string;
  price?: string;
  delivery_time?: number;
  company?: { name?: string };
  error?: string;
}>;

export async function calcularFrete(cepDestino: string, quantidadeItens: number): Promise<OpcaoFrete[]> {
  const token = process.env.MELHOR_ENVIO_TOKEN;
  const cepOrigem = process.env.MELHOR_ENVIO_CEP_ORIGEM;
  if (!token || !cepOrigem) {
    throw new Error(
      "Cálculo de frete ainda não configurado (faltam MELHOR_ENVIO_TOKEN e/ou MELHOR_ENVIO_CEP_ORIGEM no .env)."
    );
  }

  const cepLimpo = cepDestino.replace(/\D/g, "");
  if (cepLimpo.length !== 8) {
    throw new Error("CEP inválido");
  }

  const peso = Math.max(PESO_MINIMO_KG, quantidadeItens * PESO_MEDIO_POR_PECA_KG);

  const resposta = await fetch(`${hostMelhorEnvio()}/me/shipment/calculate`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      "User-Agent": "MOZZ Ecommerce (contato@mozz.com.br)"
    },
    body: JSON.stringify({
      from: { postal_code: cepOrigem.replace(/\D/g, "") },
      to: { postal_code: cepLimpo },
      products: [
        {
          id: "carrinho-mozz",
          width: PACOTE_PADRAO.width,
          height: PACOTE_PADRAO.height,
          length: PACOTE_PADRAO.length,
          weight: peso,
          insurance_value: 0,
          quantity: 1
        }
      ]
    })
  });

  if (!resposta.ok) {
    const texto = await resposta.text();
    throw new Error(`Erro ao consultar frete (${resposta.status}): ${texto}`);
  }

  const dados = (await resposta.json()) as RespostaMelhorEnvio;

  return dados
    .filter((opcao) => !opcao.error && opcao.price)
    .map((opcao) => ({
      servico: opcao.name ?? "Entrega",
      transportadora: opcao.company?.name ?? "",
      preco: Number(opcao.price),
      prazoDias: opcao.delivery_time ?? 0
    }))
    .sort((a, b) => a.preco - b.preco);
}

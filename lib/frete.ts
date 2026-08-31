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
export const PACOTE_PADRAO = { width: 30, height: 8, length: 40 }; // cm - caixa media de roupa dobrada

// Exportado pra lib/melhorEnvio.ts (compra/geracao de etiqueta) reusar o mesmo switch
// sandbox/producao em vez de duplicar essa logica - MELHOR_ENVIO_SANDBOX controla os dois.
export function hostMelhorEnvio(base: "api" | "auth" = "api"): string {
  const sandbox = process.env.MELHOR_ENVIO_SANDBOX === "true";
  if (base === "auth") {
    return sandbox ? "https://sandbox.melhorenvio.com.br" : "https://www.melhorenvio.com.br";
  }
  return sandbox ? "https://sandbox.melhorenvio.com.br/api/v2" : "https://www.melhorenvio.com.br/api/v2";
}

// Peso estimado do pacote pra uma quantidade de itens - mesma conta usada internamente por
// calcularFrete, exportada pra lib/melhorEnvio.ts montar o mesmo pacote na hora de comprar a
// etiqueta (o volume declarado na compra precisa bater com o que foi cotado).
export function pesoParaQuantidade(quantidadeItens: number): number {
  return Math.max(PESO_MINIMO_KG, quantidadeItens * PESO_MEDIO_POR_PECA_KG);
}

export type OpcaoFrete = {
  servico: string;
  transportadora: string;
  preco: number;
  prazoDias: number;
  // id numerico do SERVICO no Melhor Envio (ex: 1 = PAC, 2 = SEDEX) - undefined pra retirada
  // na loja (FRETE_RETIRADA, nao vem do Melhor Envio). Necessario pra comprar a etiqueta
  // depois (POST /me/cart usa esse id, nao o nome) - ver lib/melhorEnvio.ts.
  servicoId?: number;
};

// Opcao especial de "retirar na loja" - nao vem do Melhor Envio, e' oferecida direto no
// carrinho quando habilitada em /admin/produtos (ver lib/configLoja.ts). transportadora
// "Retirada" e' o sinal que o resto do codigo usa pra reconhecer essa opcao (ver ehRetirada
// abaixo e a revalidacao em lib/mercadopago.ts) - nenhuma transportadora real do Melhor Envio
// usa esse nome.
export const FRETE_RETIRADA: OpcaoFrete = {
  servico: "Retirada na loja",
  transportadora: "Retirada",
  preco: 0,
  prazoDias: 0
};

export function ehRetirada(opcao: Pick<OpcaoFrete, "transportadora">): boolean {
  return opcao.transportadora === FRETE_RETIRADA.transportadora;
}

// O Melhor Envio costuma devolver bastante opcao (Correios PAC/SEDEX, Jadlog .Package/.Com
// etc) - o Brunno achou que isso confunde o cliente na hora de escolher (pedido de
// 29/08/2026). Reduz pra no maximo 2: a mais barata, e a mais rapida entre as que chegam MAIS
// rapido que a mais barata (pra nao mostrar uma segunda opcao so' redundante, com o mesmo
// prazo por um preco maior). Lista ja' vem ordenada por preco de calcularFrete.
function simplificarOpcoes(opcoesPorPreco: OpcaoFrete[]): OpcaoFrete[] {
  if (opcoesPorPreco.length <= 2) return opcoesPorPreco;
  const [maisBarata, ...resto] = opcoesPorPreco;
  const maisRapida = resto
    .filter((opcao) => opcao.prazoDias < maisBarata.prazoDias)
    .sort((a, b) => a.prazoDias - b.prazoDias || a.preco - b.preco)[0];
  return maisRapida ? [maisBarata, maisRapida] : [maisBarata];
}

type RespostaMelhorEnvio = Array<{
  id?: number;
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

  const opcoesPorPreco = dados
    .filter((opcao) => !opcao.error && opcao.price)
    .map((opcao) => ({
      servico: opcao.name ?? "Entrega",
      transportadora: opcao.company?.name ?? "",
      preco: Number(opcao.price),
      prazoDias: opcao.delivery_time ?? 0,
      servicoId: opcao.id
    }))
    .sort((a, b) => a.preco - b.preco);

  return simplificarOpcoes(opcoesPorPreco);
}

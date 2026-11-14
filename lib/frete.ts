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
// Caixa padrao da MOZZ (14/11/2026): 15 x 20 x 25 cm - a unica que a loja tem hoje. Cotacao e etiqueta
// usam a MESMA medida (ver lib/melhorEnvio.ts), senao a loja paga a diferenca. Quando chegarem os
// envelopes plasticos (mais baratos, abaixo de 6.000 cm3), e' so' trocar os numeros aqui.
export const PACOTE_PADRAO = { width: 20, height: 15, length: 25 }; // cm

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

// Entrega expressa em Reserva-PR (19/10/2026, pedido do Brunno): so' pra CEP de Reserva, gratis,
// feita pela propria equipe/motoboy da Mozz - nao passa pelo Melhor Envio (nao gera etiqueta),
// mesmo raciocinio da retirada na loja. transportadora "Entrega expressa" e' o sinal que o
// resto do codigo usa (ver ehEntregaExpressa e a revalidacao em lib/mercadopago.ts).
export const FRETE_ENTREGA_EXPRESSA: OpcaoFrete = {
  servico: "Entrega expressa em Reserva",
  transportadora: "Entrega expressa",
  preco: 0,
  prazoDias: 0
};

export function ehEntregaExpressa(opcao: Pick<OpcaoFrete, "transportadora">): boolean {
  return opcao.transportadora === FRETE_ENTREGA_EXPRESSA.transportadora;
}

// CEPs de Reserva-PR comecam com 84320 (o da loja e' 84320-000).
export function cepDeReserva(cep: string): boolean {
  return cep.replace(/\D/g, "").startsWith("84320");
}

// Frete fixo temporario (14/11/2026, pedido do Brunno): ate' a chegada dos envelopes mais baratos, a
// loja cobra no maximo R$ 20 de frete pra Sul, Sudeste e Centro-Oeste, em pedidos de ate' 2 pecas,
// e banca a diferenca pro PAC real. Se o PAC real sair abaixo de R$ 20, cobra o valor real.
// Norte, Nordeste e pedidos de 3+ pecas continuam com o preco real do PAC.
const FRETE_FIXO_REAIS = 20;
const MAX_PECAS_FRETE_FIXO = 2;

// Regiao pela faixa de CEP (5 primeiros digitos): Sudeste 01000-39999, Centro-Oeste (DF/GO
// 70000-76799, MT 78000-78899, MS 79000-79999) e Sul 80000-99999. Fora disso (Norte/Nordeste,
// RO e TO) nao entra no frete fixo.
export function cepComFreteFixo(cep: string): boolean {
  const n = Number(cep.replace(/\D/g, "").slice(0, 5));
  if (!Number.isFinite(n)) return false;
  return (
    (n >= 1000 && n <= 39999) ||
    (n >= 70000 && n <= 76799) ||
    (n >= 78000 && n <= 78899) ||
    (n >= 79000 && n <= 99999)
  );
}

// Quando a entrega expressa chega, conforme o horario de corte (fuso de Sao Paulo): segunda a
// sexta, pedido pago ate' 14h sai no mesmo dia; sabado, ate' 11h (a loja fecha 12h); depois
// disso, ou no domingo, vai pro proximo dia util. Feriado nao e' considerado.
export function previsaoEntregaExpressa(agora: Date = new Date()): "hoje" | "amanhã" | "segunda-feira" {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    weekday: "short",
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23"
  }).formatToParts(agora);
  const dia = partes.find((p) => p.type === "weekday")?.value ?? "Mon";
  const hora = Number(partes.find((p) => p.type === "hour")?.value ?? 0);
  const minuto = Number(partes.find((p) => p.type === "minute")?.value ?? 0);
  const minutosDoDia = hora * 60 + minuto;

  if (dia === "Sun") return "segunda-feira";
  if (dia === "Sat") return minutosDoDia < 11 * 60 ? "hoje" : "segunda-feira";
  if (minutosDoDia < 14 * 60) return "hoje";
  return dia === "Fri" ? "segunda-feira" : "amanhã";
}

// Desde 14/11/2026 o site oferece SO' os Correios (PAC): Loggi, Jadlog e as outras nao tem coleta
// em Reserva (so' os Correios, que tem agencia na cidade) e a Loggi cotava bem mais barato que a
// etiqueta real, o que dava prejuizo (pedidos MOZZ-1794539067960 e MOZZ-1794585162414). O cliente ve
// uma linha so', sem escolher transportadora.
function escolherOpcaoCorreios(opcoes: OpcaoFrete[]): OpcaoFrete | undefined {
  const correios = opcoes.filter(
    (o) => o.transportadora.toLowerCase().includes("correios") && !o.servico.toLowerCase().includes("mini")
  );
  const pac = correios.filter((o) => o.servico.toUpperCase().includes("PAC"));
  const base = pac.length > 0 ? pac : correios;
  return base.sort((a, b) => a.preco - b.preco)[0];
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

  const opcoes: OpcaoFrete[] = dados
    .filter((opcao) => !opcao.error && opcao.price)
    .map((opcao) => ({
      servico: opcao.name ?? "Entrega",
      transportadora: opcao.company?.name ?? "",
      preco: Number(opcao.price),
      prazoDias: opcao.delivery_time ?? 0,
      servicoId: opcao.id
    }));

  const escolhida = escolherOpcaoCorreios(opcoes);
  if (!escolhida) return [];

  if (cepComFreteFixo(cepLimpo) && quantidadeItens <= MAX_PECAS_FRETE_FIXO) {
    return [{ ...escolhida, preco: Math.min(escolhida.preco, FRETE_FIXO_REAIS) }];
  }
  return [escolhida];
}

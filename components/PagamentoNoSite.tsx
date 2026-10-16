"use client";

import { useEffect, useRef, useState } from "react";
import { formatarPreco } from "@/lib/formato";

// Pagamento DENTRO do site (16/10/2026, pedido do Brunno - a suspeita era que a cliente
// desistia quando o site mandava ela pro Mercado Pago). Duas abas:
//  - Pix: gera o QR Code aqui mesmo (app/api/mercadopago/pagar) e fica perguntando a cada
//    poucos segundos se ja' caiu (app/api/mercadopago/status). Caiu -> /checkout/sucesso.
//  - Cartao: Card Payment Brick do Mercado Pago - os campos do cartao sao desenhados pelo
//    proprio Mercado Pago dentro da pagina, o numero do cartao vira um "token" la' e so' esse
//    token chega no nosso servidor (seguro/PCI, a Mozz nunca ve o cartao).
// Sem a NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY configurada na Vercel esse componente nao aparece
// e o carrinho continua so' com o botao antigo (redireciona pro Mercado Pago).
export const CHAVE_PUBLICA_MP = process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY ?? "";

const CHAVE_PIX_SALVO = "mozz_pix_em_aberto";
const URL_SDK = "https://sdk.mercadopago.com/js/v2";

type PixGerado = {
  numeroPedido: string;
  pagamentoId: string;
  qrCode: string;
  qrCodeBase64: string | null;
  expiraEm: number;
  valorTotal: number;
};

// Corpo do pedido (itens, cliente, frete, cupom, credito) montado pelo carrinho - o mesmo
// formato que o criar-preferencia ja' recebia.
export type CorpoPedido = Record<string, unknown>;

declare global {
  interface Window {
    MercadoPago?: new (chave: string, opcoes?: { locale?: string }) => {
      bricks: () => {
        create: (tipo: string, containerId: string, config: unknown) => Promise<{ unmount: () => void }>;
      };
    };
    MP_DEVICE_SESSION_ID?: string;
  }
}

let promessaSdk: Promise<void> | null = null;
function carregarSdk(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.MercadoPago) return Promise.resolve();
  if (!promessaSdk) {
    promessaSdk = new Promise((resolver, rejeitar) => {
      const script = document.createElement("script");
      script.src = URL_SDK;
      script.async = true;
      script.onload = () => resolver();
      script.onerror = () => {
        promessaSdk = null;
        rejeitar(new Error("Não foi possível carregar o pagamento por cartão"));
      };
      document.head.appendChild(script);
    });
  }
  return promessaSdk;
}

function lerPixSalvo(valorTotal: number): PixGerado | null {
  try {
    const salvo = window.sessionStorage.getItem(CHAVE_PIX_SALVO);
    if (!salvo) return null;
    const pix = JSON.parse(salvo) as PixGerado;
    if (pix.expiraEm > Date.now() + 60_000 && Math.abs(pix.valorTotal - valorTotal) <= 1) return pix;
  } catch {
    // ignora
  }
  return null;
}

function guardarPix(pix: PixGerado | null) {
  try {
    if (pix) window.sessionStorage.setItem(CHAVE_PIX_SALVO, JSON.stringify(pix));
    else window.sessionStorage.removeItem(CHAVE_PIX_SALVO);
  } catch {
    // ignora
  }
}

function irParaResultado(pagina: "sucesso" | "pendente", numeroPedido: string, pagamentoId: string) {
  guardarPix(null);
  window.location.href = `/checkout/${pagina}?external_reference=${encodeURIComponent(
    numeroPedido
  )}&payment_id=${encodeURIComponent(pagamentoId)}`;
}

export default function PagamentoNoSite({
  corpoPedido,
  valorTotal,
  email,
  pronto,
  parcelasMaximas,
  onPedidoCriado,
  onPagarNoMercadoPago,
  redirecionando
}: {
  corpoPedido: CorpoPedido;
  valorTotal: number;
  email: string;
  pronto: boolean;
  parcelasMaximas: number;
  onPedidoCriado: (numeroPedido: string) => void;
  onPagarNoMercadoPago: () => void;
  redirecionando: boolean;
}) {
  const [aba, setAba] = useState<"pix" | "cartao">("pix");
  const [erro, setErro] = useState<string | null>(null);

  // ---------- Pix ----------
  const [pix, setPix] = useState<PixGerado | null>(null);
  const [gerandoPix, setGerandoPix] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [agora, setAgora] = useState(Date.now());

  useEffect(() => {
    setPix(lerPixSalvo(valorTotal));
    // so' na entrada - se o valor mudar depois, o Pix antigo e' descartado logo abaixo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Valor do pedido mudou (cupom, credito, frete) depois de gerar o Pix -> esse QR nao vale mais
  useEffect(() => {
    if (pix && Math.abs(pix.valorTotal - valorTotal) > 1) {
      setPix(null);
      guardarPix(null);
    }
  }, [valorTotal, pix]);

  // relogio da contagem regressiva + checagem do pagamento a cada 4s
  useEffect(() => {
    if (!pix) return;
    const relogio = setInterval(() => setAgora(Date.now()), 1000);
    let parado = false;
    const checar = async () => {
      if (parado || document.visibilityState === "hidden") return;
      try {
        const r = await fetch(
          `/api/mercadopago/status?id=${encodeURIComponent(pix.pagamentoId)}&pedido=${encodeURIComponent(pix.numeroPedido)}`,
          { cache: "no-store" }
        );
        const d = await r.json();
        if (d.status === "approved") irParaResultado("sucesso", pix.numeroPedido, pix.pagamentoId);
      } catch {
        // tenta de novo na proxima rodada
      }
    };
    const consulta = setInterval(checar, 4000);
    // quando a cliente volta do app do banco pra aba do site, confere na hora
    document.addEventListener("visibilitychange", checar);
    return () => {
      parado = true;
      clearInterval(relogio);
      clearInterval(consulta);
      document.removeEventListener("visibilitychange", checar);
    };
  }, [pix]);

  const segundosRestantes = pix ? Math.max(0, Math.floor((pix.expiraEm - agora) / 1000)) : 0;
  const pixExpirado = !!pix && segundosRestantes === 0;

  async function gerarPix() {
    if (!pronto) {
      setErro("Confira seus dados e a entrega antes de pagar");
      return;
    }
    setErro(null);
    setGerandoPix(true);
    try {
      const r = await fetch("/api/mercadopago/pagar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...corpoPedido, metodo: "pix", valorEsperado: valorTotal })
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.erro ?? "Não foi possível gerar o Pix");
      const novo: PixGerado = {
        numeroPedido: d.numeroPedido,
        pagamentoId: d.pagamentoId,
        qrCode: d.qrCode,
        qrCodeBase64: d.qrCodeBase64,
        expiraEm: d.expiraEm,
        valorTotal: d.valorTotal
      };
      onPedidoCriado(novo.numeroPedido);
      setPix(novo);
      guardarPix(novo);
      setAgora(Date.now());
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível gerar o Pix");
    } finally {
      setGerandoPix(false);
    }
  }

  async function copiarCodigo() {
    if (!pix) return;
    try {
      await navigator.clipboard.writeText(pix.qrCode);
    } catch {
      // navegador sem clipboard API - seleciona o texto pra copiar na mao
      const campo = document.getElementById("pix-copia-cola") as HTMLTextAreaElement | null;
      campo?.select();
      document.execCommand?.("copy");
    }
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2500);
  }

  // ---------- Cartao ----------
  const [carregandoCartao, setCarregandoCartao] = useState(false);
  const controleBrick = useRef<{ unmount: () => void } | null>(null);
  // refs pra o callback do brick (criado uma vez por valor) sempre usar os dados atuais
  const corpoRef = useRef(corpoPedido);
  corpoRef.current = corpoPedido;
  const callbackRef = useRef(onPedidoCriado);
  callbackRef.current = onPedidoCriado;

  useEffect(() => {
    if (aba !== "cartao" || !pronto || valorTotal <= 0) return;
    let cancelado = false;
    setCarregandoCartao(true);
    setErro(null);

    carregarSdk()
      .then(async () => {
        if (cancelado || !window.MercadoPago) return;
        const mp = new window.MercadoPago(CHAVE_PUBLICA_MP, { locale: "pt-BR" });
        controleBrick.current?.unmount();
        const brick = await mp.bricks().create("cardPayment", "mozz-cartao-brick", {
          initialization: { amount: valorTotal, payer: { email } },
          customization: {
            paymentMethods: { minInstallments: 1, maxInstallments: parcelasMaximas },
            visual: {
              style: {
                theme: "default",
                customVariables: {
                  baseColor: "#111111",
                  borderRadiusSmall: "0px",
                  borderRadiusMedium: "0px",
                  borderRadiusLarge: "0px",
                  borderRadiusFull: "0px"
                }
              }
            }
          },
          callbacks: {
            onReady: () => setCarregandoCartao(false),
            onError: (e: unknown) => {
              console.error("Brick cartao:", e);
              setCarregandoCartao(false);
            },
            onSubmit: async (dados: {
              token: string;
              issuer_id?: string;
              payment_method_id: string;
              installments: number;
              payer?: { identification?: { type?: string; number?: string } };
            }) => {
              setErro(null);
              try {
                const r = await fetch("/api/mercadopago/pagar", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    ...corpoRef.current,
                    metodo: "cartao",
                    valorEsperado: valorTotal,
                    sessaoDispositivo: window.MP_DEVICE_SESSION_ID,
                    cartao: {
                      token: dados.token,
                      paymentMethodId: dados.payment_method_id,
                      issuerId: dados.issuer_id,
                      parcelas: dados.installments,
                      identificacao: dados.payer?.identification
                        ? { tipo: dados.payer.identification.type, numero: dados.payer.identification.number }
                        : undefined
                    }
                  })
                });
                const d = await r.json();
                if (!r.ok) throw new Error(d.erro ?? "Não foi possível processar o pagamento");
                callbackRef.current(d.numeroPedido);
                if (d.status === "approved") {
                  irParaResultado("sucesso", d.numeroPedido, d.pagamentoId);
                } else if (d.status === "in_process" || d.status === "pending" || d.status === "authorized") {
                  irParaResultado("pendente", d.numeroPedido, d.pagamentoId);
                } else {
                  setErro(d.mensagem ?? "O pagamento não foi aprovado. Tente outro cartão ou pague com Pix.");
                }
              } catch (e) {
                setErro(e instanceof Error ? e.message : "Não foi possível processar o pagamento");
              }
            }
          }
        });
        // a cliente trocou de aba (ou o valor mudou) enquanto o formulario carregava
        if (cancelado) brick.unmount();
        else controleBrick.current = brick;
      })
      .catch((e) => {
        if (!cancelado) {
          setErro(e instanceof Error ? e.message : "Não foi possível carregar o pagamento por cartão");
          setCarregandoCartao(false);
        }
      });

    return () => {
      cancelado = true;
      controleBrick.current?.unmount();
      controleBrick.current = null;
    };
    // recria o formulario quando o valor muda (parcelas dependem do valor)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aba, pronto, valorTotal, email, parcelasMaximas]);

  const minutos = String(Math.floor(segundosRestantes / 60)).padStart(2, "0");
  const segundos = String(segundosRestantes % 60).padStart(2, "0");

  return (
    <div>
      <div className="grid grid-cols-2 border border-black/20 mb-4">
        {(["pix", "cartao"] as const).map((opcao) => (
          <button
            key={opcao}
            onClick={() => {
              setErro(null);
              setAba(opcao);
            }}
            className={`py-2.5 text-[14px] ${aba === opcao ? "bg-mozz-black text-white" : "text-mozz-black"}`}
          >
            {opcao === "pix" ? "Pix" : "Cartão de crédito"}
          </button>
        ))}
      </div>

      {aba === "pix" && (
        <div>
          {!pix || pixExpirado ? (
            <>
              {pixExpirado && (
                <p className="text-[13.5px] text-mozz-gray mb-2">Esse Pix expirou. Gere um novo para pagar.</p>
              )}
              <button
                onClick={gerarPix}
                disabled={gerandoPix}
                className="w-full text-[14.5px] py-3 bg-mozz-black text-white disabled:opacity-60"
              >
                {gerandoPix ? "Gerando o Pix..." : `Gerar Pix de ${formatarPreco(valorTotal)}`}
              </button>
              <p className="text-[12.5px] text-mozz-gray text-center mt-2">
                Aprovação na hora. O QR Code aparece aqui mesmo.
              </p>
            </>
          ) : (
            <div className="text-center">
              <p className="text-[14.5px]">
                Pague {formatarPreco(pix.valorTotal)} com Pix
              </p>
              <p className="text-[13px] text-mozz-gray mb-3">
                Expira em {minutos}:{segundos}
              </p>
              {pix.qrCodeBase64 && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`data:image/png;base64,${pix.qrCodeBase64}`}
                  alt="QR Code do Pix"
                  className="w-52 h-52 mx-auto border border-black/10"
                />
              )}
              <p className="text-[13px] text-mozz-gray mt-3 mb-2">
                No celular? Copie o código e cole no app do seu banco, em Pix Copia e Cola.
              </p>
              <textarea
                id="pix-copia-cola"
                readOnly
                value={pix.qrCode}
                rows={2}
                className="w-full text-[12px] border border-black/15 p-2 resize-none text-mozz-gray"
              />
              <button onClick={copiarCodigo} className="w-full text-[14.5px] py-3 mt-1 bg-mozz-black text-white">
                {copiado ? "Código copiado ✓" : "Copiar código Pix"}
              </button>
              <p className="text-[13px] text-mozz-gray mt-3">
                Aguardando o pagamento… assim que cair, esta página confirma o pedido sozinha.
              </p>
            </div>
          )}
        </div>
      )}

      {aba === "cartao" && (
        <div>
          {carregandoCartao && <p className="text-[13.5px] text-mozz-gray py-6 text-center">Carregando…</p>}
          <div id="mozz-cartao-brick" />
          <p className="text-[12.5px] text-mozz-gray text-center mt-1">
            Pagamento processado com segurança pelo Mercado Pago. A Mozz não tem acesso aos dados do seu cartão.
          </p>
        </div>
      )}

      {erro && <p className="text-[13.5px] text-red-600 mt-3">{erro}</p>}

      <button
        onClick={onPagarNoMercadoPago}
        disabled={redirecionando}
        className="block mx-auto text-[12.5px] underline text-mozz-gray mt-5 disabled:opacity-60"
      >
        {redirecionando ? "Abrindo o Mercado Pago..." : "Prefiro pagar pelo site do Mercado Pago"}
      </button>
    </div>
  );
}

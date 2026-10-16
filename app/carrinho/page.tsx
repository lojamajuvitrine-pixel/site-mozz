"use client";

import { useCart } from "@/lib/cart-context";
import { idVarianteProduto } from "@/lib/produtos";
import { formatarPreco, calcularParcelamento } from "@/lib/formato";
import { useEffect, useRef, useState } from "react";
import CalculoFrete, { type OpcaoFrete, type ConfigLojaFrete } from "@/components/CalculoFrete";
import AvisoFreteGratis from "@/components/AvisoFreteGratis";
import { ehRetirada } from "@/lib/frete";
import { rastrearIniciarCheckout } from "@/lib/tracking";
import { validarCpf, formatarCpf } from "@/lib/cpf";
import { createClient } from "@/lib/supabase/client";
import { buscarEnderecoPorCep } from "@/lib/cep";

type ResultadoCupom =
  | { valido: true; cupom: { codigo: string; tipo: "percentual" | "fixo"; valor: number }; desconto: number }
  | { valido: false; motivo: string };

// Mesmo valor de PERCENTUAL_MAXIMO_USO em lib/creditos.ts - duplicado aqui (em vez de importar
// aquele arquivo, que puxa o cliente Supabase) so' pra calcular o teto de credito aplicavel no
// navegador, pra mostrar pra cliente. O valor de verdade e' sempre revalidado no servidor (ver
// lib/mercadopago.ts) na hora de criar a preferencia de pagamento.
const PERCENTUAL_MAXIMO_CREDITO = 0.3;
// Mesmo valor de PERCENTUAL_CASHBACK em lib/creditos.ts - duplicado aqui pelo mesmo motivo
// acima, so' pra mostrar quanto de cashback essa compra vai gerar (ver aviso perto do topo do
// carrinho, abaixo). O valor concedido de verdade e' calculado so' no webhook, depois do
// pagamento aprovado (ver lib/creditos.ts -> concederCashback).
const PERCENTUAL_CASHBACK = 0.15;

// Checkout em 3 etapas (15/10/2026, pedido do Brunno): 1) Seus dados  2) Entrega  3) Pagamento.
// A cada "Continuar" os dados ja' digitados sao gravados no Supabase (tabela checkouts, ver
// app/api/checkout/salvar/route.ts) - assim, se a cliente desistir antes de pagar, a Mozz
// consegue chamar no WhatsApp pelo painel /admin/carrinhos-abandonados. O id + token desse
// checkout ficam no navegador (localStorage) pra a mesma cliente atualizar a mesma linha se
// voltar depois - e so' ela consegue (o token nunca sai do navegador dela).
const CHAVE_CHECKOUT = "mozz_checkout";

type IdentidadeCheckout = { id: string; token: string };
type Etapa = "dados" | "entrega" | "pagamento";

function gerarUuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function novaIdentidade(): IdentidadeCheckout {
  const identidade = { id: gerarUuid(), token: gerarUuid() + gerarUuid().slice(0, 8) };
  try {
    window.localStorage.setItem(CHAVE_CHECKOUT, JSON.stringify(identidade));
  } catch {
    // navegador sem localStorage (aba anonima restrita) - segue so' com a identidade em memoria
  }
  return identidade;
}

function identidadeSalva(): IdentidadeCheckout {
  try {
    const salvo = window.localStorage.getItem(CHAVE_CHECKOUT);
    if (salvo) {
      const dados = JSON.parse(salvo);
      if (typeof dados?.id === "string" && typeof dados?.token === "string") return dados;
    }
  } catch {
    // ignora e cria uma nova
  }
  return novaIdentidade();
}

// Mascara do WhatsApp: (41) 99999-9999 / (41) 3333-3333
function formatarTelefone(valor: string): string {
  const d = valor.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "").slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

const classeCampo =
  "border border-black/20 px-3 py-2.5 text-[14.5px] focus:outline-none focus:border-mozz-black";

function CabecalhoEtapa({
  numero,
  titulo,
  ativa,
  concluida,
  resumo,
  onAlterar
}: {
  numero: number;
  titulo: string;
  ativa: boolean;
  concluida: boolean;
  resumo?: string;
  onAlterar?: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        <span
          className={`w-6 h-6 shrink-0 rounded-full flex items-center justify-center text-[12.5px] ${
            ativa || concluida ? "bg-mozz-black text-white" : "border border-black/25 text-mozz-gray"
          }`}
        >
          {concluida && !ativa ? "✓" : numero}
        </span>
        <div>
          <p className={`text-[15px] ${ativa || concluida ? "text-mozz-black" : "text-mozz-gray"}`}>{titulo}</p>
          {concluida && !ativa && resumo && <p className="text-[13px] text-mozz-gray mt-0.5">{resumo}</p>}
        </div>
      </div>
      {concluida && !ativa && onAlterar && (
        <button onClick={onAlterar} className="text-[13px] underline text-mozz-gray shrink-0">
          Alterar
        </button>
      )}
    </div>
  );
}

export default function PaginaCarrinho() {
  const { itens, remover, atualizarQuantidade, total } = useCart();
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Etapa aberta agora + quais ja' foram concluidas (etapa concluida vira um resumo de 1 linha
  // com "Alterar"). Os campos de todas as etapas continuam montados (so' escondidos), pra nao
  // perder o que a cliente digitou nem o frete calculado quando ela volta pra corrigir algo.
  const [etapaAberta, setEtapaAberta] = useState<Etapa>("dados");
  const [dadosConcluidos, setDadosConcluidos] = useState(false);
  const [entregaConcluida, setEntregaConcluida] = useState(false);
  const checkoutRastreado = useRef(false);
  const identidade = useRef<IdentidadeCheckout | null>(null);

  const [codigoCupom, setCodigoCupom] = useState("");
  const [cupomAplicado, setCupomAplicado] = useState<ResultadoCupom | null>(null);
  const [validandoCupom, setValidandoCupom] = useState(false);

  // Credito de loja (cashback) - saldo buscado automaticamente assim que o CPF digitado fica
  // valido (ver useEffect abaixo), mesmo padrao do preenchimento automatico via login. O valor
  // solicitado fica num campo separado (nao aplicado automaticamente por inteiro) pra cliente
  // poder guardar parte do credito pra outra compra, se quiser.
  const [creditoDisponivel, setCreditoDisponivel] = useState(0);
  const [valorCreditoUsar, setValorCreditoUsar] = useState("");

  const [freteSelecionado, setFreteSelecionado] = useState<OpcaoFrete | null>(null);
  // Frete gratis a partir de X e retirada na loja - configuraveis em /admin/produtos (ver
  // lib/configLoja.ts). null enquanto ainda esta' carregando; nesse meio-tempo o carrinho
  // funciona normal, so' sem mostrar "Retirar na loja" nem a mensagem de frete gratis.
  const [configLoja, setConfigLoja] = useState<ConfigLojaFrete | null>(null);

  useEffect(() => {
    fetch("/api/config-loja")
      .then((r) => r.json())
      .then(setConfigLoja)
      .catch(() => {});
  }, []);

  // Dados pra nota fiscal/entrega - pre-preenchidos automaticamente se o cliente ja' tiver
  // feito login e preenchido o perfil em /conta (ver PerfilForm), mas o checkout NAO exige
  // login (compra como visitante e' permitida - ver middleware.ts).
  const [nomeCompleto, setNomeCompleto] = useState("");
  const [cpf, setCpf] = useState("");
  // E-mail e telefone (WhatsApp) sao OBRIGATORIOS desde 31/08/2026 - antes o site dependia
  // so' do e-mail que o Mercado Pago devolvia depois do pagamento, que pode vir mascarado e o
  // telefone nunca chegava na etiqueta de envio (ver lib/melhorEnvio.ts).
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  // Opt-in de marketing pelo WhatsApp - DESMARCADO por padrao (LGPD: consentimento tem que
  // ser uma acao da cliente). Fica gravado com data no checkout (aceita_marketing_em).
  const [aceitaMarketing, setAceitaMarketing] = useState(false);

  // Endereco de entrega - Rua/bairro/cidade/UF sao preenchidos automaticamente pelo CEP usado
  // no calculo de frete (ver CalculoFrete.tsx -> onCepCalculado), mas continuam editaveis.
  // Numero e' sempre manual (o ViaCEP nao devolve numero de casa).
  const [cepEndereco, setCepEndereco] = useState("");
  const [rua, setRua] = useState("");
  const [numero, setNumero] = useState("");
  const [complemento, setComplemento] = useState("");
  const [bairro, setBairro] = useState("");
  const [cidade, setCidade] = useState("");
  const [uf, setUf] = useState("");
  const [buscandoCep, setBuscandoCep] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      const meta = data.user?.user_metadata ?? {};
      if (data.user?.email) setEmail(data.user.email);
      if (meta.nome_completo) setNomeCompleto(meta.nome_completo);
      if (meta.cpf) setCpf(meta.cpf);
      if (meta.telefone) setTelefone(formatarTelefone(meta.telefone));
      if (meta.cep) setCepEndereco(meta.cep);
      if (meta.endereco) setRua(meta.endereco);
      if (meta.numero) setNumero(meta.numero);
      if (meta.complemento) setComplemento(meta.complemento);
      if (meta.bairro) setBairro(meta.bairro);
      if (meta.cidade) setCidade(meta.cidade);
      if (meta.uf) setUf(meta.uf);
    });
  }, []);

  // Busca o saldo de credito de loja assim que o CPF digitado vira valido (ver
  // app/api/creditos/saldo/route.ts) - some de novo se a cliente apagar/trocar o CPF pra um
  // invalido, pra nao mostrar um saldo que nao bate mais com o CPF no campo.
  useEffect(() => {
    if (!validarCpf(cpf)) {
      setCreditoDisponivel(0);
      setValorCreditoUsar("");
      return;
    }
    fetch("/api/creditos/saldo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cpf })
    })
      .then((r) => r.json())
      .then((d) => setCreditoDisponivel(Number(d.saldo) || 0))
      .catch(() => setCreditoDisponivel(0));
  }, [cpf]);

  async function aoCalcularFrete(cepLimpo: string) {
    setCepEndereco(cepLimpo);
    setBuscandoCep(true);
    const endereco = await buscarEnderecoPorCep(cepLimpo);
    if (endereco) {
      setRua((atual) => endereco.rua || atual);
      setBairro((atual) => endereco.bairro || atual);
      setCidade((atual) => endereco.cidade || atual);
      setUf((atual) => endereco.uf || atual);
    }
    setBuscandoCep(false);
  }

  const quantidadeTotal = itens.reduce((soma, i) => soma + i.quantidade, 0);
  const desconto = cupomAplicado?.valido ? cupomAplicado.desconto : 0;
  const totalComDesconto = Math.max(0, total - desconto);

  // Recalcula o preco EFETIVO do frete escolhido em cima do subtotal atual (em vez de so'
  // usar o preco que foi gravado no momento do clique) - assim, se o cliente adicionar mais
  // um item e o carrinho passar do valor minimo do frete gratis DEPOIS de já ter escolhido
  // uma transportadora, o total aqui atualiza sozinho sem precisar recalcular o frete de novo.
  // Retirada na loja e' sempre gratis. O checkout revalida tudo isso de novo no servidor (ver
  // lib/mercadopago.ts) - o que acontece aqui e' so' pra mostrar o total certo pro cliente.
  const freteGratisAtivo =
    configLoja?.freteGratisAcimaDe != null && totalComDesconto >= configLoja.freteGratisAcimaDe;
  const precoFreteEfetivo = freteSelecionado
    ? ehRetirada(freteSelecionado) || freteGratisAtivo
      ? 0
      : freteSelecionado.preco
    : 0;
  const totalComFrete = totalComDesconto + precoFreteEfetivo;

  // Teto de credito aplicavel: 30% do valor do pedido (produtos com desconto de cupom + frete
  // - mesma base "incluindo frete" usada pra conceder o cashback, ver lib/creditos.ts). O
  // credito de fato aplicado nunca passa do saldo disponivel nem do que a cliente pediu pra
  // usar. Revalidado de novo no servidor ao criar a preferencia (ver lib/mercadopago.ts).
  const tetoCredito = Math.round(totalComFrete * PERCENTUAL_MAXIMO_CREDITO * 100) / 100;
  const creditoMaximoAplicavel = Math.min(creditoDisponivel, tetoCredito);
  const creditoAplicado = Math.min(creditoMaximoAplicavel, Math.max(0, Number(valorCreditoUsar) || 0));
  const totalFinal = Math.max(0, totalComFrete - creditoAplicado);
  const parcelamentoTotal = calcularParcelamento(totalFinal);

  const nomeValido = nomeCompleto.trim().split(/\s+/).length >= 2 && nomeCompleto.trim().length > 3;
  const cpfValido = validarCpf(cpf);
  const emailValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const digitosTelefone = telefone.replace(/\D/g, "");
  const telefoneValido = digitosTelefone.length >= 10 && digitosTelefone.length <= 11;
  const enderecoCompleto =
    rua.trim().length > 2 && numero.trim().length > 0 && bairro.trim().length > 1 &&
    cidade.trim().length > 1 && uf.trim().length === 2;
  const dadosValidos = nomeValido && emailValido && telefoneValido;
  const entregaValida = cpfValido && freteSelecionado !== null && enderecoCompleto;
  const podeFinalizar = dadosValidos && entregaValida;

  // Grava a etapa no Supabase - nunca trava a compra: se der erro, a cliente segue normal.
  // keepalive=true pra a gravacao da etapa "pagamento" terminar mesmo com o redirecionamento
  // pro Mercado Pago logo em seguida.
  function salvarEtapa(etapa: Etapa, numeroPedido?: string, tentativa = 0) {
    if (!identidade.current) identidade.current = identidadeSalva();
    const corpo = {
      ...identidade.current,
      etapa,
      nome: nomeCompleto,
      whatsapp: telefone,
      email,
      aceitaMarketing,
      cpf: etapa === "dados" ? undefined : cpf,
      endereco:
        etapa === "dados"
          ? undefined
          : { cep: cepEndereco, rua, numero, complemento, bairro, cidade, uf: uf.toUpperCase() },
      frete:
        etapa !== "dados" && freteSelecionado
          ? {
              servico: freteSelecionado.servico,
              transportadora: freteSelecionado.transportadora,
              preco: precoFreteEfetivo
            }
          : undefined,
      itens: itens.map((i) => ({
        id: idVarianteProduto(i.produto.id, i.cor, i.tamanho),
        nome: i.produto.nome,
        marca: i.produto.marca,
        cor: i.cor,
        tamanho: i.tamanho,
        quantidade: i.quantidade,
        preco: i.produto.preco,
        imagem: i.produto.cores?.find((c) => c.cor === i.cor)?.imagens?.[0] ?? i.produto.imagem
      })),
      subtotal: totalComDesconto,
      total: etapa === "dados" ? totalComDesconto : totalFinal,
      numeroPedido
    };
    fetch("/api/checkout/salvar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corpo),
      keepalive: true
    })
      .then((r) => r.json())
      .then((d) => {
        // esse checkout ja' virou um pedido pago (compra anterior) - comeca uma linha nova
        if (d?.renovar && tentativa === 0) {
          identidade.current = novaIdentidade();
          salvarEtapa(etapa, numeroPedido, 1);
        }
      })
      .catch(() => {});
  }

  function continuarDados() {
    if (!dadosValidos) {
      setErro(
        !nomeValido
          ? "Preencha seu nome completo (nome e sobrenome)"
          : !telefoneValido
            ? "Preencha o WhatsApp com DDD"
            : "Preencha um e-mail válido"
      );
      return;
    }
    setErro(null);
    salvarEtapa("dados");
    // InitiateCheckout/begin_checkout agora dispara quando a cliente comeca o checkout de
    // verdade (conclui a etapa 1), uma vez por visita - antes so' disparava no clique final.
    if (!checkoutRastreado.current) {
      checkoutRastreado.current = true;
      rastrearIniciarCheckout(
        itens.map((i) => ({
          id: idVarianteProduto(i.produto.id, i.cor, i.tamanho),
          nome: i.produto.nome,
          marca: i.produto.marca,
          preco: i.produto.preco,
          quantidade: i.quantidade
        }))
      );
    }
    setDadosConcluidos(true);
    setEtapaAberta(entregaConcluida && entregaValida ? "pagamento" : "entrega");
  }

  function continuarEntrega() {
    if (!entregaValida) {
      setErro(
        !cpfValido
          ? "Preencha um CPF válido (vai na nota fiscal)"
          : freteSelecionado === null
            ? "Calcule o frete pelo CEP e escolha uma opção de entrega"
            : "Preencha o endereço completo (rua, número, bairro, cidade e UF)"
      );
      return;
    }
    setErro(null);
    salvarEtapa("entrega");
    setEntregaConcluida(true);
    setEtapaAberta("pagamento");
  }

  async function aplicarCupom() {
    if (!codigoCupom.trim()) return;
    setValidandoCupom(true);
    try {
      const resposta = await fetch("/api/cupom/validar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codigo: codigoCupom, subtotal: total, cpf })
      });
      const dados = (await resposta.json()) as ResultadoCupom;
      setCupomAplicado(dados);
    } catch {
      setCupomAplicado({ valido: false, motivo: "Não foi possível validar o cupom" });
    } finally {
      setValidandoCupom(false);
    }
  }

  async function finalizarCompra() {
    if (!podeFinalizar) {
      setErro("Confira seus dados e o endereço de entrega antes de pagar");
      setEtapaAberta(!dadosValidos ? "dados" : "entrega");
      return;
    }
    setErro(null);
    setCarregando(true);
    try {
      const resposta = await fetch("/api/mercadopago/criar-preferencia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itens,
          cupomCodigo: cupomAplicado?.valido ? cupomAplicado.cupom.codigo : undefined,
          cliente: {
            nomeCompleto: nomeCompleto.trim(),
            cpf,
            email: email.trim(),
            telefone: telefone.trim(),
            endereco: {
              cep: cepEndereco,
              rua: rua.trim(),
              numero: numero.trim(),
              complemento: complemento.trim() || undefined,
              bairro: bairro.trim(),
              cidade: cidade.trim(),
              uf: uf.trim().toUpperCase()
            }
          },
          frete: freteSelecionado
            ? {
                servico: freteSelecionado.servico,
                transportadora: freteSelecionado.transportadora,
                preco: precoFreteEfetivo
              }
            : undefined,
          creditoSolicitado: creditoAplicado > 0 ? creditoAplicado : undefined
        })
      });
      const dados = await resposta.json();
      if (!resposta.ok) throw new Error(dados.erro ?? "Erro ao iniciar pagamento");
      // grava "chegou no pagamento" + o numero do pedido - e' assim que o painel sabe, depois,
      // se esse checkout virou pedido pago (o webhook grava o pedido com esse mesmo numero)
      salvarEtapa("pagamento", dados.numeroPedido);
      window.location.href = dados.initPoint;
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao iniciar pagamento");
      setCarregando(false);
    }
  }

  if (itens.length === 0) {
    return <p className="py-16 text-center text-mozz-gray text-[14.5px]">Seu carrinho esta vazio.</p>;
  }

  const resumoDados = [nomeCompleto.trim(), telefone, email.trim()].filter(Boolean).join(" · ");
  const resumoEntrega = freteSelecionado
    ? `${ehRetirada(freteSelecionado) ? "Retirada na loja" : `${rua.trim()}, ${numero.trim()} — ${cidade.trim()}/${uf.toUpperCase()}`} · ${
        freteSelecionado.transportadora
      } ${precoFreteEfetivo === 0 ? "grátis" : formatarPreco(precoFreteEfetivo)}`
    : "";

  return (
    <section className="py-8 max-w-xl">
      <p className="font-serif text-3xl mb-2">Carrinho</p>
      <AvisoFreteGratis limiar={configLoja?.freteGratisAcimaDe ?? null} subtotal={totalComDesconto} />
      {totalFinal > 0 && (
        <div className="flex items-center gap-2 text-[13px] px-3 py-2 border mt-3 bg-mozz-stone border-black/10 text-mozz-black">
          <span>
            Você ganha {formatarPreco(Math.round(totalFinal * PERCENTUAL_CASHBACK * 100) / 100)} de
            cashback nessa compra.{" "}
            <a href="/cashback" className="underline">
              Como funciona
            </a>
          </span>
        </div>
      )}
      <div className="divide-y divide-black/10 mt-6">
        {itens.map((item) => (
          <div
            key={`${item.produto.id}-${item.cor}-${item.tamanho}`}
            className="flex justify-between py-4 text-[14.5px]"
          >
            <div>
              <p>{item.produto.nome}</p>
              <p className="text-mozz-gray mb-2">
                {item.cor && item.cor !== "Único" ? `Cor ${item.cor} · ` : ""}
                Tam. {item.tamanho}
              </p>
              <div className="flex items-center border border-black/20 w-fit">
                <button
                  onClick={() =>
                    atualizarQuantidade(item.produto.id, item.cor, item.tamanho, item.quantidade - 1)
                  }
                  aria-label="Diminuir quantidade"
                  className="w-7 h-7 flex items-center justify-center hover:bg-black/5"
                >
                  −
                </button>
                <span className="w-8 text-center">{item.quantidade}</span>
                <button
                  onClick={() =>
                    atualizarQuantidade(item.produto.id, item.cor, item.tamanho, item.quantidade + 1)
                  }
                  aria-label="Aumentar quantidade"
                  className="w-7 h-7 flex items-center justify-center hover:bg-black/5"
                >
                  +
                </button>
              </div>
            </div>
            <div className="text-right">
              <p>{formatarPreco(item.produto.preco * item.quantidade)}</p>
              <button
                onClick={() => remover(item.produto.id, item.cor, item.tamanho)}
                className="text-mozz-gray underline mt-1"
              >
                Remover
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4">
        <label htmlFor="cupom-codigo" className="text-[13.5px] text-mozz-gray mb-2 block">
          Cupom de desconto
        </label>
        <div className="flex gap-2">
          <input
            id="cupom-codigo"
            value={codigoCupom}
            onChange={(e) => setCodigoCupom(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && aplicarCupom()}
            placeholder="Código do cupom"
            className="flex-1 border border-black/20 px-3 py-2 text-[14.5px] uppercase focus:outline-none focus:border-mozz-black"
          />
          <button
            onClick={aplicarCupom}
            disabled={validandoCupom}
            className="text-[13.5px] px-4 border border-mozz-black hover:bg-mozz-black hover:text-white transition-colors disabled:opacity-60"
          >
            {validandoCupom ? "..." : "Aplicar"}
          </button>
        </div>
        {cupomAplicado && !cupomAplicado.valido && (
          <p className="text-[13.5px] text-red-600 mt-2">{cupomAplicado.motivo}</p>
        )}
        {cupomAplicado?.valido && (
          <p className="text-[13.5px] text-green-700 mt-2">
            Cupom {cupomAplicado.cupom.codigo} aplicado: -{formatarPreco(cupomAplicado.desconto)}
          </p>
        )}
      </div>

      <div className="flex justify-between pt-4 mt-4 border-t border-black/10 text-[14.5px]">
        <span className="text-mozz-gray">Subtotal</span>
        <span>{formatarPreco(totalComDesconto)}</span>
      </div>

      {/* ---------------- Etapa 1: Seus dados ---------------- */}
      <div className="mt-6 border border-black/15 p-4">
        <CabecalhoEtapa
          numero={1}
          titulo="Seus dados"
          ativa={etapaAberta === "dados"}
          concluida={dadosConcluidos}
          resumo={resumoDados}
          onAlterar={() => {
            setErro(null);
            setEtapaAberta("dados");
          }}
        />
        <div className={etapaAberta === "dados" ? "mt-4 flex flex-col gap-2" : "hidden"}>
          <label htmlFor="checkout-nome" className="sr-only">
            Nome completo
          </label>
          <input
            id="checkout-nome"
            value={nomeCompleto}
            onChange={(e) => setNomeCompleto(e.target.value)}
            placeholder="Nome completo"
            autoComplete="name"
            className={classeCampo}
          />
          <label htmlFor="checkout-telefone" className="sr-only">
            WhatsApp com DDD
          </label>
          <input
            id="checkout-telefone"
            type="tel"
            inputMode="numeric"
            value={telefone}
            onChange={(e) => setTelefone(formatarTelefone(e.target.value))}
            placeholder="WhatsApp (com DDD)"
            autoComplete="tel-national"
            className={classeCampo}
          />
          <label htmlFor="checkout-email" className="sr-only">
            E-mail
          </label>
          <input
            id="checkout-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="E-mail"
            autoComplete="email"
            className={classeCampo}
          />
          <label className="flex items-start gap-2 text-[13.5px] text-mozz-gray mt-1 cursor-pointer">
            <input
              type="checkbox"
              checked={aceitaMarketing}
              onChange={(e) => setAceitaMarketing(e.target.checked)}
              className="mt-0.5 accent-mozz-black"
            />
            Quero receber novidades e ofertas da Mozz pelo WhatsApp
          </label>
          {etapaAberta === "dados" && erro && <p className="text-[13.5px] text-red-600">{erro}</p>}
          <button onClick={continuarDados} className="w-full text-[14.5px] py-3 mt-2 bg-mozz-black text-white">
            Continuar
          </button>
          <p className="text-[12.5px] text-mozz-gray text-center">
            Usamos seu contato só para falar sobre este pedido.
          </p>
        </div>
      </div>

      {/* ---------------- Etapa 2: Entrega ---------------- */}
      <div className="mt-3 border border-black/15 p-4">
        <CabecalhoEtapa
          numero={2}
          titulo="Entrega"
          ativa={etapaAberta === "entrega"}
          concluida={entregaConcluida}
          resumo={resumoEntrega}
          onAlterar={() => {
            setErro(null);
            setEtapaAberta("entrega");
          }}
        />
        <div className={etapaAberta === "entrega" ? "mt-4" : "hidden"}>
          <label htmlFor="checkout-cpf" className="sr-only">
            CPF
          </label>
          <input
            id="checkout-cpf"
            value={cpf}
            inputMode="numeric"
            onChange={(e) => setCpf(formatarCpf(e.target.value))}
            placeholder="CPF (para a nota fiscal)"
            maxLength={14}
            className={`w-full ${classeCampo}`}
          />
          {cpf.length === 14 && !cpfValido && <p className="text-[13px] text-red-600 mt-1">CPF inválido</p>}

          <CalculoFrete
            quantidadeItens={quantidadeTotal}
            selecionavel
            opcaoSelecionada={freteSelecionado}
            onSelecionar={setFreteSelecionado}
            onCepCalculado={aoCalcularFrete}
            configLoja={configLoja}
            subtotal={totalComDesconto}
          />

          <p className="text-[13.5px] text-mozz-gray mt-4 mb-2">
            Endereço de entrega {buscandoCep && "· buscando pelo CEP..."}
          </p>
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <label htmlFor="checkout-rua" className="sr-only">
                Rua
              </label>
              <input
                id="checkout-rua"
                value={rua}
                onChange={(e) => setRua(e.target.value)}
                placeholder="Rua"
                autoComplete="address-line1"
                className={`flex-[3] min-w-0 ${classeCampo}`}
              />
              <label htmlFor="checkout-numero" className="sr-only">
                Número
              </label>
              <input
                id="checkout-numero"
                value={numero}
                onChange={(e) => setNumero(e.target.value)}
                placeholder="Número"
                className={`flex-1 min-w-0 ${classeCampo}`}
              />
            </div>
            <label htmlFor="checkout-complemento" className="sr-only">
              Complemento
            </label>
            <input
              id="checkout-complemento"
              value={complemento}
              onChange={(e) => setComplemento(e.target.value)}
              placeholder="Complemento (opcional)"
              autoComplete="address-line2"
              className={classeCampo}
            />
            <div className="flex gap-2">
              <label htmlFor="checkout-bairro" className="sr-only">
                Bairro
              </label>
              <input
                id="checkout-bairro"
                value={bairro}
                onChange={(e) => setBairro(e.target.value)}
                placeholder="Bairro"
                className={`flex-[2] min-w-0 ${classeCampo}`}
              />
              <label htmlFor="checkout-cidade" className="sr-only">
                Cidade
              </label>
              <input
                id="checkout-cidade"
                value={cidade}
                onChange={(e) => setCidade(e.target.value)}
                placeholder="Cidade"
                autoComplete="address-level2"
                className={`flex-[2] min-w-0 ${classeCampo}`}
              />
              <label htmlFor="checkout-uf" className="sr-only">
                UF
              </label>
              <input
                id="checkout-uf"
                value={uf}
                onChange={(e) => setUf(e.target.value.toUpperCase().slice(0, 2))}
                placeholder="UF"
                maxLength={2}
                autoComplete="address-level1"
                className={`flex-1 min-w-0 uppercase ${classeCampo}`}
              />
            </div>
          </div>
          {etapaAberta === "entrega" && erro && <p className="text-[13.5px] text-red-600 mt-3">{erro}</p>}
          <button onClick={continuarEntrega} className="w-full text-[14.5px] py-3 mt-4 bg-mozz-black text-white">
            Continuar para pagamento
          </button>
        </div>
      </div>

      {/* ---------------- Etapa 3: Pagamento ---------------- */}
      <div className="mt-3 border border-black/15 p-4">
        <CabecalhoEtapa numero={3} titulo="Pagamento" ativa={etapaAberta === "pagamento"} concluida={false} />
        <div className={etapaAberta === "pagamento" ? "mt-4" : "hidden"}>
          {cpfValido && creditoDisponivel > 0 && (
            <div className="mb-4">
              <p className="text-[13.5px] text-mozz-gray mb-2">
                Você tem {formatarPreco(creditoDisponivel)} de crédito de loja disponível
              </p>
              <div className="flex gap-2">
                <label htmlFor="checkout-credito" className="sr-only">
                  Valor de crédito a usar
                </label>
                <input
                  id="checkout-credito"
                  type="number"
                  min={0}
                  max={creditoMaximoAplicavel}
                  step="0.01"
                  value={valorCreditoUsar}
                  onChange={(e) => setValorCreditoUsar(e.target.value)}
                  placeholder={`Até ${formatarPreco(creditoMaximoAplicavel)}`}
                  className={`flex-1 min-w-0 ${classeCampo}`}
                />
                <button
                  onClick={() => setValorCreditoUsar(String(creditoMaximoAplicavel))}
                  className="text-[13.5px] px-4 border border-mozz-black hover:bg-mozz-black hover:text-white transition-colors"
                >
                  Usar máximo
                </button>
              </div>
              <p className="text-[13px] text-mozz-gray mt-1">Dá pra usar até 30% do valor deste pedido em crédito.</p>
            </div>
          )}

          <div>
            {desconto > 0 && (
              <div className="flex justify-between py-1 text-[14.5px] text-mozz-gray">
                <span>Subtotal</span>
                <span>{formatarPreco(total)}</span>
              </div>
            )}
            {desconto > 0 && (
              <div className="flex justify-between py-1 text-[14.5px] text-green-700">
                <span>Desconto</span>
                <span>-{formatarPreco(desconto)}</span>
              </div>
            )}
            {desconto === 0 && (
              <div className="flex justify-between py-1 text-[14.5px] text-mozz-gray">
                <span>Produtos</span>
                <span>{formatarPreco(total)}</span>
              </div>
            )}
            <div className="flex justify-between py-1 text-[14.5px] text-mozz-gray">
              <span>Frete</span>
              <span>
                {freteSelecionado ? (precoFreteEfetivo === 0 ? "Grátis" : formatarPreco(precoFreteEfetivo)) : "a calcular"}
              </span>
            </div>
            {creditoAplicado > 0 && (
              <div className="flex justify-between py-1 text-[14.5px] text-green-700">
                <span>Crédito de loja</span>
                <span>-{formatarPreco(creditoAplicado)}</span>
              </div>
            )}
            <div className="flex justify-between py-3 text-[16px] border-t border-black/10 mt-2">
              <span>Total</span>
              <span>{formatarPreco(totalFinal)}</span>
            </div>
          </div>

          {etapaAberta === "pagamento" && erro && <p className="text-[13.5px] text-red-600 mb-2">{erro}</p>}
          <button
            onClick={finalizarCompra}
            disabled={carregando}
            className="w-full text-[14.5px] py-3 bg-mozz-black text-white disabled:opacity-60"
          >
            {carregando ? "Abrindo o pagamento..." : "Ir para o pagamento"}
          </button>
          <p className="text-[12.5px] text-mozz-gray text-center mt-2">
            Pix ou cartão
            {parcelamentoTotal ? ` em até ${parcelamentoTotal.parcelas}x sem juros` : ""}. Você conclui no
            ambiente seguro do Mercado Pago e volta pra Mozz.
          </p>
        </div>
      </div>
    </section>
  );
}

"use client";

import { useCart } from "@/lib/cart-context";
import { idVarianteProduto } from "@/lib/produtos";
import { formatarPreco } from "@/lib/formato";
import { useEffect, useState } from "react";
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

export default function PaginaCarrinho() {
  const { itens, remover, atualizarQuantidade, total } = useCart();
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

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
  const [telefone, setTelefone] = useState("");

  // Endereco de entrega - sem isso o pedido aprovado nao tem pra onde ser enviado (bug
  // encontrado na venda teste de 25/08/2026: o checkout so' pedia CEP pra calcular o frete,
  // nunca o endereco completo). Rua/bairro/cidade/UF sao preenchidos automaticamente pelo
  // CEP usado no calculo de frete (ver CalculoFrete.tsx -> onCepCalculado), mas continuam
  // editaveis - o cliente confere/corrige antes de finalizar. Numero e' sempre manual (o
  // ViaCEP nao devolve numero de casa).
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
      if (meta.nome_completo) setNomeCompleto(meta.nome_completo);
      if (meta.cpf) setCpf(meta.cpf);
      if (meta.telefone) setTelefone(meta.telefone);
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

  const cpfValido = validarCpf(cpf);
  const enderecoCompleto =
    rua.trim().length > 2 && numero.trim().length > 0 && bairro.trim().length > 1 &&
    cidade.trim().length > 1 && uf.trim().length === 2;
  const podeFinalizar =
    nomeCompleto.trim().length > 3 && cpfValido && freteSelecionado !== null && enderecoCompleto;

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
      setErro(
        freteSelecionado === null
          ? "Calcule o frete pelo CEP e escolha uma opção de entrega antes de continuar"
          : !enderecoCompleto
            ? "Preencha o endereço de entrega completo (rua, número, bairro, cidade e UF)"
            : "Preencha nome completo e CPF válidos"
      );
      return;
    }
    setErro(null);
    setCarregando(true);
    // dispara InitiateCheckout/begin_checkout ANTES de redirecionar pro Mercado Pago - depois
    // do redirect a pagina ja saiu do ar e o evento nunca dispararia.
    rastrearIniciarCheckout(
      itens.map((i) => ({
        id: idVarianteProduto(i.produto.id, i.cor, i.tamanho),
        nome: i.produto.nome,
        marca: i.produto.marca,
        preco: i.produto.preco,
        quantidade: i.quantidade
      }))
    );
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
            telefone: telefone || undefined,
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
      window.location.href = dados.initPoint;
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao iniciar pagamento");
      setCarregando(false);
    }
  }

  if (itens.length === 0) {
    return <p className="py-16 text-center text-mozz-gray text-[14.5px]">Seu carrinho esta vazio.</p>;
  }

  return (
    <section className="py-8 max-w-xl">
      <p className="font-serif text-3xl mb-2">Carrinho</p>
      <AvisoFreteGratis limiar={configLoja?.freteGratisAcimaDe ?? null} subtotal={totalComDesconto} />
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
        <p className="text-[13.5px] text-mozz-gray mb-2">Cupom de desconto</p>
        <div className="flex gap-2">
          <input
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

      <CalculoFrete
        quantidadeItens={quantidadeTotal}
        selecionavel
        opcaoSelecionada={freteSelecionado}
        onSelecionar={setFreteSelecionado}
        onCepCalculado={aoCalcularFrete}
        configLoja={configLoja}
        subtotal={totalComDesconto}
      />

      <div className="mt-6 pt-6 border-t border-black/10">
        <p className="text-[13.5px] text-mozz-gray mb-2">Dados pra entrega e nota fiscal</p>
        <div className="flex flex-col gap-2">
          <input
            value={nomeCompleto}
            onChange={(e) => setNomeCompleto(e.target.value)}
            placeholder="Nome completo"
            className="border border-black/20 px-3 py-2 text-[14.5px] focus:outline-none focus:border-mozz-black"
          />
          <input
            value={cpf}
            onChange={(e) => setCpf(formatarCpf(e.target.value))}
            placeholder="CPF"
            maxLength={14}
            className="border border-black/20 px-3 py-2 text-[14.5px] focus:outline-none focus:border-mozz-black"
          />
          {cpf.length === 14 && !cpfValido && <p className="text-[13px] text-red-600">CPF inválido</p>}
          <input
            value={telefone}
            onChange={(e) => setTelefone(e.target.value)}
            placeholder="Telefone (opcional)"
            className="border border-black/20 px-3 py-2 text-[14.5px] focus:outline-none focus:border-mozz-black"
          />
        </div>

        {cpfValido && creditoDisponivel > 0 && (
          <div className="mt-4">
            <p className="text-[13.5px] text-mozz-gray mb-2">
              Você tem {formatarPreco(creditoDisponivel)} de crédito de loja disponível
            </p>
            <div className="flex gap-2">
              <input
                type="number"
                min={0}
                max={creditoMaximoAplicavel}
                step="0.01"
                value={valorCreditoUsar}
                onChange={(e) => setValorCreditoUsar(e.target.value)}
                placeholder={`Até ${formatarPreco(creditoMaximoAplicavel)}`}
                className="flex-1 border border-black/20 px-3 py-2 text-[14.5px] focus:outline-none focus:border-mozz-black"
              />
              <button
                onClick={() => setValorCreditoUsar(String(creditoMaximoAplicavel))}
                className="text-[13.5px] px-4 border border-mozz-black hover:bg-mozz-black hover:text-white transition-colors"
              >
                Usar máximo
              </button>
            </div>
            <p className="text-[13px] text-mozz-gray mt-1">
              Dá pra usar até 30% do valor deste pedido em crédito.
            </p>
          </div>
        )}

        <p className="text-[13.5px] text-mozz-gray mt-4 mb-2">
          Endereço de entrega {buscandoCep && "· buscando pelo CEP..."}
        </p>
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <input
              value={rua}
              onChange={(e) => setRua(e.target.value)}
              placeholder="Rua"
              className="flex-[3] border border-black/20 px-3 py-2 text-[14.5px] focus:outline-none focus:border-mozz-black"
            />
            <input
              value={numero}
              onChange={(e) => setNumero(e.target.value)}
              placeholder="Número"
              className="flex-1 border border-black/20 px-3 py-2 text-[14.5px] focus:outline-none focus:border-mozz-black"
            />
          </div>
          <input
            value={complemento}
            onChange={(e) => setComplemento(e.target.value)}
            placeholder="Complemento (opcional)"
            className="border border-black/20 px-3 py-2 text-[14.5px] focus:outline-none focus:border-mozz-black"
          />
          <div className="flex gap-2">
            <input
              value={bairro}
              onChange={(e) => setBairro(e.target.value)}
              placeholder="Bairro"
              className="flex-[2] border border-black/20 px-3 py-2 text-[14.5px] focus:outline-none focus:border-mozz-black"
            />
            <input
              value={cidade}
              onChange={(e) => setCidade(e.target.value)}
              placeholder="Cidade"
              className="flex-[2] border border-black/20 px-3 py-2 text-[14.5px] focus:outline-none focus:border-mozz-black"
            />
            <input
              value={uf}
              onChange={(e) => setUf(e.target.value.toUpperCase().slice(0, 2))}
              placeholder="UF"
              maxLength={2}
              className="flex-1 border border-black/20 px-3 py-2 text-[14.5px] uppercase focus:outline-none focus:border-mozz-black"
            />
          </div>
        </div>
      </div>

      <div className="mt-2">
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
        <div className="flex justify-between py-1 text-[14.5px] text-mozz-gray">
          <span>Frete</span>
          <span>{freteSelecionado ? formatarPreco(precoFreteEfetivo) : "a calcular"}</span>
        </div>
        {creditoAplicado > 0 && (
          <div className="flex justify-between py-1 text-[14.5px] text-green-700">
            <span>Crédito de loja</span>
            <span>-{formatarPreco(creditoAplicado)}</span>
          </div>
        )}
        <div className="flex justify-between py-4 text-[16px] border-t border-black/10 mt-2">
          <span>Total</span>
          <span>{formatarPreco(totalFinal)}</span>
        </div>
      </div>

      {erro && <p className="text-[13.5px] text-red-600 mb-2">{erro}</p>}
      <button
        onClick={finalizarCompra}
        disabled={carregando}
        className="w-full text-[14.5px] py-3 bg-mozz-black text-white disabled:opacity-60"
      >
        {carregando ? "Redirecionando..." : "Finalizar compra"}
      </button>
    </section>
  );
}

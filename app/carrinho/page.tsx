"use client";

import { useCart } from "@/lib/cart-context";
import { formatarPreco } from "@/lib/formato";
import { useState } from "react";
import CalculoFrete from "@/components/CalculoFrete";
import { rastrearIniciarCheckout } from "@/lib/tracking";

type ResultadoCupom =
  | { valido: true; cupom: { codigo: string; tipo: "percentual" | "fixo"; valor: number }; desconto: number }
  | { valido: false; motivo: string };

export default function PaginaCarrinho() {
  const { itens, remover, total } = useCart();
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [codigoCupom, setCodigoCupom] = useState("");
  const [cupomAplicado, setCupomAplicado] = useState<ResultadoCupom | null>(null);
  const [validandoCupom, setValidandoCupom] = useState(false);

  const quantidadeTotal = itens.reduce((soma, i) => soma + i.quantidade, 0);
  const desconto = cupomAplicado?.valido ? cupomAplicado.desconto : 0;
  const totalComDesconto = Math.max(0, total - desconto);

  async function aplicarCupom() {
    if (!codigoCupom.trim()) return;
    setValidandoCupom(true);
    try {
      const resposta = await fetch("/api/cupom/validar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codigo: codigoCupom, subtotal: total })
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
    setErro(null);
    setCarregando(true);
    // dispara InitiateCheckout/begin_checkout ANTES de redirecionar pro Mercado Pago - depois
    // do redirect a pagina ja saiu do ar e o evento nunca dispararia.
    rastrearIniciarCheckout(
      itens.map((i) => ({
        id: i.produto.id,
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
          cupomCodigo: cupomAplicado?.valido ? cupomAplicado.cupom.codigo : undefined
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
      <p className="font-serif text-3xl mb-6">Carrinho</p>
      <div className="divide-y divide-black/10">
        {itens.map((item) => (
          <div
            key={`${item.produto.id}-${item.cor}-${item.tamanho}`}
            className="flex justify-between py-4 text-[14.5px]"
          >
            <div>
              <p>{item.produto.nome}</p>
              <p className="text-mozz-gray">
                {item.cor && item.cor !== "Único" ? `Cor ${item.cor} · ` : ""}
                Tam. {item.tamanho} · Qtd. {item.quantidade}
              </p>
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
        <div className="flex justify-between py-4 text-[16px] border-t border-black/10 mt-2">
          <span>Total</span>
          <span>{formatarPreco(totalComDesconto)}</span>
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

      <CalculoFrete quantidadeItens={quantidadeTotal} />
    </section>
  );
}

"use client";

import { useCart } from "@/lib/cart-context";
import { formatarPreco } from "@/lib/formato";
import { useState } from "react";

export default function PaginaCarrinho() {
  const { itens, remover, total } = useCart();
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function finalizarCompra() {
    setErro(null);
    setCarregando(true);
    try {
      const resposta = await fetch("/api/mercadopago/criar-preferencia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itens })
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
    return <p className="py-16 text-center text-mozz-gray text-[13px]">Seu carrinho esta vazio.</p>;
  }

  return (
    <section className="py-8 max-w-xl">
      <p className="font-serif text-2xl mb-6">Carrinho</p>
      <div className="divide-y divide-black/10">
        {itens.map((item) => (
          <div key={`${item.produto.id}-${item.tamanho}`} className="flex justify-between py-4 text-[13px]">
            <div>
              <p>{item.produto.nome}</p>
              <p className="text-mozz-gray">Tam. {item.tamanho} · Qtd. {item.quantidade}</p>
            </div>
            <div className="text-right">
              <p>{formatarPreco(item.produto.preco * item.quantidade)}</p>
              <button
                onClick={() => remover(item.produto.id, item.tamanho)}
                className="text-mozz-gray underline mt-1"
              >
                Remover
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="flex justify-between py-4 text-[14px] border-t border-black/10 mt-2">
        <span>Total</span>
        <span>{formatarPreco(total)}</span>
      </div>
      {erro && <p className="text-[12px] text-red-600 mb-2">{erro}</p>}
      <button
        onClick={finalizarCompra}
        disabled={carregando}
        className="w-full text-[13px] py-3 bg-mozz-black text-white disabled:opacity-60"
      >
        {carregando ? "Redirecionando..." : "Finalizar compra"}
      </button>
    </section>
  );
}

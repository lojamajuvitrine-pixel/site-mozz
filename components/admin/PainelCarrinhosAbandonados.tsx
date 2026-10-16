"use client";

import { useMemo, useState } from "react";
import { formatarPreco } from "@/lib/formato";

type ItemCheckout = {
  nome: string | null;
  marca: string | null;
  cor: string | null;
  tamanho: string | null;
  quantidade: number;
  preco: number | null;
  imagem: string | null;
};

export type LinhaCheckout = {
  id: string;
  criado_em: string;
  atualizado_em: string;
  etapa: "dados" | "entrega" | "pagamento";
  nome: string | null;
  whatsapp: string | null;
  email: string | null;
  aceita_marketing: boolean;
  cpf: string | null;
  endereco: { cidade?: string | null; uf?: string | null } | null;
  frete: { transportadora?: string | null; preco?: number | null } | null;
  itens: ItemCheckout[] | null;
  subtotal: number | null;
  total: number | null;
  pago: boolean;
};

type Filtro = "abertos" | "pagos" | "todos";

const NOME_ETAPA: Record<LinhaCheckout["etapa"], string> = {
  dados: "Dados",
  entrega: "Entrega",
  pagamento: "Pagamento"
};

// Quem manda a mensagem - trocar aqui se outra vendedora for cuidar dos carrinhos.
const QUEM_CHAMA = "Eloísa";

function ha(dataIso: string): string {
  const minutos = Math.max(0, Math.round((Date.now() - new Date(dataIso).getTime()) / 60000));
  if (minutos < 60) return `${minutos} min`;
  const horas = Math.round(minutos / 60);
  if (horas < 24) return `${horas} h`;
  const dias = Math.round(horas / 24);
  return dias === 1 ? "1 dia" : `${dias} dias`;
}

function primeiroNome(nome: string | null): string {
  const p = (nome ?? "").trim().split(/\s+/)[0] ?? "";
  return p ? p.charAt(0).toUpperCase() + p.slice(1).toLowerCase() : "";
}

function descricaoItem(i: ItemCheckout): string {
  const detalhes = [i.cor && i.cor !== "Único" ? i.cor : null, i.tamanho ? `tam. ${i.tamanho}` : null]
    .filter(Boolean)
    .join(", ");
  return `${i.nome ?? "peça"}${detalhes ? ` (${detalhes})` : ""}`;
}

function resumoPecas(itens: ItemCheckout[]): string {
  if (itens.length === 0) return "algumas peças";
  const qtd = itens.reduce((s, i) => s + (i.quantidade || 1), 0);
  if (itens.length === 1) {
    const i = itens[0];
    return `${i.quantidade > 1 ? `${i.quantidade}x ` : ""}${descricaoItem(i)}`;
  }
  const nomes = itens.slice(0, 3).map(descricaoItem);
  const lista = nomes.length > 1 ? `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}` : nomes[0];
  return `${qtd} peças: ${lista}${itens.length > 3 ? " e mais" : ""}`;
}

function linkWhatsApp(linha: LinhaCheckout): string | null {
  let d = (linha.whatsapp ?? "").replace(/\D/g, "");
  if (d.length === 10 || d.length === 11) d = `55${d}`;
  if (d.length < 12) return null;
  const nome = primeiroNome(linha.nome);
  const mensagem =
    `Oi${nome ? ` ${nome}` : ""}, aqui é a ${QUEM_CHAMA} da Mozz! ` +
    `Vi que você separou ${resumoPecas(linha.itens ?? [])}. ` +
    `Posso te ajudar a finalizar? Se quiser, te mando o Pix por aqui.`;
  return `https://wa.me/${d}?text=${encodeURIComponent(mensagem)}`;
}

export default function PainelCarrinhosAbandonados({ linhas }: { linhas: LinhaCheckout[] }) {
  const [filtro, setFiltro] = useState<Filtro>("abertos");

  // Linhas sem nenhuma peca nao interessam (cliente esvaziou o carrinho no meio)
  const validas = useMemo(() => linhas.filter((l) => (l.itens ?? []).length > 0), [linhas]);
  const abertos = validas.filter((l) => !l.pago);
  const pagos = validas.filter((l) => l.pago);
  const visiveis = filtro === "abertos" ? abertos : filtro === "pagos" ? pagos : validas;
  const valorEmAberto = abertos.reduce((s, l) => s + Number(l.total ?? l.subtotal ?? 0), 0);

  const abas: { chave: Filtro; rotulo: string; qtd: number }[] = [
    { chave: "abertos", rotulo: "Não finalizados", qtd: abertos.length },
    { chave: "pagos", rotulo: "Pagos", qtd: pagos.length },
    { chave: "todos", rotulo: "Todos", qtd: validas.length }
  ];

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-4">
        {abas.map((a) => (
          <button
            key={a.chave}
            onClick={() => setFiltro(a.chave)}
            className={`text-[13.5px] px-3 py-1.5 border ${
              filtro === a.chave ? "bg-mozz-black text-white border-mozz-black" : "border-black/20"
            }`}
          >
            {a.rotulo} ({a.qtd})
          </button>
        ))}
      </div>
      {filtro === "abertos" && abertos.length > 0 && (
        <p className="text-[13.5px] text-mozz-gray mb-4">
          {formatarPreco(valorEmAberto)} parados em carrinhos não finalizados.
        </p>
      )}

      {visiveis.length === 0 ? (
        <p className="text-[14.5px] text-mozz-gray py-8">Nada por aqui ainda.</p>
      ) : (
        <div className="divide-y divide-black/10 border-y border-black/10">
          {visiveis.map((l) => {
            const link = linkWhatsApp(l);
            const itens = l.itens ?? [];
            const qtd = itens.reduce((s, i) => s + (i.quantidade || 1), 0);
            return (
              <div key={l.id} className="py-4 grid gap-3 md:grid-cols-[1.4fr_1.6fr_0.7fr_0.7fr_0.5fr_auto] md:items-center">
                <div>
                  <p className="text-[14.5px]">{l.nome ?? "Sem nome"}</p>
                  <p className="text-[13px] text-mozz-gray">{l.whatsapp ?? "sem WhatsApp"}</p>
                  {l.email && <p className="text-[12.5px] text-mozz-gray break-all">{l.email}</p>}
                  {l.aceita_marketing && <p className="text-[12px] text-green-700">aceita ofertas</p>}
                </div>
                <div className="flex items-center gap-2">
                  {itens[0]?.imagem && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={itens[0].imagem} alt="" className="w-10 h-12 object-cover bg-mozz-stone shrink-0" />
                  )}
                  <p className="text-[13px] text-mozz-gray">
                    {qtd} {qtd === 1 ? "peça" : "peças"} · {itens.slice(0, 2).map(descricaoItem).join("; ")}
                    {itens.length > 2 ? "…" : ""}
                  </p>
                </div>
                <p className="text-[14.5px]">{formatarPreco(Number(l.total ?? l.subtotal ?? 0))}</p>
                <p className="text-[13.5px]">
                  <span className="md:hidden text-mozz-gray">Parou em: </span>
                  {NOME_ETAPA[l.etapa]}
                  {l.endereco?.cidade && (
                    <span className="block text-[12.5px] text-mozz-gray">
                      {l.endereco.cidade}/{l.endereco.uf}
                    </span>
                  )}
                </p>
                <p className="text-[13px] text-mozz-gray">há {ha(l.atualizado_em)}</p>
                <div>
                  {l.pago ? (
                    <span className="text-[13.5px] text-green-700">Pago ✓</span>
                  ) : link ? (
                    <a
                      href={link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block text-[13.5px] px-3 py-2 bg-[#25D366] text-white whitespace-nowrap"
                    >
                      Chamar no WhatsApp
                    </a>
                  ) : (
                    <span className="text-[13px] text-mozz-gray">WhatsApp inválido</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

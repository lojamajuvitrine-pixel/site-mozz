import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import GradeProdutos from "@/components/GradeProdutos";
import { listarOutlet, type Produto } from "@/lib/produtos";
import { blackNovemberAtiva, FRETE_GRATIS_BLACK_NOVEMBER } from "@/lib/campanha";
import { formatarPreco } from "@/lib/formato";
import { SITE_URL as siteUrl } from "@/lib/site";

// Vitrine da Black November (05/11/2026, textos aprovados pelo Brunno) - as mesmas pecas
// marcadas como "outlet" no painel /admin/produtos, com a peca de maior desconto primeiro.
// Depois do fim da campanha (ver lib/campanha.ts) essa pagina manda pro /outlet de novo.
export const metadata: Metadata = {
  title: "Black November",
  description: "Black November da MOZZ: descontos em Animale, NV, Farm, Reserva e Foxton, até 30/11.",
  alternates: { canonical: `${siteUrl}/black-november` }
};

export const revalidate = 30;

// "Compre do seu jeito" (pedido do Brunno em 05/11/2026): botoes por faixa de desconto. Cada
// botao mostra so' as pecas daquela faixa - "Ate 30%" = ate 30% OFF, "Ate 40%" = de 31% a 40%,
// e assim por diante; "Ate 70%" = 61% ou mais. Faixas de 60% e 70% entraram em 07/11/2026,
// quando a campanha passou a ter pecas com ate 70% OFF. Botao de faixa sem nenhuma peca nao aparece.
const FAIXAS = [
  { chave: "30", rotulo: "30%", min: 0, max: 30 },
  { chave: "40", rotulo: "40%", min: 31, max: 40 },
  { chave: "50", rotulo: "50%", min: 41, max: 50 },
  { chave: "60", rotulo: "60%", min: 51, max: 60 },
  { chave: "70", rotulo: "70%", min: 61, max: 100 }
] as const;

// Colunas da linha de botoes no computador: uma linha so', com o "Ver tudo" junto (classes
// escritas por extenso pro Tailwind enxergar).
const COLUNAS_COMPUTADOR: Record<number, string> = {
  3: "md:grid-cols-3",
  4: "md:grid-cols-4",
  5: "md:grid-cols-5",
  6: "md:grid-cols-6"
};

function percentualDesconto(produto: Produto): number {
  if (!produto.precoOriginal || produto.precoOriginal <= produto.preco) return 0;
  return Math.round((1 - produto.preco / produto.precoOriginal) * 100);
}

function listaDeMarcas(marcas: string[]): string {
  if (marcas.length <= 1) return marcas[0] ?? "";
  return `${marcas.slice(0, -1).join(", ")} e ${marcas.at(-1)}`;
}

export default async function PaginaBlackNovember({
  searchParams
}: {
  searchParams?: { faixa?: string };
}) {
  if (!blackNovemberAtiva()) redirect("/outlet");

  const todos = (await listarOutlet()).sort((a, b) => percentualDesconto(b) - percentualDesconto(a));
  const maiorDesconto = todos.reduce((maior, p) => Math.max(maior, percentualDesconto(p)), 0);
  const marcas = listaDeMarcas(Array.from(new Set(todos.map((p) => p.marca))));

  const faixasComPecas = FAIXAS.filter((f) =>
    todos.some((p) => percentualDesconto(p) >= f.min && percentualDesconto(p) <= f.max)
  );
  const faixaAtiva = faixasComPecas.find((f) => f.chave === searchParams?.faixa);
  const produtos = faixaAtiva
    ? todos.filter((p) => percentualDesconto(p) >= faixaAtiva.min && percentualDesconto(p) <= faixaAtiva.max)
    : todos;

  const classeBotao = (ativo: boolean) =>
    `flex items-center justify-center h-16 md:h-20 text-[15px] md:text-[17px] uppercase tracking-wide transition-colors ${
      ativo ? "bg-mozz-black text-white" : "bg-mozz-stone text-mozz-black hover:bg-black/10"
    }`;

  return (
    <section className="py-8">
      <h1 className="font-serif text-3xl mb-1">Black November</h1>
      <p className="text-[14.5px] text-mozz-gray mb-6">
        {todos.length > 0
          ? `${maiorDesconto > 0 ? `Até ${maiorDesconto}% OFF` : "Ofertas"} em ${marcas}, até 30/11 ou enquanto durar o estoque. São peças únicas: quando acaba, não volta.`
          : "Novas peças entram em breve na Black November."}
      </p>
      {todos.length > 0 && (
        <p className="text-[13.5px] text-mozz-gray -mt-4 mb-6">
          Nas peças da Black November, o frete é grátis em compras acima de {formatarPreco(FRETE_GRATIS_BLACK_NOVEMBER)}.
        </p>
      )}

      {faixasComPecas.length > 1 && (
        <div className="mb-8">
          <p className="text-center text-[16px] md:text-[18px] font-bold uppercase tracking-wide mb-4">
            Compre do seu jeito
          </p>
          <div className={`grid grid-cols-2 ${COLUNAS_COMPUTADOR[faixasComPecas.length + 1] ?? "md:grid-cols-6"} gap-3 md:gap-4`}>
            {faixasComPecas.map((f) => (
              <Link
                key={f.chave}
                href={`/black-november?faixa=${f.chave}`}
                scroll={false}
                className={classeBotao(faixaAtiva?.chave === f.chave)}
              >
                Até <strong className="ml-1.5 font-bold">{f.rotulo}</strong>
              </Link>
            ))}
            <Link href="/black-november" scroll={false} className={`${classeBotao(!faixaAtiva)} font-bold`}>
              Ver tudo
            </Link>
          </div>
        </div>
      )}

      {produtos.length > 0 && <GradeProdutos key={faixaAtiva?.chave ?? "todas"} produtos={produtos} />}
    </section>
  );
}

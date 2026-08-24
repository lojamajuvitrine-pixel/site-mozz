import type { Metadata } from "next";
import GradeProdutos from "@/components/GradeProdutos";
import { listarOutlet } from "@/lib/produtos";

// Aba "Outlet" - curadoria manual (feita no painel /admin/produtos) que reune pecas de
// QUALQUER marca ativa num so' lugar, sem tirar elas de suas paginas de marca de origem (uma
// peca marcada como outlet continua aparecendo normal em /marca/reserva, por exemplo - outlet
// e' um recorte extra, nao uma mudanca de catalogo).
export const metadata: Metadata = {
  title: "Outlet",
  description: "Peças selecionadas com condição especial na MOZZ."
};

export const revalidate = 30;

export default async function PaginaOutlet() {
  const produtos = await listarOutlet();

  return (
    <section className="py-8">
      <p className="font-serif text-3xl mb-1">Outlet</p>
      <p className="text-[14.5px] text-mozz-gray mb-6">
        {produtos.length > 0
          ? `${produtos.length} peca(s) com condicao especial`
          : "Nenhuma peca no outlet no momento - volta em breve."}
      </p>
      {produtos.length > 0 && <GradeProdutos produtos={produtos} />}
    </section>
  );
}

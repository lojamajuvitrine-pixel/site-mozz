import type { Metadata } from "next";
import GradeProdutos from "@/components/GradeProdutos";
import { listarPorGenero } from "@/lib/produtos";
import { SITE_URL as siteUrl } from "@/lib/site";

// Catalogo masculino (Reserva + Foxton, ver generoDaMarca em lib/produtos.ts) - pedido do
// Brunno em 27/09/2026, inspirado no menu do site oqvestir (NOVIDADES | FEMININO | MASCULINO |
// MARCAS...).
export const metadata: Metadata = {
  title: "Masculino",
  description: "Moda masculina Reserva e Foxton na MOZZ - loja multimarcas com frete para todo o Brasil.",
  alternates: { canonical: `${siteUrl}/masculino` }
};

export const revalidate = 30;

export default async function PaginaMasculino() {
  const produtos = await listarPorGenero("Masculino");

  return (
    <section className="py-8">
      <h1 className="font-serif text-3xl mb-6">Masculino</h1>
      <GradeProdutos produtos={produtos} />
    </section>
  );
}

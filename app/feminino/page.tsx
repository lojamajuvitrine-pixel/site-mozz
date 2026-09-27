import type { Metadata } from "next";
import GradeProdutos from "@/components/GradeProdutos";
import { listarPorGenero } from "@/lib/produtos";
import { SITE_URL as siteUrl } from "@/lib/site";

// Catalogo feminino (Animale + NV, ver generoDaMarca em lib/produtos.ts) - pedido do Brunno em
// 27/09/2026, inspirado no menu do site oqvestir (NOVIDADES | FEMININO | MASCULINO | MARCAS...).
export const metadata: Metadata = {
  title: "Feminino",
  description: "Moda feminina Animale e NV na MOZZ - loja multimarcas com frete para todo o Brasil.",
  alternates: { canonical: `${siteUrl}/feminino` }
};

export const revalidate = 30;

export default async function PaginaFeminino() {
  const produtos = await listarPorGenero("Feminino");

  return (
    <section className="py-8">
      <h1 className="font-serif text-3xl mb-6">Feminino</h1>
      <GradeProdutos produtos={produtos} />
    </section>
  );
}

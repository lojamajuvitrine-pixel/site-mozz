"use client";

import Link from "next/link";
import ProductCard from "./ProductCard";
import { useFavoritos } from "@/lib/favoritos-context";
import type { Produto } from "@/lib/produtos";

// Cruza os IDs favoritados (guardados so' no localStorage do navegador) com o catalogo atual
// (recebido pronto do servidor, ver app/favoritos/page.tsx) - por isso essa filtragem precisa
// ser client-side, diferente do resto do catalogo. Produto que saiu do catalogo (esgotado,
// marca desativada) simplesmente nao aparece mais aqui, sem precisar "limpar" nada.
export default function ListaFavoritos({ produtos }: { produtos: Produto[] }) {
  const { favoritos } = useFavoritos();
  const favoritados = produtos.filter((p) => favoritos.includes(p.id));

  if (favoritados.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-[14.5px] text-mozz-gray mb-4">
          Voce ainda nao tem nenhuma peca favoritada.
        </p>
        <Link href="/produtos" className="text-[14.5px] underline">
          Ver catalogo
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
      {favoritados.map((produto) => (
        <ProductCard key={produto.id} produto={produto} />
      ))}
    </div>
  );
}

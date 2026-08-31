import Link from "next/link";

function IconePresente() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" width="16" height="16" className="shrink-0">
      <rect x="3" y="8" width="18" height="13" rx="1" />
      <path d="M3 12h18" />
      <path d="M12 8v13" />
      <path d="M12 8c-1.5-4-6-4-6-1s3 1 6 1z" />
      <path d="M12 8c1.5-4 6-4 6-1s-3 1-6 1z" />
    </svg>
  );
}

// Aviso de cashback - mesmo padrao visual do AvisoFreteGratis, usado na pagina do produto (ver
// components/SeletorProduto.tsx) pra deixar visivel que toda compra aprovada gera credito de
// loja (pedido do Brunno em 31/08/2026, inspirado em como a Foxton comunica o cashback dela no
// site: link fixo pras condicoes completas). Aqui e' sempre a mesma mensagem (15% flat, sem
// depender de valor minimo) - ver regras completas e exemplo em /cashback.
export default function AvisoCashback() {
  return (
    <div className="flex items-center gap-2 text-[13px] px-3 py-2 border mt-2 bg-mozz-stone border-black/10 text-mozz-black">
      <IconePresente />
      <span>
        Ganhe 15% de volta em crédito de loja nessa compra.{" "}
        <Link href="/cashback" className="underline">
          Como funciona
        </Link>
      </span>
    </div>
  );
}

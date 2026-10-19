import Link from "next/link";
import { MAX_PARCELAS_SEM_JUROS } from "@/lib/formato";

function IconeEscudo() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" width="16" height="16" className="shrink-0">
      <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3z" strokeLinejoin="round" />
      <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Quadro "Compra segura" (pedido do Brunno em 19/10/2026) - na pagina do produto (completo) e no
// carrinho (compacto, so' uma linha perto do pagamento). Os compromissos de prazo (envio em ate
// 1 dia util, resposta no WhatsApp no mesmo dia util) precisam ser cumpridos pela equipe.
export default function CompraSegura({ compacto = false }: { compacto?: boolean }) {
  if (compacto) {
    return (
      <div className="flex items-center gap-2 text-[13px] px-3 py-2 border mt-3 bg-mozz-stone border-black/10 text-mozz-black">
        <IconeEscudo />
        <span>
          Pagamento seguro pelo Mercado Pago · Cartão em até {MAX_PARCELAS_SEM_JUROS}x sem juros ·{" "}
          <Link href="/trocas" className="underline">
            Troca em 30 dias
          </Link>
        </span>
      </div>
    );
  }

  return (
    <div className="mt-6 border border-black/10 p-4 text-[13.5px] text-mozz-black">
      <p className="flex items-center gap-2 font-medium mb-2">
        <IconeEscudo />
        Compra segura
      </p>
      <ul className="space-y-1.5 text-mozz-gray leading-relaxed">
        <li>Pagamento protegido pelo Mercado Pago. Os dados do seu cartão não passam pelo nosso servidor.</li>
        <li>Revenda oficial: peça original, com nota fiscal.</li>
        <li>Postamos em até 1 dia útil.</li>
        <li>
          Troca em 30 dias, com a primeira troca grátis.{" "}
          <Link href="/trocas" className="underline underline-offset-2">
            Ver as regras
          </Link>
        </li>
        <li>
          Preço garantido.{" "}
          <Link href="/preco-garantido" className="underline underline-offset-2">
            Veja como funciona
          </Link>
        </li>
        <li>Dúvidas? Respondemos no WhatsApp no mesmo dia útil.</li>
      </ul>
    </div>
  );
}

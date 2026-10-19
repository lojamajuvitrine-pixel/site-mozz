import type { Metadata } from "next";
import Link from "next/link";

// Pagina institucional do cashback - regras confirmadas pelo Brunno em 30/08/2026 (15% / 30
// dias / 30% de teto de uso), implementado em lib/creditos.ts. Linkada no rodape (ver
// components/Footer.tsx) e no aviso da pagina do produto (ver components/AvisoCashback.tsx) -
// mesmo padrao usado pela Foxton, que tem uma pagina de perguntas frequentes dedicada ao
// cashback dela, linkada no rodape (ver claude/analise-concorrentes-marcas.md).
export const metadata: Metadata = {
  title: "Cashback",
  description: "Programa de cashback encerrado. Créditos de loja já concedidos continuam valendo até a data de validade.",
  robots: { index: false, follow: true }
};

export default function PaginaCashback() {
  return (
    <section className="py-8 max-w-2xl">
      <p className="font-serif text-3xl mb-6">Cashback MOZZ</p>

      <div className="space-y-5 text-[14.5px] text-mozz-black/80 leading-relaxed">
        <p>
          <strong className="text-mozz-black">O programa de cashback foi encerrado.</strong> Compras
          novas não geram mais crédito de loja. Os créditos que você já recebeu continuam valendo
          até a data de validade, e as regras abaixo seguem valendo para eles.
        </p>

        <div>
          <p className="text-mozz-black font-medium mb-1">Quando o crédito fica disponível?</p>
          <p>Assim que o seu pagamento é aprovado — não precisa esperar o pedido chegar.</p>
        </div>

        <div>
          <p className="text-mozz-black font-medium mb-1">Por quanto tempo vale?</p>
          <p>O crédito fica disponível por 30 dias a partir da data em que foi gerado.</p>
        </div>

        <div>
          <p className="text-mozz-black font-medium mb-1">Quanto eu posso usar de uma vez?</p>
          <p>
            O crédito cobre até 30% do valor da nova compra (também incluindo o frete). Exemplo:
            uma compra de R$300 gera R$45 de cashback; pra usar esses R$45 inteiros numa próxima
            compra, ela precisa ser de pelo menos R$150.
          </p>
        </div>

        <div>
          <p className="text-mozz-black font-medium mb-1">Como eu confiro meu saldo?</p>
          <p>
            Só digitar seu CPF no carrinho — o saldo disponível aparece automaticamente, com a
            opção de aplicar na compra. Não precisa criar conta nem fazer login.
          </p>
        </div>

        <p className="text-mozz-gray text-[13px]">
          O crédito é intransferível e não pode ser convertido em reembolso. Dúvidas? Chama a
          gente no{" "}
          <Link href="/quem-somos" className="underline">
            WhatsApp
          </Link>
          .
        </p>
      </div>
    </section>
  );
}

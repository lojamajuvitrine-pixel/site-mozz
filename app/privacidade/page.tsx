import type { Metadata } from "next";

// RASCUNHO - Aviso de privacidade generico (LGPD) escrito com base nos dados que o site da
// MOZZ realmente coleta e nos fornecedores reais (Mercado Pago pro pagamento, transportadoras
// pro frete, Supabase pra login/conta, Bling pra nota fiscal/estoque) - mas SEM revisao
// juridica. Pedido do Brunno em 31/08/2026 (reestruturacao do rodape estilo Foxton), ele
// confirmou que quer um rascunho pra revisar. NAO e' aconselhamento juridico.
export const metadata: Metadata = {
  title: "Aviso de privacidade",
  description: "Como a MOZZ trata os dados dos seus clientes."
};

export default function PaginaPrivacidade() {
  return (
    <section className="py-8 max-w-2xl">
      <p className="font-serif text-3xl mb-2">Aviso de privacidade</p>
      <p className="text-mozz-gray text-[13px] mb-6">Última atualização: agosto de 2026.</p>

      <div className="space-y-5 text-[14.5px] text-mozz-black/80 leading-relaxed">
        <div>
          <p className="text-mozz-black font-medium mb-1">Quais dados coletamos</p>
          <p>
            Nome, CPF, telefone, e-mail e endereço, informados por você ao criar uma conta,
            favoritar produtos ou finalizar uma compra.
          </p>
        </div>

        <div>
          <p className="text-mozz-black font-medium mb-1">Para que usamos</p>
          <p>
            Pra processar seu pedido, calcular frete, emitir nota fiscal, aplicar cupons e
            cashback, e entrar em contato sobre uma compra em andamento.
          </p>
        </div>

        <div>
          <p className="text-mozz-black font-medium mb-1">Com quem compartilhamos</p>
          <p>
            Só com quem é estritamente necessário pra sua compra acontecer: o processador de
            pagamento (Mercado Pago), a transportadora responsável pela entrega, e o sistema
            usado pra emissão de nota fiscal e controle de estoque. Não vendemos nem alugamos
            seus dados pra terceiros.
          </p>
        </div>

        <div>
          <p className="text-mozz-black font-medium mb-1">Pagamento</p>
          <p>
            Os dados do seu cartão são inseridos direto na plataforma do Mercado Pago — a MOZZ
            não tem acesso a esses dados nem os armazena.
          </p>
        </div>

        <div>
          <p className="text-mozz-black font-medium mb-1">Seus direitos</p>
          <p>
            De acordo com a Lei Geral de Proteção de Dados (LGPD), você pode pedir pra acessar,
            corrigir ou excluir seus dados a qualquer momento, entrando em contato pelo
            WhatsApp.
          </p>
        </div>

        <p className="text-mozz-gray text-[13px]">
          Dúvidas sobre este aviso? Fale com a gente pelo WhatsApp.
        </p>
      </div>
    </section>
  );
}

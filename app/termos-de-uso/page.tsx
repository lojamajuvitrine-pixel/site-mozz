import type { Metadata } from "next";

// RASCUNHO - conteudo generico de Termos de Uso pra loja virtual, escrito com base nos dados
// reais da MOZZ (endereco, marcas, forma de pagamento, cupom/cashback ja existentes no site),
// mas SEM revisao juridica. Pedido do Brunno em 31/08/2026 (reestruturacao do rodape estilo
// Foxton) - ele confirmou que quer um rascunho pra revisar antes de publicar. NAO e' aconselhamento
// juridico; o ideal e' um advogado revisar antes de considerar esse texto definitivo,
// especialmente o trecho de foro/jurisdicao no final.
export const metadata: Metadata = {
  title: "Termos de uso",
  description: "Termos de uso do site da MOZZ."
};

export default function PaginaTermosDeUso() {
  return (
    <section className="py-8 max-w-2xl">
      <p className="font-serif text-3xl mb-2">Termos de uso</p>
      <p className="text-mozz-gray text-[13px] mb-6">Última atualização: agosto de 2026.</p>

      <div className="space-y-5 text-[14.5px] text-mozz-black/80 leading-relaxed">
        <div>
          <p className="text-mozz-black font-medium mb-1">1. Quem somos</p>
          <p>
            O site lojamozz.com.br é operado pela MOZZ, loja multimarcas com endereço físico em
            Avenida Coronel Rogério Borba, nº 480, Reserva, PR. Ao usar este site ou fazer uma
            compra, você concorda com estes termos.
          </p>
        </div>

        <div>
          <p className="text-mozz-black font-medium mb-1">2. Produtos e preços</p>
          <p>
            Vendemos peças das marcas Animale, NV, Reserva e Foxton, sujeitas à disponibilidade
            de estoque. Preços e condições podem mudar sem aviso prévio até a confirmação do
            pedido. Eventuais erros de descrição ou preço podem ser corrigidos antes da
            confirmação da compra.
          </p>
        </div>

        <div>
          <p className="text-mozz-black font-medium mb-1">3. Pedido e pagamento</p>
          <p>
            O pagamento é processado pelo Mercado Pago (cartão de crédito, Pix ou boleto). O
            pedido só é confirmado após a aprovação do pagamento. Mais detalhes em{" "}
            <a href="/parcelamento" className="underline">Formas de parcelamento</a>.
          </p>
        </div>

        <div>
          <p className="text-mozz-black font-medium mb-1">4. Entrega e retirada</p>
          <p>
            Prazos e valores de frete são calculados por CEP no momento da compra. Detalhes em{" "}
            <a href="/entrega" className="underline">Formas de entrega</a>.
          </p>
        </div>

        <div>
          <p className="text-mozz-black font-medium mb-1">5. Trocas, devoluções e arrependimento</p>
          <p>
            Além do prazo de troca da loja (veja{" "}
            <a href="/trocas" className="underline">Trocas e devoluções</a>), o Código de Defesa
            do Consumidor garante ao cliente o direito de desistir da compra em até 7 dias
            corridos a partir do recebimento, por se tratar de compra fora do estabelecimento
            comercial.
          </p>
        </div>

        <div>
          <p className="text-mozz-black font-medium mb-1">6. Crédito de loja e cupons</p>
          <p>
            O programa de cashback e eventuais cupons de desconto seguem as regras descritas em{" "}
            <a href="/cashback" className="underline">Cashback</a>, e podem ser alterados a
            qualquer momento, sem afetar créditos já concedidos.
          </p>
        </div>

        <div>
          <p className="text-mozz-black font-medium mb-1">7. Propriedade intelectual</p>
          <p>
            Textos, fotos e identidade visual deste site pertencem à MOZZ ou são usados com
            autorização, e não podem ser copiados sem permissão.
          </p>
        </div>

        <div>
          <p className="text-mozz-black font-medium mb-1">8. Foro</p>
          <p>
            Fica eleito o foro da comarca de Reserva, PR, para resolver eventuais disputas
            relacionadas a estes termos, ressalvado o direito do consumidor de optar pelo foro
            do seu domicílio, conforme legislação brasileira.
          </p>
        </div>

        <p className="text-mozz-gray text-[13px]">
          Dúvidas? Fale com a gente pelo WhatsApp.
        </p>
      </div>
    </section>
  );
}

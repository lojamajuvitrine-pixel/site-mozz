import type { Metadata } from "next";

// Pagina de politica de troca/devolucao - prazo e condicoes informados pelo Brunno em
// 24/08/2026 (30 dias, peca sem uso e com etiqueta). Linkada no rodape.
export const metadata: Metadata = {
  title: "Trocas e devoluções",
  description: "Prazo e condições pra trocar ou devolver uma peça comprada na MOZZ."
};

export default function PaginaTrocas() {
  return (
    <section className="py-8 max-w-2xl">
      <p className="font-serif text-3xl mb-6">Trocas e devoluções</p>

      <div className="space-y-5 text-[14.5px] text-mozz-black/80 leading-relaxed">
        <p>
          Você tem até <strong className="text-mozz-black">30 dias corridos</strong> a partir do
          recebimento do pedido pra solicitar troca ou devolução.
        </p>

        <div>
          <p className="text-mozz-black font-medium mb-1">Condições</p>
          <ul className="list-disc pl-4 space-y-1">
            <li>A peça não pode ter sido usada, lavada ou alterada.</li>
            <li>Precisa estar com a etiqueta original presa à peça.</li>
            <li>Envie junto a nota fiscal ou o número do pedido.</li>
          </ul>
        </div>

        <div>
          <p className="text-mozz-black font-medium mb-1">Como solicitar</p>
          <p>
            Chama a gente no WhatsApp com o número do pedido e o motivo da troca ou devolução
            (tamanho, cor, arrependimento etc.) — a gente explica os próximos passos, incluindo
            o envio da peça de volta.
          </p>
        </div>

        <div>
          <p className="text-mozz-black font-medium mb-1">Reembolso</p>
          <p>
            Depois que a peça devolvida chega e passa pela conferência, o reembolso é feito no
            mesmo método de pagamento usado na compra. Em caso de troca por outro tamanho ou
            cor, o envio da nova peça sai assim que a original é recebida.
          </p>
        </div>

        <p className="text-mozz-gray text-[13px]">
          Peça com defeito de fabricação tem prazo e condições diferentes, garantidos pelo
          Código de Defesa do Consumidor — nesse caso, chama a gente o quanto antes.
        </p>
      </div>
    </section>
  );
}

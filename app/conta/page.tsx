import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { clientePublico } from "@/lib/supabase/publico";
import { SUPABASE_CONFIGURADO } from "@/lib/supabase/config";
import { formatarPreco } from "@/lib/formato";
import PerfilForm, { type DadosPerfil } from "@/components/PerfilForm";

// Protegida pelo middleware.ts (redireciona pra /conta/entrar antes de chegar aqui se nao
// tiver sessao) - o redirect() abaixo e' so' uma segunda camada de seguranca, caso essa
// pagina seja renderizada de algum jeito que pule o middleware.
export const dynamic = "force-dynamic";

// Um pedido, como devolvido pela funcao pedidos_por_cpf (ver migration
// criar_pedidos_e_rastreio) - so' os campos usados aqui na tela.
type Pedido = {
  numero_pedido: string;
  itens: { nome: string; qtd: number }[];
  valor_total: number;
  forma_envio: "correios" | "retirada";
  status_envio: string;
  codigo_rastreio: string | null;
  link_rastreio: string | null;
  criado_em: string;
};

// Traduz o status interno pra algo que faz sentido pro cliente ler - "falha_etiqueta" (a
// compra automatica da etiqueta deu erro, ver app/api/mercadopago/webhook) fica igual
// "aguardando_etiqueta": o cliente nao precisa saber que foi automatico ou manual, so' que o
// Brunno ja esta' preparando o envio.
const STATUS_LABEL: Record<string, string> = {
  retirada_na_loja: "Retirar na loja",
  aguardando_etiqueta: "Em preparação",
  falha_etiqueta: "Em preparação",
  etiqueta_gerada: "Etiqueta gerada",
  postado: "A caminho",
  entregue: "Entregue"
};

async function buscarPedidosDoCliente(cpf: string | undefined): Promise<Pedido[]> {
  const cpfLimpo = (cpf ?? "").replace(/\D/g, "");
  if (!cpfLimpo || !SUPABASE_CONFIGURADO) return [];
  try {
    const supabase = clientePublico();
    const { data, error } = await supabase.rpc("pedidos_por_cpf", { p_cpf: cpfLimpo });
    if (error || !data) return [];
    return data as Pedido[];
  } catch {
    return [];
  }
}

export default async function PaginaConta() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/conta/entrar");
  }

  // metadata do usuario vem solta (any) do Supabase - mapeia pros campos que o formulario
  // espera, com fallback vazio pra quem ainda nao preencheu nada.
  const meta = user.user_metadata ?? {};
  const perfilInicial: Partial<DadosPerfil> = {
    nomeCompleto: meta.nome_completo ?? "",
    cpf: meta.cpf ?? "",
    telefone: meta.telefone ?? "",
    dataNascimento: meta.data_nascimento ?? "",
    cep: meta.cep ?? "",
    endereco: meta.endereco ?? "",
    numero: meta.numero ?? "",
    complemento: meta.complemento ?? "",
    bairro: meta.bairro ?? "",
    cidade: meta.cidade ?? "",
    uf: meta.uf ?? ""
  };

  const pedidos = await buscarPedidosDoCliente(meta.cpf);

  return (
    <section className="py-12 max-w-xl">
      <div className="flex items-baseline justify-between mb-8">
        <div>
          <p className="font-serif text-3xl mb-1">Minha conta</p>
          <p className="text-[14.5px] text-mozz-gray">{user.email}</p>
        </div>
        <form action="/auth/sair" method="post">
          <button type="submit" className="text-[13.5px] text-mozz-gray underline">
            Sair
          </button>
        </form>
      </div>

      <div className="mb-10">
        <p className="text-[14.5px] mb-3">Meus dados</p>
        <p className="text-[13px] text-mozz-gray mb-4">
          Preenche pra agilizar a entrega e a nota fiscal dos seus pedidos.
        </p>
        <PerfilForm perfilInicial={perfilInicial} />
      </div>

      <div>
        <p className="text-[14.5px] mb-3">Meus pedidos</p>
        {pedidos.length === 0 ? (
          <div className="border border-black/10 px-4 py-6 text-center">
            <p className="text-[14.5px] text-mozz-gray">
              {perfilInicial.cpf
                ? "Você ainda não fez nenhum pedido."
                : "Preenche seu CPF em \"Meus dados\" pra ver aqui o histórico dos seus pedidos."}
            </p>
            <a href="/produtos" className="text-[14.5px] underline mt-2 inline-block">
              Ver catálogo
            </a>
          </div>
        ) : (
          <div className="space-y-3">
            {pedidos.map((pedido) => (
              <div key={pedido.numero_pedido} className="border border-black/10 px-4 py-4">
                <div className="flex items-baseline justify-between mb-1">
                  <p className="text-[14.5px]">Pedido {pedido.numero_pedido}</p>
                  <p className="text-[13px] text-mozz-gray">
                    {new Date(pedido.criado_em).toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <p className="text-[13px] text-mozz-gray mb-2">
                  {pedido.itens.reduce((soma, item) => soma + item.qtd, 0)}{" "}
                  {pedido.itens.reduce((soma, item) => soma + item.qtd, 0) === 1 ? "peça" : "peças"} ·{" "}
                  {formatarPreco(pedido.valor_total)}
                </p>
                <div className="flex items-center justify-between">
                  <span className="text-[13px] px-2 py-1 bg-mozz-stone">
                    {STATUS_LABEL[pedido.status_envio] ?? "Em preparação"}
                  </span>
                  {pedido.codigo_rastreio && pedido.link_rastreio && (
                    <a href={pedido.link_rastreio} target="_blank" rel="noopener noreferrer" className="text-[13px] underline">
                      Rastrear ({pedido.codigo_rastreio})
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

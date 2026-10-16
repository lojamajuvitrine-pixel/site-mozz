import { NextRequest, NextResponse } from "next/server";
import { clientePublico } from "@/lib/supabase/publico";

// Grava os dados da cliente a cada etapa do checkout (15/10/2026) - assim, se ela desistir
// antes de pagar, a Mozz ainda tem nome + WhatsApp + o que estava no carrinho pra chamar
// (painel /admin/carrinhos-abandonados). A tabela "checkouts" nao libera leitura nem escrita
// direta pra ninguem (RLS sem policy) - tudo passa pela funcao salvar_checkout do Supabase,
// que so' atualiza a linha se o token bater (o token fica so' no navegador da cliente).
//
// Resposta: { ok: true } ou { renovar: true } quando esse checkout ja' virou pedido pago -
// o navegador gera um id novo e manda de novo (ver app/carrinho/page.tsx).

const ETAPAS = ["dados", "entrega", "pagamento"] as const;

function texto(valor: unknown, max: number): string | null {
  if (typeof valor !== "string") return null;
  const limpo = valor.trim().slice(0, max);
  return limpo.length > 0 ? limpo : null;
}

function numero(valor: unknown): number | null {
  const n = Number(valor);
  return Number.isFinite(n) && n >= 0 && n < 1_000_000 ? Math.round(n * 100) / 100 : null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const id = texto(body.id, 36);
    const token = texto(body.token, 80);
    const etapa = ETAPAS.find((e) => e === body.etapa);
    if (!id || !/^[0-9a-f-]{36}$/i.test(id) || !token || token.length < 20 || !etapa) {
      return NextResponse.json({ erro: "Checkout inválido" }, { status: 400 });
    }

    // Itens resumidos (nome/cor/tamanho/qtd/preco/foto) - o suficiente pra mensagem do
    // WhatsApp e pro painel, sem guardar o objeto inteiro do produto.
    const itens = Array.isArray(body.itens)
      ? body.itens.slice(0, 40).map((i: Record<string, unknown>) => ({
          id: texto(i.id, 40),
          nome: texto(i.nome, 150),
          marca: texto(i.marca, 60),
          cor: texto(i.cor, 60),
          tamanho: texto(i.tamanho, 20),
          quantidade: Math.min(99, Math.max(1, Math.round(Number(i.quantidade) || 1))),
          preco: numero(i.preco),
          imagem: texto(i.imagem, 400)
        }))
      : null;

    const endereco =
      body.endereco && typeof body.endereco === "object"
        ? {
            cep: texto(body.endereco.cep, 9),
            rua: texto(body.endereco.rua, 150),
            numero: texto(body.endereco.numero, 20),
            complemento: texto(body.endereco.complemento, 80),
            bairro: texto(body.endereco.bairro, 80),
            cidade: texto(body.endereco.cidade, 80),
            uf: texto(body.endereco.uf, 2)
          }
        : null;

    const frete =
      body.frete && typeof body.frete === "object"
        ? {
            servico: texto(body.frete.servico, 60),
            transportadora: texto(body.frete.transportadora, 60),
            preco: numero(body.frete.preco)
          }
        : null;

    const { data, error } = await clientePublico().rpc("salvar_checkout", {
      p_id: id,
      p_token: token,
      p_etapa: etapa,
      p_nome: texto(body.nome, 120),
      p_whatsapp: texto(body.whatsapp, 25),
      p_email: texto(body.email, 150),
      p_aceita_marketing: typeof body.aceitaMarketing === "boolean" ? body.aceitaMarketing : null,
      p_cpf: texto(body.cpf, 14),
      p_endereco: endereco,
      p_frete: frete,
      p_itens: itens,
      p_subtotal: numero(body.subtotal),
      p_total: numero(body.total),
      p_numero_pedido: texto(body.numeroPedido, 40)
    });

    if (error) {
      console.error("Erro ao salvar checkout:", error.message);
      return NextResponse.json({ erro: "Não foi possível salvar" }, { status: 500 });
    }
    if (data === "renovar") return NextResponse.json({ renovar: true });
    return NextResponse.json({ ok: true });
  } catch (erro) {
    console.error("Erro ao salvar checkout:", erro);
    return NextResponse.json({ erro: "Não foi possível salvar" }, { status: 500 });
  }
}

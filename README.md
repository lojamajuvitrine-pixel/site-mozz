# Site MOZZ

Loja online da MOZZ (Animale, NV, Reserva, Foxton), construida do zero em Next.js 14
(App Router) + TypeScript + Tailwind, com checkout via Mercado Pago (Checkout Pro) e
catalogo sincronizado do Bling (API v3).

## Rodando localmente

```bash
npm install
cp .env.example .env.local   # preencher com as credenciais reais (ver PROXIMOS_PASSOS.md)
npm run dev
```

Abre em http://localhost:3000. Sem credenciais preenchidas, o site funciona normalmente
usando o catalogo de exemplo em `data/produtos.json` - so o checkout e a sincronizacao com
o Bling precisam das chaves reais pra funcionar de verdade.

## Estrutura

```
app/
  page.tsx                     home
  marca/[slug]/page.tsx        vitrine por marca (Animale, NV, Reserva, Foxton)
  produto/[slug]/page.tsx      pagina de produto
  carrinho/page.tsx            carrinho + botao "Finalizar compra"
  api/mercadopago/
    criar-preferencia/         cria a preferencia de pagamento e devolve o link de checkout
    webhook/                   recebe a confirmacao de pagamento do Mercado Pago
  api/bling/sincronizar/       chama o Bling e devolve o catalogo cru (debug/inspecao)
lib/
  produtos.ts                  leitura do catalogo (hoje: data/produtos.json)
  cart-context.tsx             estado do carrinho (React Context + localStorage)
  bling.ts                     cliente OAuth2 da API do Bling (produtos, estoque, pedidos)
  mercadopago.ts                cliente do Mercado Pago (criacao de preferencia)
scripts/sync-bling.ts          script pra puxar o catalogo do Bling e atualizar data/produtos.json
data/produtos.json             catalogo de exemplo (8 produtos reais da MOZZ, so pra dev)
```

## O que ja funciona

- Navegacao completa: home, marca, produto, carrinho.
- Carrinho persistente (localStorage), com tamanho e quantidade.
- Botao "Finalizar compra" cria uma preferencia real no Mercado Pago e redireciona pro
  checkout deles (funciona assim que `MERCADOPAGO_ACCESS_TOKEN` estiver no `.env.local`).
- Cliente do Bling pronto (autenticacao OAuth2 com refresh automatico de token, listagem
  de produtos e estoque, criacao de pedido de venda).

## O que falta pra ir pra producao (ver PROXIMOS_PASSOS.md pro passo a passo)

1. Credenciais reais do Bling e do Mercado Pago.
2. Mapear os campos do catalogo real do Bling pro formato de `Produto` em `lib/produtos.ts`
   (hoje `scripts/sync-bling.ts` busca os dados mas o mapeamento fica em TODO - depende de
   ver o formato real que a conta Bling da MOZZ devolve).
3. Validar a assinatura do webhook do Mercado Pago (`app/api/mercadopago/webhook/route.ts`
   tem um TODO explicito) antes de confiar em qualquer notificacao de pagamento.
4. Completar o mapeamento de `criarPedidoVendaBling` (deposito, forma de pagamento,
   numeracao) com uma venda de teste real, pra fechar o ciclo pagamento aprovado -> pedido
   lancado no Bling automaticamente.
5. Fotos de produto (hoje os cards mostram um placeholder "foto do produto").
6. Deploy na Vercel + apontar o dominio.

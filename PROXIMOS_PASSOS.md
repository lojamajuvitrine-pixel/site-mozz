# Próximos passos — o que só o Brunno pode fazer

Eu não posso criar contas, aceitar termos de serviço ou preencher formulários de
cadastro em nome de terceiros — isso é sempre uma ação pessoal, ligada ao CPF/CNPJ e à
titularidade da conta. Esse documento é o checklist do que falta *só do seu lado* pra eu
poder ligar o site de verdade nas contas da MOZZ. Assim que cada item estiver pronto, me
manda as informações marcadas com 🔑 (aqui no chat, ou direto no arquivo `.env.local` do
projeto) que eu sigo com a parte técnica.

## 1. Hospedagem (Vercel) + domínio

- [ ] Criar conta na [vercel.com](https://vercel.com) (dá pra entrar com GitHub).
- [ ] Criar uma conta no [GitHub](https://github.com) se ainda não tiver — é lá que o
      código do site vai morar, e a Vercel publica automaticamente a cada atualização.
- [ ] Decidir: continuar com `lojamozz.com.br` (repassar o domínio pra apontar pra Vercel,
      o que tira a Nuvemshop do ar) ou registrar um domínio novo. Você comentou que paga o
      domínio — se for um novo, é só comprar (Registro.br, Vercel Domains, etc.).
- 🔑 Depois de criado: nome de usuário/organização da Vercel, e a decisão sobre o domínio.

## 2. Bling — app de integração (API v3)

- [ ] Entrar em [developer.bling.com.br](https://developer.bling.com.br) com o login que
      já usa no Bling da MOZZ.
- [ ] Central de Extensões → Área do Integrador → **Criar aplicativo** (nome sugerido:
      "Site MOZZ", visibilidade: privado/só pra você).
- [ ] No campo **Link de redirecionamento**, cole exatamente:
      `https://site-mozz.vercel.app/api/bling/callback`
      (esse é o endereço que já deixei pronto no site pra receber a autorização — se
      trocarmos de domínio depois, é só editar esse campo de novo).
- [ ] Em **Escopos**, adicionar pelo menos: Produtos (leitura), Estoques (leitura),
      Pedidos de Venda (leitura e escrita).
- [ ] Salvar. Na aba "Informações do app" vão aparecer o **Client ID** e o **Client
      Secret** (clique no ícone de olho pra revelar o secret).
- 🔑 Me manda o Client ID e o Client Secret assim que tiver. Eu não tenho acesso à sua
      conta Vercel, então você mesmo adiciona os dois em Project Settings → Environment
      Variables (`BLING_CLIENT_ID` e `BLING_CLIENT_SECRET`) e clica em Redeploy — aí eu te
      devolvo o link de autorização pra você clicar (é o último passo, só um clique).

## 3. Mercado Pago — conta e credenciais

- [ ] Confirmar se já existe uma conta Mercado Pago vinculada ao CNPJ da MOZZ (bem comum
      já ter, já que vocês usam a Infinite Pay/maquininha — mas o Mercado Pago é uma
      conta separada). Se não tiver, criar em
      [mercadopago.com.br](https://www.mercadopago.com.br) — precisa de CNPJ, dados
      bancários pra receber os repasses.
- [ ] Dentro da conta, ir em **Suas integrações** → criar uma aplicação nova (nome
      sugerido: "Site MOZZ", tipo "Checkout Pro").
- [ ] Isso gera o **Access Token** e a **Public Key** (tem versão de teste e de produção —
      começamos pela de teste).
- 🔑 Access Token e Public Key (ambiente de teste primeiro).

## O que eu já fiz enquanto isso

- Estrutura completa do site (Next.js), com a identidade visual monocromática que
  definimos, catálogo de exemplo, carrinho funcionando de ponta a ponta.
- Cliente do Bling pronto (só falta o Refresh Token pra virar real).
- Criação de preferência de pagamento e webhook do Mercado Pago prontos (só falta o
  Access Token, e um ajuste de segurança que já deixei anotado como TODO no código —
  validar a assinatura do webhook).

Assim que tiver qualquer um dos itens 🔑 acima, me manda que eu já conecto e testo.

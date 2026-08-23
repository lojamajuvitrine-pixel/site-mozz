# Próximos passos — o que só o Brunno pode fazer

Eu não posso criar contas, aceitar termos de serviço ou preencher formulários de
cadastro em nome de terceiros — isso é sempre uma ação pessoal, ligada ao CPF/CNPJ e à
titularidade da conta. Esse documento é o checklist do que falta *só do seu lado* pra eu
poder ligar o site de verdade nas contas da MOZZ. Assim que cada item estiver pronto, me
manda as informações marcadas com 🔑 (aqui no chat, ou direto no arquivo `.env.local` do
projeto) que eu sigo com a parte técnica.

## 1. Hospedagem (Vercel) + domínio ✅ (domínio ativo em 23/08/2026)

- [x] Conta Vercel + GitHub conectados, site publicando automaticamente a cada push.
- [x] `lojamozz.com.br` apontado pra Vercel (registros DNS feitos no Registro.br) - já
      confirmei que está resolvendo com SSL funcionando.
- [ ] **Falta só um passo seu**: em Project Settings → Environment Variables na Vercel,
      atualizar `NEXT_PUBLIC_SITE_URL` de `https://site-mozz.vercel.app` pra
      `https://lojamozz.com.br`, e clicar em Redeploy. Isso ajusta o domínio usado no SEO,
      sitemap e nos links de retorno do checkout do Mercado Pago pro domínio definitivo (já
      atualizei o `.env.local` local com esse valor).

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

## 4. Melhor Envio — cálculo de frete por CEP

- [ ] Criar conta grátis em [melhorenvio.com.br](https://melhorenvio.com.br).
- [ ] Gerar um token de API — normalmente em **Configurações → Tokens** (ou, se a conta
      pedir, cadastrando um "aplicativo" e autorizando ele pra sua própria conta, do mesmo
      jeito que fizemos com o Bling). A tela exata pode variar um pouco, mas o nome do menu
      é sempre parecido com "Tokens" ou "Integrações".
- [ ] Anotar o **CEP de origem** — de onde os pedidos da MOZZ são despachados (loja física
      ou depósito).
- 🔑 Me manda o token gerado e o CEP de origem. Eu coloco em `MELHOR_ENVIO_TOKEN` e
      `MELHOR_ENVIO_CEP_ORIGEM` (no `.env.local` pra testar, e você replica em Project
      Settings → Environment Variables na Vercel).
- Observação importante: como o Bling não guarda peso/dimensão por peça, o cálculo hoje usa
  um pacote padrão aproximado (peso médio de roupa dobrada) em vez do peso real de cada
  produto — dá um frete próximo do real, mas não exato centavo a centavo. Se um dia
  cadastrarmos peso/dimensão reais no Bling, é só eu trocar isso no código.

## 6. Meta Pixel e Google Analytics — rastreamento de anúncios e tráfego

- [ ] **Meta Pixel** (anúncios/remarketing no Instagram e Facebook): no
      [Gerenciador de Eventos](https://business.facebook.com/events_manager) da conta de
      anúncios da MOZZ, criar uma fonte de dados do tipo "Web" (Pixel). Isso gera um ID
      numérico (parecido com `123456789012345`).
- [ ] **Google Analytics** (de onde vem o tráfego, como o cliente navega): criar uma
      propriedade GA4 em [analytics.google.com](https://analytics.google.com) pro domínio
      do site. Isso gera um ID no formato `G-XXXXXXXXXX`.
- 🔑 Me manda os dois IDs. Eu coloco em `NEXT_PUBLIC_META_PIXEL_ID` e `NEXT_PUBLIC_GA_ID`
      (no `.env.local` e você replica na Vercel). O código já está pronto pra ativar sozinho
      assim que os IDs existirem — sem isso, o site funciona normal, só sem esses dois
      rastreamentos.

## 5. GitHub Actions — atualização automática de estoque

Hoje o site lê o catálogo de um arquivo (`data/produtos.json`) gerado pelo sync, não de um
banco de dados ao vivo — então pra vendas feitas na loja física aparecerem automaticamente
no site (sem você rodar `npm run sync:bling` na mão), configurei um robô que roda sozinho a
cada 5 minutos (o menor intervalo que o GitHub aceita) e atualiza só preço/estoque. Falta
você criar os "secrets" (senhas seguras
que só o robô do GitHub enxerga) uma única vez:

- [ ] No GitHub, abrir o repositório do site → **Settings → Secrets and variables →
      Actions → New repository secret** e criar estes três, com os mesmos valores que já
      estão no `.env.local` do projeto:
      - `BLING_CLIENT_ID`
      - `BLING_CLIENT_SECRET`
      - `BLING_REFRESH_TOKEN`
- [ ] Criar um **Personal Access Token** (Settings da sua conta pessoal do GitHub, não do
      repositório → **Developer settings → Personal access tokens → Fine-grained tokens**),
      com permissão de **Secrets: Read and write** só nesse repositório. Isso é necessário
      porque o Bling troca o refresh_token toda vez que é usado — o robô precisa poder
      atualizar o secret `BLING_REFRESH_TOKEN` sozinho depois de cada rodada, senão para de
      funcionar na segunda execução.
- [ ] Colar esse token como um quarto secret chamado `GH_PAT_SECRETS`.
- [ ] Em **Settings → Actions → General → Workflow permissions**, marcar "Read and write
      permissions" (o robô também precisa poder dar `git push` da atualização do catálogo).
- [ ] Depois de configurado, dá pra testar manualmente: aba **Actions** do repositório →
      "Sync automático de estoque" → **Run workflow**.

Sem isso configurado, o site continua funcionando normalmente — só que o estoque/preço só
atualiza quando alguém roda `npm run sync:bling` (ou `npm run sync:estoque`) na mão.

## O que eu já fiz enquanto isso

- Estrutura completa do site (Next.js), com a identidade visual monocromática que
  definimos, catálogo de exemplo, carrinho funcionando de ponta a ponta.
- Cliente do Bling pronto (só falta o Refresh Token pra virar real).
- Criação de preferência de pagamento e webhook do Mercado Pago prontos (só falta o
  Access Token, e um ajuste de segurança que já deixei anotado como TODO no código —
  validar a assinatura do webhook).
- Carrossel de fotos, seleção de cor/tamanho direto no mosaico (estilo Foxton), parcelamento
  sem juros, abas de descrição/composição/como cuidar/tabela de medidas, "quem viu também
  gostou", cupom de desconto e cálculo de frete por CEP — tudo já implementado e no ar assim
  que você fizer os cadastros dos itens 4 e 5 acima.
- Robô de sincronização automática de estoque (GitHub Actions) pronto, só falta configurar
  os secrets do item 5.

Assim que tiver qualquer um dos itens 🔑 acima, me manda que eu já conecto e testo.

## Pendências que dependem do Mercado Pago (itens 3 e 6 acima)

A baixa automática de estoque no Bling quando um pedido é pago no site (site → Bling)
depende da conta do Mercado Pago estar configurada — combinamos deixar isso por último.
Quando o item 3 estiver pronto, eu finalizo:
- Validação da assinatura do webhook do Mercado Pago (segurança).
- Criação automática do pedido de venda no Bling quando um pagamento é aprovado.
- Baixa de estoque automática nesse momento.

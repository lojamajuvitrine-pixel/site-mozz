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

## 2. Bling — app de integração (API v3) ✅ (concluído em 23/08/2026)

- [x] App "Site MOZZ" criado em developer.bling.com.br, Client ID/Secret gerados.
- [x] Autorização feita (fluxo OAuth via `/api/bling/callback`), `BLING_REFRESH_TOKEN`
      obtido e funcionando.
- [x] Primeiro `npm run sync:bling` rodado com credenciais reais - catálogo atualizado com
      982 produtos das 4 marcas ativas (343 com estoque disponível, 495 com foto real).

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

## 7. Supabase — login do cliente (link mágico) e "Minha conta"

Implementei a área "Minha conta" com login sem senha: o cliente digita o e-mail, recebe um
link, clica e entra — sem senha nenhuma pra criar/esquecer/vazar. Falta só criar a conta que
guarda esse login (Supabase: banco de dados + autenticação, gratuito pra esse volume):

- [ ] Criar conta grátis em [supabase.com](https://supabase.com) e criar um novo projeto
      (nome sugerido: "site-mozz", região São Paulo se disponível).
- [ ] Dentro do projeto, ir em **Project Settings → API** e copiar dois valores: **Project
      URL** e a chave **anon public** (não a `service_role`, essa não deve sair de lá).
- [ ] Ir em **Authentication → URL Configuration** e preencher:
      - **Site URL**: `https://lojamozz.com.br`
      - **Redirect URLs**: adicionar `https://lojamozz.com.br/auth/callback` e também
        `https://site-mozz.vercel.app/auth/callback` (garante que funciona nos dois domínios
        enquanto a troca não está 100% migrada). O Supabase só deixa o link mágico redirecionar
        pra endereços que estiverem nessa lista.
- 🔑 Me manda o Project URL e a chave anon public. Eu coloco em `NEXT_PUBLIC_SUPABASE_URL` e
      `NEXT_PUBLIC_SUPABASE_ANON_KEY` (no `.env.local` e você replica em Project Settings →
      Environment Variables na Vercel, depois Redeploy).
- Observação: o histórico de pedidos dentro de "Minha conta" ainda vai aparecer vazio depois
  disso configurado — ele depende do item 3 (Mercado Pago) e da baixa automática de pedido no
  Bling, que ainda não existem. Por enquanto a conta serve pra login/identificação do cliente;
  assim que o pagamento estiver de ponta a ponta, eu ligo o histórico de verdade.

## 5. GitHub Actions — atualização automática de estoque ✅ (concluído em 23/08/2026)

- [x] Os 4 secrets criados (`BLING_CLIENT_ID`, `BLING_CLIENT_SECRET`, `BLING_REFRESH_TOKEN`,
      `GH_PAT_SECRETS`) e "Read and write permissions" ativado em Settings → Actions →
      General.
- [x] Testado manualmente (Run workflow) - rodou com sucesso. A partir de agora o robô roda
      sozinho a cada 5 minutos (9h-20h, seg-sáb) e mantém preço/estoque do site em dia com
      o Bling, sem precisar rodar nada na mão.

## O que eu já fiz enquanto isso

- Estrutura completa do site (Next.js), com a identidade visual monocromática que
  definimos, catálogo real sincronizado do Bling (982 produtos, 4 marcas), carrinho
  funcionando de ponta a ponta.
- Integração com o Bling ativa e sincronizando sozinha a cada 5 minutos (itens 2 e 5).
- Criação de preferência de pagamento e webhook do Mercado Pago prontos (só falta o
  Access Token, e um ajuste de segurança que já deixei anotado como TODO no código —
  validar a assinatura do webhook).
- Carrossel de fotos, seleção de cor/tamanho direto no mosaico (estilo Foxton), parcelamento
  sem juros, abas de descrição/composição/como cuidar/tabela de medidas, "quem viu também
  gostou", cupom de desconto e cálculo de frete por CEP — tudo já implementado, só falta o
  cadastro do item 4 (Melhor Envio) pro frete calcular de verdade.

Assim que tiver qualquer um dos itens 🔑 acima, me manda que eu já conecto e testo.

## Pendências que dependem do Mercado Pago (itens 3 e 6 acima)

A baixa automática de estoque no Bling quando um pedido é pago no site (site → Bling)
depende da conta do Mercado Pago estar configurada — combinamos deixar isso por último.
Quando o item 3 estiver pronto, eu finalizo:
- Validação da assinatura do webhook do Mercado Pago (segurança).
- Criação automática do pedido de venda no Bling quando um pagamento é aprovado.
- Baixa de estoque automática nesse momento.

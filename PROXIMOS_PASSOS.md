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

## 10. Login por código (não mais link) — 2 templates de e-mail pra ajustar no Supabase

Descoberto em 24/08/2026: com e-mail @hotmail/@outlook, o Microsoft Safe Links "clica"
sozinho em todo link de e-mail pra escanear segurança - isso consumia o link mágico (uso
único) antes do cliente clicar de verdade, dando sempre "link expirado". Troquei o login pra
usar um **código de 6 dígitos digitado na tela** em vez de link clicável - isso já está pronto
no código, mas precisa de um ajuste nos templates de e-mail do Supabase pra eles mostrarem o
código em vez do link:

- [ ] No painel do Supabase, ir em **Authentication → Email Templates**.
- [ ] Abrir o template **Magic Link** e trocar o conteúdo pra algo assim (pode ajustar o
      texto, o importante é ter `{{ .Token }}` em vez de qualquer link):

```html
<h2>Seu código de acesso MOZZ</h2>
<p>Use o código abaixo pra entrar no site:</p>
<h1 style="letter-spacing: 4px; font-size: 32px;">{{ .Token }}</h1>
<p>Esse código expira em alguns minutos e só vale uma vez.</p>
```

- [ ] Repetir o mesmo ajuste no template **Confirm signup** (é o que é usado no PRIMEIRO
      login de um e-mail novo, antes de existir conta - sem ajustar esse também, o problema
      volta a acontecer só no primeiro acesso de cada cliente novo).
- [ ] Salvar os dois.

Depois disso, o e-mail que o cliente recebe mostra só um código de 6 dígitos (sem nenhum
link pra escanear/"clicar sozinho"), e a tela de login em `/conta/entrar` já pede esse código
digitado.

## 9. Painel de produtos (preço especial, destaque e outlet) — precisa de 1 SQL no Supabase

Criei um painel interno em `/admin/produtos` (só você acessa, com o mesmo login por link
mágico da área do cliente) pra você poder, direto pelo site, sem mexer em nada dentro do
Bling:
- Colocar um **preço especial** em qualquer peça (o preço original do Bling aparece riscado
  do lado).
- Marcar peças como **destaque**, pra elas aparecerem priorizadas na vitrine "Novidades" da
  home.
- Marcar peças como **outlet**, pra elas aparecerem também na nova aba "Outlet" do menu (sem
  sair de onde já apareciam antes).

Isso fica guardado numa tabela própria do site no Supabase (não mexe na Lista de Preços nem
em nada do cadastro do Bling). Só falta você criar essa tabela — como eu não alcanço o
Supabase daqui, é um SQL rápido pra rodar uma vez:

- [ ] No painel do Supabase, ir em **SQL Editor → New query**, colar o SQL abaixo e clicar em
      **Run**:

```sql
create table public.produtos_site (
  produto_id text primary key,
  preco_especial numeric(10,2),
  destaque boolean not null default false,
  outlet boolean not null default false,
  atualizado_em timestamptz not null default now()
);

alter table public.produtos_site enable row level security;

create policy "Leitura publica de produtos_site"
on public.produtos_site for select
to anon, authenticated
using (true);

create policy "Somente admin escreve em produtos_site"
on public.produtos_site for all
to authenticated
using (auth.jwt() ->> 'email' = 'brbo15@hotmail.com')
with check (auth.jwt() ->> 'email' = 'brbo15@hotmail.com');
```

- Depois de rodar, acesse `https://lojamozz.com.br/admin/produtos` logado com seu e-mail
  (`brbo15@hotmail.com`) - é a mesma tela de login por link mágico da área do cliente.
- Se um dia quiser dar acesso ao painel pra mais alguém da equipe, me avisa: preciso
  atualizar tanto o `auth.jwt() ->> 'email' = ...` acima (troca por uma lista de e-mails, ex.
  `in ('brbo15@hotmail.com', 'outro@email.com')`) quanto o `lib/admin.ts` no código.
- As mudanças no painel aparecem no site em até uns 30 segundos (não precisa esperar o robô
  de sincronização do Bling nem redeploy).

## 8. Resend — e-mail próprio pro login ✅ (concluído em 23/08/2026)

- [x] Domínio `notificacoes.lojamozz.com.br` verificado no Resend (DKIM, SPF e MX
      confirmados via DNS).
- [x] SMTP custom configurado no Supabase (Authentication → Emails → SMTP Settings) usando
      o Resend - e-mail de login não depende mais do limite de 2/hora do Supabase.

## 5. GitHub Actions — atualização automática de estoque ✅ (concluído em 23/08/2026)

- [x] Os 4 secrets criados (`BLING_CLIENT_ID`, `BLING_CLIENT_SECRET`, `BLING_REFRESH_TOKEN`,
      `GH_PAT_SECRETS`) e "Read and write permissions" ativado em Settings → Actions →
      General.
- [x] Testado manualmente (Run workflow) - rodou com sucesso. A partir de agora o robô roda
      sozinho a cada 5 minutos (9h-20h, seg-sáb) e mantém preço/estoque do site em dia com
      o Bling, sem precisar rodar nada na mão.

## 11. "Avise-me quando voltar ao estoque" — tabela + 2 chaves novas

Adicionei na página do produto: quando o tamanho escolhido está esgotado, aparece um campo
pra cliente deixar o e-mail. Quando aquele tamanho específico volta a ter saldo (detectado no
próprio robô de sync que já roda a cada 5 minutos), ela recebe um e-mail automático via Resend
avisando. Falta duas coisas do seu lado:

- [ ] No painel do Supabase, **SQL Editor → New query**, colar e rodar:

```sql
create table public.avisos_estoque (
  id uuid primary key default gen_random_uuid(),
  produto_id text not null,
  tamanho text not null,
  email text not null,
  criado_em timestamptz not null default now(),
  notificado boolean not null default false,
  notificado_em timestamptz
);

create unique index avisos_estoque_pendente_unico
  on public.avisos_estoque (produto_id, tamanho, email)
  where not notificado;

alter table public.avisos_estoque enable row level security;

create policy "Qualquer um pode pedir aviso"
on public.avisos_estoque for insert
to anon, authenticated
with check (true);
```

  Só existe política de **insert** de propósito — ninguém (nem o site) consegue ler os
  e-mails salvos com a chave pública. Só o robô de sync consegue ler/marcar como notificado,
  usando uma chave separada (próximo item).

- [ ] Em **Project Settings → API**, além da chave `anon public` que você já mandou, agora
      preciso também da chave **`service_role`** (na mesma tela, um pouco mais abaixo — essa
      é secreta, nunca aparece pro navegador, só é usada pelo robô de sync que roda no GitHub).
- [ ] No painel do Resend ([resend.com](https://resend.com), mesma conta que já configuramos
      pro e-mail de login), ir em **API Keys → Create API Key** e gerar uma chave nova
      (permissão de "Sending" já basta).
- 🔑 Me manda os dois: a chave `service_role` do Supabase e a API Key do Resend. Eu coloco em
      `SUPABASE_SERVICE_ROLE_KEY` e `RESEND_API_KEY` (no `.env.local` local e como **secrets**
      novos no GitHub, pro robô automático também conseguir enviar).

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

# Próximos passos — o que só o Brunno pode fazer

Eu não posso criar contas, aceitar termos de serviço ou preencher formulários de
cadastro em nome de terceiros — isso é sempre uma ação pessoal, ligada ao CPF/CNPJ e à
titularidade da conta. Esse documento é o checklist do que falta *só do seu lado* pra eu
poder ligar o site de verdade nas contas da MOZZ. Assim que cada item estiver pronto, me
manda as informações marcadas com 🔑 (aqui no chat, ou direto no arquivo `.env.local` do
projeto) que eu sigo com a parte técnica.

## 1. Hospedagem (Vercel) + domínio ✅ (concluído em 24/08/2026)

- [x] Conta Vercel + GitHub conectados, site publicando automaticamente a cada push.
- [x] `lojamozz.com.br` apontado pra Vercel (registros DNS feitos no Registro.br) - já
      confirmei que está resolvendo com SSL funcionando.
- [x] `NEXT_PUBLIC_SITE_URL` atualizado pra `https://lojamozz.com.br` nas Environment
      Variables da Vercel e redeploy feito - sitemap, SEO e links de retorno do checkout já
      usam o domínio definitivo.

## 2. Bling — app de integração (API v3) ✅ (concluído em 23/08/2026)

- [x] App "Site MOZZ" criado em developer.bling.com.br, Client ID/Secret gerados.
- [x] Autorização feita (fluxo OAuth via `/api/bling/callback`), `BLING_REFRESH_TOKEN`
      obtido e funcionando.
- [x] Primeiro `npm run sync:bling` rodado com credenciais reais - catálogo atualizado com
      982 produtos das 4 marcas ativas (343 com estoque disponível, 495 com foto real).

## 3. Mercado Pago — conta e credenciais ✅ (concluído em 24/08/2026)

- [x] Aplicação "MOZZ Site" criada no Mercado Pago, credenciais de **produção** ativas
      (Access Token + Public Key) e já configuradas na Vercel - checkout processando
      pagamentos reais.
- Importante: confirmar no painel do Mercado Pago que há conta bancária vinculada pra
  receber os repasses das vendas.

## 4. Melhor Envio — cálculo de frete por CEP ✅ (concluído em 25/08/2026)

- [x] Conta criada em melhorenvio.com.br, token de API gerado.
- [x] CEP de origem (84320-000) anotado.
- [x] Token e CEP configurados em `MELHOR_ENVIO_TOKEN` e `MELHOR_ENVIO_CEP_ORIGEM` no
      `.env.local` e nas Environment Variables da Vercel (`MELHOR_ENVIO_SANDBOX=false`),
      site redeployado.
- [x] Testado ao vivo no site: cálculo de frete retornando várias transportadoras reais
      (Loggi, Jadlog, Correios, LATAM Cargo, Azul Cargo, Total Express) com preço e prazo.
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

## 7. Supabase — login do cliente (link mágico) e "Minha conta" ✅ (concluído)

- [x] Projeto Supabase criado, `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`
      configurados e funcionando.
- Observação: o histórico de pedidos dentro de "Minha conta" ainda depende da baixa
  automática de pedido no Bling (ver "Pendências que dependem do Mercado Pago" no fim do
  arquivo) — agora que o item 3 está pronto, isso é o próximo passo técnico que eu mesmo
  faço, sem precisar de nada do seu lado.

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

## 9. Painel de produtos (preço especial, destaque e outlet) ✅ (concluído em 24/08/2026)

Criei um painel interno em `/admin/produtos` (só você acessa, com o mesmo login por link
mágico da área do cliente) pra você poder, direto pelo site, sem mexer em nada dentro do
Bling:
- Colocar um **preço especial** em qualquer peça (o preço original do Bling aparece riscado
  do lado).
- Marcar peças como **destaque**, pra elas aparecerem priorizadas na vitrine "Novidades" da
  home.
- Marcar peças como **outlet**, pra elas aparecerem também na nova aba "Outlet" do menu (sem
  sair de onde já apareciam antes).

- [x] Tabela `produtos_site` criada no Supabase (5 colunas, RLS ativo, 2 políticas - leitura
      pública e escrita só pro seu e-mail admin). Já testado e confirmado.
- Acesse `https://lojamozz.com.br/admin/produtos` logado com seu e-mail
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

## 11. "Avise-me quando voltar ao estoque" ✅ (concluído em 24/08/2026)

- [x] Tabela `avisos_estoque` criada no Supabase (RLS ativo, só permite insert público).
- [x] `SUPABASE_SERVICE_ROLE_KEY` obtida e configurada em `.env.local` e como secret no
      GitHub Actions.
- [x] `RESEND_API_KEY` (chave nova, permissão "Sending") gerada e configurada do mesmo jeito.
- [x] Secret `NEXT_PUBLIC_SUPABASE_URL` também adicionado no GitHub Actions (o workflow
      precisava dele e ainda não existia lá).
- O robô de sync (a cada 5 minutos) agora já envia o e-mail automático via Resend quando um
  tamanho volta ao estoque.

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
  gostou", cupom de desconto e cálculo de frete por CEP — tudo implementado e funcionando,
  incluindo o frete real via Melhor Envio (item 4).

Assim que tiver qualquer um dos itens 🔑 acima, me manda que eu já conecto e testo.

## Pendências que dependem do Mercado Pago (itens 3 e 6 acima)

A baixa automática de estoque no Bling quando um pedido é pago no site (site → Bling)
depende da conta do Mercado Pago estar configurada — combinamos deixar isso por último.
Quando o item 3 estiver pronto, eu finalizo:
- Validação da assinatura do webhook do Mercado Pago (segurança).
- Criação automática do pedido de venda no Bling quando um pagamento é aprovado.
- Baixa de estoque automática nesse momento.

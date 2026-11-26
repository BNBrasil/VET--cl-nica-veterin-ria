# Redes sociais: como conseguir os tokens (Instagram e TikTok)

O escritório publica os vídeos do canal gamer usando as APIs oficiais. Para isso você precisa
criar um "app" de desenvolvedor em cada rede e gerar um **token de acesso**. Os tokens ficam só no seu
computador, em `escritorio-ia/data/segredos.json`, e são salvos pela página em
**⚙ Configurar → Redes sociais** (só no computador; o celular pareado não grava nem vê tokens).

> Sem nenhum token, tudo funciona em **modo simulação**: aprovar e postar faz o caminho inteiro, menos o envio.
> Dá para forçar esse modo mesmo com tokens marcando "Modo de teste" em Configurar → Redes sociais.

Resumo honesto das exigências:

| | Instagram | TikTok |
|---|---|---|
| Tipo de conta | **Profissional** (Criador ou Empresa) ligada a uma **Página do Facebook** | Qualquer conta; para teste sem auditoria, deixe a conta **privada** |
| App de desenvolvedor | Meta for Developers | TikTok for Developers |
| Revisão do app | Não precisa para usar com **a sua própria conta** (você é admin do app) | Precisa de **auditoria** para posts **públicos** pela postagem direta |
| Sem revisão/auditoria | Funciona normalmente para a sua conta | Postagem direta só sai **privada (SELF_ONLY)**; o modo **rascunho** funciona |
| Validade do token | ~60 dias (token de longa duração); depois gere outro | ~24 h; com refresh token (365 dias) o escritório renova sozinho |

---

## Instagram (Instagram Graph API, Reels)

1. **Conta Profissional.** No app do Instagram: Configurações → Tipo de conta e ferramentas → Mudar para conta profissional
   (Criador de conteúdo ou Empresa).
2. **Página do Facebook.** Crie uma Página (pode ser simples, com o nome do canal) e ligue a conta do Instagram a ela
   (Página → Configurações → Contas vinculadas → Instagram).
3. **App no Meta for Developers.** Entre em <https://developers.facebook.com/apps> → Criar app.
   Escolha o caso de uso para gerenciar conteúdo/mensagens do Instagram ("Facebook Login for Business" ou equivalente).
   Você precisa ser administrador do app e da Página.
4. **Permissões** (no Explorador da Graph API ou no fluxo de login do app):
   - `instagram_basic`
   - `instagram_content_publish`
   - `pages_show_list`
   - `pages_read_engagement`
   - (às vezes também `business_management`, se a Página estiver num Business Manager)
5. **Token.** No Explorador da Graph API (<https://developers.facebook.com/tools/explorer>) selecione o app,
   marque as permissões acima e gere um **token de usuário**. Ele dura ~1 hora; troque por um de **longa duração (~60 dias)**:
   ```
   GET https://graph.facebook.com/v27.0/oauth/access_token
       ?grant_type=fb_exchange_token&client_id=<APP_ID>&client_secret=<APP_SECRET>&fb_exchange_token=<TOKEN_CURTO>
   ```
   (Faça isso no próprio Explorador ou no navegador; não cole o app secret em lugares públicos.)
6. **IG user id.** No Explorador, com o token: `GET /me/accounts` → pegue o `id` da Página →
   `GET /<id-da-pagina>?fields=instagram_business_account` → o número em `instagram_business_account.id` é o **IG user id**.
7. Em **⚙ Configurar → Redes sociais → Instagram**, cole o token e o IG user id e clique em **Salvar Instagram**.

Limites e cuidados:
- Reels de 3 s a 15 min (o canal faz até 60 s), 9:16, H.264 + AAC. O escritório envia o arquivo do seu computador
  pelo upload "resumable" (`rupload.facebook.com`), então não precisa de servidor público.
- A API tem um limite de publicações por 24 h por conta (o número muda; confira `GET /<IG_USER_ID>/content_publishing_limit`).
- O token de 60 dias **expira**: quando a postagem der "Token do Instagram inválido ou expirado", gere outro (passo 5).
- A capa personalizada (`cover_url`) só funciona com uma imagem num endereço público HTTPS; sem isso o Instagram usa um quadro do vídeo.

## TikTok (Content Posting API)

1. **App no TikTok for Developers.** Entre em <https://developers.tiktok.com/apps> → Conectar um app.
   Preencha nome, ícone, descrição, termos de uso e política de privacidade (links reais; pode ser uma página simples).
2. **Produtos:** adicione **Login Kit** e **Content Posting API**. Na Content Posting API, ligue **Direct Post** se quiser
   publicação direta.
3. **Escopos:** `user.info.basic`, `video.upload` (rascunho) e `video.publish` (postagem direta).
4. **Sandbox.** Enquanto o app não é aprovado, use o modo **Sandbox** e adicione a sua conta como "Target user".
5. **Token.** Faça o login OAuth (Login Kit) com a sua conta para obter `access_token` (vale ~24 h) e `refresh_token`
   (vale ~1 ano). Para trocar o código do login pelo token:
   ```
   POST https://open.tiktokapis.com/v2/oauth/token/
   Content-Type: application/x-www-form-urlencoded
   client_key=<CLIENT_KEY>&client_secret=<CLIENT_SECRET>&code=<CODE>&grant_type=authorization_code&redirect_uri=<REDIRECT_URI>
   ```
6. Em **⚙ Configurar → Redes sociais → TikTok**: cole o access token, escolha o **modo** e a **privacidade**.
   Em "Renovação automática", cole também refresh token, client key e client secret para o escritório renovar o token sozinho.

### Rascunho × Direto (e o que acontece sem auditoria)

- **Rascunho** (`video.upload`): o vídeo vai para a **caixa de entrada** do app do TikTok no seu celular
  (notificação "Você tem um vídeo para editar"). Você abre, revisa e publica. **Funciona sem auditoria.**
  É o modo recomendado para começar.
- **Direto** (`video.publish`): publica sozinho. **Sem auditoria do app**, o TikTok:
  - só aceita postar em **conta privada** (erro `unaudited_client_can_only_post_to_private_accounts`);
  - publica com visibilidade **SELF_ONLY** (só você vê);
  - limita o número de usuários e de posts por dia.
  Para vídeos **públicos**, peça a **auditoria** do app (Content Posting API → Submit for review). O TikTok exige,
  entre outras coisas, que o usuário escolha a privacidade e veja uma prévia antes de postar — por isso a privacidade
  é escolhida por você em Configurar, e o escritório só usa uma opção que o `creator_info` da conta permita.

Outros limites: ~6 inícios de postagem por minuto por token, vídeo até a duração máxima informada pela conta
(normalmente 10 min), arquivo enviado em pedaços de 5–64 MB (feito automaticamente).

---

## Como o escritório usa isso

- `node producao/postar.js <id> [--redes tiktok,instagram] [--simular]` publica um post da fila.
- Post **crítico** (regras em `producao/CONTRATO.md`) nunca sai sem você aprovar na página
  (no computador ou no celular pareado). A CLI `fila.js aprovar` não libera crítico.
- Os resultados (link, id ou erro) ficam em `producao/saida/<id>/post.json` → `redes` e aparecem na aba **Produção**.

### O que conferir na primeira vez (não testado com contas reais aqui)
- Instagram: se o seu app usa "Instagram API com login do Facebook" (graph.facebook.com — o que o escritório usa).
  Apps novos só com "login do Instagram" usam graph.instagram.com e outro token; nesse caso avise o programador.
- TikTok: os nomes exatos de erro do seu app e se a conta precisa ficar privada no teste.
- Versão da Graph API: o padrão é `v27.0` (a mais nova em 11/2026); dá para trocar em `data/segredos.json` →
  `redes.instagram.versao`.

---
name: deploy
description: Use para rodar o Escritório de IA localmente (servidor, sprites, hooks, sessão do orquestrador) e para publicar sites estáticos de clientes (GitHub Pages, Netlify, Vercel, Cloudflare Pages) - comandos, checklist pré-publicação e como verificar depois. Acione quando pedirem para rodar, subir, publicar, colocar no ar ou atualizar um site.
---

# Deploy

## A. Rodar o escritório localmente
Requisitos: Node ≥ 18, Claude Code instalado.
```bash
cd escritorio-ia
npm install                 # só instala ws
npm run sprites             # gera public/assets/ (opcional: sem isso, a tela usa placeholders)
npm start                   # servidor em http://127.0.0.1:4317 (mude com ESCRITORIO_PORT=5000)
# abra http://127.0.0.1:4317 no navegador
```
Em outro terminal, na mesma pasta (para os hooks de `.claude/settings.json` valerem):
```bash
claude --agent orquestrador          # sessão principal = Recepção; delega para as salas
# ou: claude   (sessão normal também anima o orquestrador)
npm run demo                         # sem Claude: simula eventos para ver as animações
npm test                             # testes do servidor
```
Conferir: `curl -s http://127.0.0.1:4317/state | head -c 300`. Personagens não se mexem → skill `hooks-escritorio`.
Porta ocupada: `ESCRITORIO_PORT=4318 npm start` e exporte a mesma variável no terminal do `claude`.

## B. Publicar site estático
Estrutura esperada: uma pasta (`site/` ou `dist/`) com `index.html` na raiz e caminhos **relativos**.

Pré-visualizar: `python3 -m http.server 8080 -d site` ou `npx serve site`.

### GitHub Pages (via gh)
```bash
# opção 1: branch gh-pages com o conteúdo da pasta
git subtree push --prefix site origin gh-pages
gh api -X POST repos/{owner}/{repo}/pages -f "source[branch]=gh-pages" -f "source[path]=/"  # 1ª vez
# opção 2: GitHub Actions (actions/upload-pages-artifact + actions/deploy-pages) apontando para site/
gh api repos/{owner}/{repo}/pages --jq .html_url   # URL publicada
```
Repositório de projeto → URL com subcaminho `/<repo>/`: use caminhos relativos, não `/css/...`.

### Netlify
```bash
npx netlify-cli deploy --dir=site            # rascunho (URL de preview)
npx netlify-cli deploy --dir=site --prod     # produção
```
### Vercel
```bash
npx vercel site            # preview
npx vercel site --prod     # produção
```
### Cloudflare Pages
```bash
npx wrangler pages deploy site --project-name <nome>
```
Tokens (`NETLIFY_AUTH_TOKEN`, `VERCEL_TOKEN`, `CLOUDFLARE_API_TOKEN`) só em variável de ambiente,
nunca no repositório.

## Checklist pré-publicação
- [ ] Revisor APROVADO
- [ ] `index.html` na raiz, `<title>` e `<meta name="description">`, favicon
- [ ] Open Graph: `og:title`, `og:description`, `og:image` (1200x630)
- [ ] Links e imagens relativos funcionando no preview local
- [ ] 360 px e 1280 px ok (skill `ui-mobile`)
- [ ] Sem segredos, `.env`, `node_modules` ou arquivos brutos grandes na pasta publicada
- [ ] Publicar primeiro como preview; produção só com OK do orquestrador/cliente

## Depois de publicar
```bash
curl -sI https://<url>/ | head -5                # 200 e content-type text/html
curl -s https://<url>/ | grep -o '<title>.*</title>'
```
Registre a URL, a data e o comando usado no resumo de entrega. Rollback: Netlify/Vercel/Cloudflare
têm "promote" de deploy anterior no painel; GitHub Pages → reverta o commit da branch publicada.

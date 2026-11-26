# Linha de produção: canal de notícias gamer (TikTok + Instagram)

Fonte da verdade entre as frentes. Node >= 18, ES modules, sem dependências npm novas
(ffmpeg e Piper são programas externos). Tudo roda no computador do usuário (Windows principalmente,
mas testado aqui em Linux). Textos em português do Brasil.

## Fluxo de um vídeo
```
pesquisador ──pauta──▶ roteirista ──roteiro──▶ locutor (Piper) ──narração──▶ editor-video (montar.js)
      ▲                                                                          │
   fontes.js                                                       video.mp4 + legenda + capa
                                                                                 ▼
                         social-media ◀── revisor (fatos, direitos, qualidade, CRITICIDADE)
                              │
              não crítico → postar.js (TikTok + Instagram)    crítico → fila "aguardando" → você aprova na página
```

## Pastas (dentro de `escritorio-ia/`)
| Caminho | Dono | Conteúdo |
|---|---|---|
| `producao/fontes.js` | Pesquisa | coleta notícias (RSS) e promoções (Steam, Epic) → `producao/trabalho/fontes-<data>.json` |
| `producao/tts.js`, `producao/instalar-voz.js` | Vídeo | narração com Piper (offline, grátis) |
| `producao/montar.js`, `producao/lib/*` | Vídeo | monta o vídeo 9:16 a partir da pauta |
| `producao/sons/` | Vídeo | efeitos e trilhas **gerados por código** (sem licença de terceiros) |
| `producao/postar.js`, `producao/redes/*` | Postagem | publica no TikTok e no Instagram |
| `producao/fila.js` | Postagem | fila de posts (estados, regras de criticidade) |
| `producao/trabalho/` | (gerado, no .gitignore) | arquivos temporários |
| `producao/saida/<id>/` | (gerado, no .gitignore) | cada vídeo pronto + `post.json` |
| `.claude/agents/{pesquisador,locutor,social-media}.md` + skills | Pesquisa | novos agentes |
| `server/`, `public/` (aba Produção, Configurar → Redes e Agenda) | Postagem | interface e API |

## 1. `pauta.json` (o pesquisador/roteirista escreve; `montar.js` lê)
```json
{
  "id": "2026-11-26-gta6-trailer3",
  "titulo": "GTA 6: trailer 3 confirmado",
  "tipo": "noticia | promocao | lancamento",
  "voz": { "modelo": "pt_BR-faber-medium", "velocidade": 1.0 },
  "cenas": [
    { "tipo": "gancho",  "fala": "A Rockstar acabou de confirmar...", "texto": "TRAILER 3 CONFIRMADO", "imagem": null },
    { "tipo": "imagem",  "fala": "...", "texto": "...", "imagem": "caminho/ou/url.jpg", "credito": "Rockstar Games (kit de imprensa)" },
    { "tipo": "lista",   "fala": "...", "itens": [{ "nome": "Cyberpunk 2077", "de": "R$ 199,90", "por": "R$ 79,96", "desconto": "-60%" }] },
    { "tipo": "fim",     "fala": "Segue pra não perder nada!", "texto": "SIGA O CANAL" }
  ],
  "fontes": [{ "titulo": "...", "url": "https://...", "oficial": true }],
  "post": { "legenda": "texto do post", "hashtags": ["#gta6", "#gamer"] }
}
```
- Cada `fala` vira um trecho de narração; a duração da cena = duração do áudio + 0,3 s.
- `imagem` opcional; sem imagem, fundo animado gerado. Imagens só de fontes com direito de uso
  (kit de imprensa oficial, capa da loja Steam/Epic, arte gerada). `credito` aparece no canto.

## 2. Saída de `montar.js` (`node producao/montar.js <pauta.json>`)
`producao/saida/<id>/`: `video.mp4` (1080x1920, H.264 High, 30 fps, AAC 48 kHz, -14 LUFS, faststart, ≤ 60 s),
`legenda.srt` (sincronizada pela duração real de cada fala), `capa.jpg` (1080x1920), `post.json`:
```json
{ "id": "...", "criadoEm": 0, "video": "video.mp4", "capa": "capa.jpg", "legenda": "...", "hashtags": ["..."],
  "fontes": [], "duracao": 42.3, "estado": "pronto", "critico": null, "motivos": [], "redes": {} }
```

## 3. Fila e criticidade (`producao/fila.js`)
Estados: `pronto` → `revisado` → `aprovado` | `aguardando` → `publicando` → `publicado` | `erro` | `rejeitado`.
- O revisor marca `critico: true|false` e `motivos` (via `node producao/fila.js revisar <id> --critico --motivo "..."`).
- **Regras automáticas** (o script aplica SEMPRE, mesmo se o revisor disser que não é crítico) — vira crítico se:
  1. notícia baseada em rumor/vazamento ("rumor", "vazou", "leak", "boato", "suposto", "insider") ou sem fonte `oficial: true`;
  2. preço/promoção sem fonte da própria loja, ou promoção que termina em menos de 6 h;
  3. assunto sensível (mortes, crimes reais, política, polêmica com pessoas reais, menores, saúde);
  4. uso de imagem sem `credito`;
  5. primeira postagem em uma rede (ainda não houve nenhum `publicado` nela);
  6. legenda com menção/acusação a pessoa ou empresa.
- `postar.js` **recusa** publicar crítico sem `aprovado` (aprovação só pela página/API local do usuário).
- Crítico → estado `aguardando` + evento para a página (balão "?" no social-media e aviso no chat).

## 4. Postagem (`node producao/postar.js <id> [--redes tiktok,instagram] [--simular]`)
- Instagram: Graph API (conta Profissional ligada a Página do Facebook), Reels com upload **resumable**
  (`rupload.facebook.com`), depois `media_publish`. Token e IG user id em `data/segredos.json` → `redes.instagram`.
- TikTok: Content Posting API. `direct` (Direct Post, precisa de app auditado; sem auditoria só sai privado)
  ou `rascunho` (envia para a caixa de entrada do app do TikTok para você finalizar). Token em `redes.tiktok`.
- `--simular`: faz tudo menos a chamada final (para testar sem conta).
- Resultado por rede em `post.json.redes.<rede>` = `{ estado, url?, erro?, em }`.

## 5. Agenda automática
Configurar → Agenda: horários (ex.: 09:00, 18:00). No horário, o servidor manda ao orquestrador:
"Produza e publique o boletim gamer de agora (fluxo canal-gamer)". Pausável.

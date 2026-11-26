# Equipe de agentes do Escritório de IA

Cada arquivo aqui é um subagente do Claude Code. O `name` é **igual ao `id` da sala** em
`shared/rooms.json`: é assim que o servidor põe o personagem na sala certa quando chega o
`agent_type` do hook. As skills ficam em `.claude/skills/<nome>/SKILL.md` e cada agente só carrega
as listadas no próprio arquivo (subagentes não herdam skills da sessão principal).

> ## Regra nº 1 do escritório: contrato + no mínimo 4 agentes em paralelo
> Todo pedido começa com `entregas/<aaaa-mm-dd>-<slug>/CONTRATO.md` (objetivo, ≥ 4 frentes, dono e
> arquivos exclusivos de cada uma, interfaces, dependências, critério de pronto) e roda em **ondas
> paralelas**: o orquestrador dispara **4 ou mais chamadas Agent na mesma resposta**, quem depende
> começa com placeholder no formato do contrato, e o revisor entra desde a primeira onda.
> Pedido pequeno vira frentes complementares (pesquisa, rascunho, alternativas, pré-revisão, assets,
> legendas/hashtags) — nunca menos de 4. Detalhes: skill `contrato-paralelo`.

| Agente | Sala | Modelo | Cor | Ferramentas | Skills |
|---|---|---|---|---|---|
| `orquestrador` | Recepção | opus | orange | Agent, Read, Write, Edit, Glob, Grep, TodoWrite | contrato-paralelo, briefing, checklist-entrega, canal-gamer |
| `roteirista` | Sala de Roteiro | opus | yellow | Read, Write, Edit, WebSearch, WebFetch | estrutura-roteiro, ganchos-reels, tom-de-voz, nicho-gamer |
| `editor-video` | Sala de Edição | sonnet | purple | Read, Write, Bash | cortes-ffmpeg, legendas-srt, padrao-export, nicho-gamer |
| `animador` | Estúdio de Animação | sonnet | cyan | Read, Write, Edit, Bash | motion-remotion, sprite-aseprite, paleta-escritorio |
| `programador` | Sala de Servidores | sonnet | green | Read, Edit, Write, Bash, Grep, Glob | padrao-api, testes, hooks-escritorio |
| `desenvolvedor` | App-Mobile | sonnet | blue | Read, Edit, Write, Bash, Grep, Glob | phaser-escritorio, ui-mobile, deploy |
| `designer` | Estúdio de Design | sonnet | pink | Read, Write, Edit, WebFetch | identidade-visual, templates-posts |
| `revisor` | Sala de Revisão | sonnet | red | Read, Grep, Glob, Bash (só `fila.js ver/revisar` e `ffprobe`), WebFetch — não edita | checklist-qa, ortografia, criterios-criticos, nicho-gamer |
| `pesquisador` | (visitante no lounge) | sonnet | green | Read, Write, Edit, Bash, Grep, Glob, WebSearch, WebFetch | pesquisa-noticias-gamer, nicho-gamer |
| `locutor` | (visitante no lounge) | sonnet | cyan | Read, Write, Edit, Bash | locucao-piper |
| `social-media` | (visitante no lounge) | sonnet | pink | Read, Write, Edit, Bash | postagem-redes, criterios-criticos, ganchos-reels |
| `editor-vlog` | Sala de Edição (divide com o editor-video) | sonnet | purple | Read, Write, Edit, Bash, Glob, Grep | vlog-edicao, cortes-ffmpeg, padrao-export, legendas-srt, ganchos-reels |

`pesquisador`, `locutor` e `social-media` são do canal gamer (`producao/CONTRATO.md`) e ainda não têm
sala em `shared/rooms.json`: o servidor os mostra como visitantes no lounge até ganharem sala.
O revisor passou de haiku para sonnet porque agora confere fatos, direitos de imagem e criticidade.

## Como usar
```bash
npm start                         # servidor + tela em http://127.0.0.1:4317
claude --agent orquestrador       # em outro terminal, na pasta escritorio-ia
```
O orquestrador só delega quando é a sessão principal (subagente não chama subagente). Para testar
uma sala isolada, peça na sessão: "use o agente <nome> para …" ou `/agents` para ver a lista.

## Teste por sala (uma tarefa real cada)
Todas gravam em `entregas/teste/`. Veja a sala acender na tela enquanto roda.

| Agente | Prompt de teste | Pronto quando |
|---|---|---|
| orquestrador | `Quero um reels de 30 s explicando o Escritório de IA para donos de clínica veterinária, com versão para YouTube.` | escreve CONTRATO.md, cria TodoWrite, dispara ondas de 4+ agentes na mesma resposta (revisor desde a onda 1) e entrega com checklist |
| roteirista | `Use o roteirista: roteiro de reels de 30 s "3 sinais de que seu pet precisa de check-up", com 3 ganchos, tabela de cenas e legenda do post. Salve em entregas/teste/roteiro/.` | `roteiro.md` com ~75 palavras, ★ no gancho, tabela sem buracos |
| editor-video | `Use o editor-video: gere um vídeo de teste com ffmpeg testsrc (20 s, 1920x1080, com tom de áudio), corte de 00:05 a 00:15, exporte 9:16 e 16:9 com a legenda entregas/teste/legenda.srt e gere thumbnail. Salve em entregas/teste/video/.` | 2 MP4 + thumb + `cortes.md` com ffprobe; bruto intacto |
| animador | `Use o animador: vinheta de 3 s "Clínica Amigo Fiel" em 9:16 e 16:9 com o template Remotion. Salve em entregas/teste/anim/.` | 2 MP4 30 fps + `anim.md` com comando de render |
| programador | `Use o programador: adicione GET /health ao servidor do escritório respondendo {ok:true,uptime} e um teste node:test.` | `npm test` verde, contrato inalterado |
| desenvolvedor | `Use o desenvolvedor: landing page de 1 página para a "Clínica Amigo Fiel" em entregas/teste/site/, mobile-first, e diga como publicar no Netlify (não publique).` | página sem rolagem horizontal em 360 px, instruções de deploy |
| designer | `Use o designer: post 1080x1350 e story 1080x1920 "Vacinação em dia" para a Clínica Amigo Fiel, em SVG, com paleta e fontes documentadas.` | 2 SVG + `design.md`, área segura e contraste ok |
| revisor | `Use o revisor: revise entregas/teste/roteiro/roteiro.md e entregas/teste/legenda.srt.` | `VEREDITO: APROVADO` ou `REPROVADO` com lista numerada |
| pesquisador | `Use o pesquisador: levante as promoções da Steam, os jogos grátis da Epic e as notícias de GTA de hoje e proponha 3 pautas com fontes.` | `fontes-<data>.json` + `pesquisa-<data>.md` com fato x rumor e rascunho de `pauta-<id>.json` |
| locutor | `Use o locutor: instale a voz e acrescente ao pronuncia.json os nomes de jogos das promoções de hoje; gere um teste com "Red Dead Redemption 2 por setenta e quatro reais".` | `pronuncia.json` válido com termos novos e WAV de teste em `producao/trabalho/` |
| social-media | `Use o social-media: escreva legenda e hashtags (TikTok e Instagram) para um vídeo "Bread and Fred grátis na Epic até 03/12" e rode postar.js --simular no id de teste.` | 2 legendas com 3–5 hashtags e resultado do simulado; não publica crítico |
| editor-vlog | `Use o editor-vlog: edite meu vlog (rode node vlog/analisar.js, escolha os momentos de cada data e gere os vídeos com vlog/renderizar.js).` | por data: youtube-16x9.mp4, reels-9x16.mp4, capas e textos em vlog/postar/<data>/ |

## Fluxo completo de exemplo (ondas paralelas)
```
Você → orquestrador: "Reels de 30 s + versão YouTube: 'Vacina do seu pet em dia em 3 passos'."
0. orquestrador  briefing + CONTRATO.md (frentes, arquivos, interfaces) + TodoWrite
1. ONDA 1 (5 ao mesmo tempo, uma resposta com 5 chamadas Agent):
   roteirista (roteiro + ganchos) ∥ animador (vinheta) ∥ designer (capa/thumb) ∥
   revisor (pré-revisão do contrato) ∥ editor-video (timeline com placeholder)
2. ONDA 2 (4+): editor-video (monta) ∥ animador (cenas extras) ∥ roteirista (legenda/.srt) ∥ revisor
3. ONDA 3 (4+): revisor (final) ∥ editor-video (correções) ∥ designer (thumb final) ∥ roteirista (ajustes)
4. orquestrador  checklist-entrega + mensagem final com caminhos
```

## Canal gamer ("produza o boletim gamer")
Skill `canal-gamer` (o orquestrador segue). Comandos da linha de produção (`producao/CONTRATO.md`):
```
node producao/fontes.js --tema tudo|gta|promocoes|lancamentos   pesquisador → producao/trabalho/fontes-<data>.json
node producao/instalar-voz.js / node producao/tts.js             locutor (Piper, grátis, offline)
node producao/montar.js producao/trabalho/pauta-<id>.json        editor-video → producao/saida/<id>/
node producao/fila.js revisar <id> [--critico --motivo "..."]    revisor (criticidade)
node producao/postar.js <id> [--redes tiktok,instagram] [--simular]   social-media
```
Onda 1: pesquisador ∥ roteirista ∥ designer ∥ social-media ∥ locutor ·
Onda 2: roteirista (pauta.json) ∥ locutor (narra) ∥ editor-video (montar.js) ∥ revisor (fatos) ·
Onda 3: revisor (final + criticidade) ∥ social-media (posta não críticos) ∥ editor-video ∥ designer.
Crítico (6 regras em `criterios-criticos`) fica `aguardando` até você aprovar na página.
Guia do nicho: `producao/nicho.md`.

## Validação
Ver `.claude/skills/` (28 skills; novas: contrato-paralelo, canal-gamer, pesquisa-noticias-gamer, nicho-gamer, locucao-piper, postagem-redes, criterios-criticos). Scripts auxiliares testáveis:
`cortes-ffmpeg/testar.sh`, `padrao-export/export.sh`, `legendas-srt/checar-srt.mjs`,
`sprite-aseprite/checar-sprite.mjs`, `paleta-escritorio/palette-to-gpl.mjs`, `motion-remotion/template/`.

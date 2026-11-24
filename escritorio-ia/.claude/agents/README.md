# Equipe de agentes do Escritório de IA

Cada arquivo aqui é um subagente do Claude Code. O `name` é **igual ao `id` da sala** em
`shared/rooms.json`: é assim que o servidor põe o personagem na sala certa quando chega o
`agent_type` do hook. As skills ficam em `.claude/skills/<nome>/SKILL.md` e cada agente só carrega
as listadas no próprio arquivo (subagentes não herdam skills da sessão principal).

| Agente | Sala | Modelo | Cor | Ferramentas | Skills |
|---|---|---|---|---|---|
| `orquestrador` | Recepção | opus | orange | Agent, Read, Write, Edit, Glob, Grep, TodoWrite | briefing, checklist-entrega |
| `roteirista` | Sala de Roteiro | opus | yellow | Read, Write, Edit, WebSearch, WebFetch | estrutura-roteiro, ganchos-reels, tom-de-voz |
| `editor-video` | Sala de Edição | sonnet | purple | Read, Write, Bash | cortes-ffmpeg, legendas-srt, padrao-export |
| `animador` | Estúdio de Animação | sonnet | cyan | Read, Write, Edit, Bash | motion-remotion, sprite-aseprite, paleta-escritorio |
| `programador` | Sala de Servidores | sonnet | green | Read, Edit, Write, Bash, Grep, Glob | padrao-api, testes, hooks-escritorio |
| `desenvolvedor` | App-Mobile | sonnet | blue | Read, Edit, Write, Bash, Grep, Glob | phaser-escritorio, ui-mobile, deploy |
| `designer` | Estúdio de Design | sonnet | pink | Read, Write, Edit, WebFetch | identidade-visual, templates-posts |
| `revisor` | Sala de Revisão | haiku | red | Read, Grep, Glob (só leitura) | checklist-qa, ortografia |

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
| orquestrador | `Quero um reels de 30 s explicando o Escritório de IA para donos de clínica veterinária, com versão para YouTube.` | faz briefing, cria TodoWrite, delega roteiro → animação → edição → revisão e entrega com checklist |
| roteirista | `Use o roteirista: roteiro de reels de 30 s "3 sinais de que seu pet precisa de check-up", com 3 ganchos, tabela de cenas e legenda do post. Salve em entregas/teste/roteiro/.` | `roteiro.md` com ~75 palavras, ★ no gancho, tabela sem buracos |
| editor-video | `Use o editor-video: gere um vídeo de teste com ffmpeg testsrc (20 s, 1920x1080, com tom de áudio), corte de 00:05 a 00:15, exporte 9:16 e 16:9 com a legenda entregas/teste/legenda.srt e gere thumbnail. Salve em entregas/teste/video/.` | 2 MP4 + thumb + `cortes.md` com ffprobe; bruto intacto |
| animador | `Use o animador: vinheta de 3 s "Clínica Amigo Fiel" em 9:16 e 16:9 com o template Remotion. Salve em entregas/teste/anim/.` | 2 MP4 30 fps + `anim.md` com comando de render |
| programador | `Use o programador: adicione GET /health ao servidor do escritório respondendo {ok:true,uptime} e um teste node:test.` | `npm test` verde, contrato inalterado |
| desenvolvedor | `Use o desenvolvedor: landing page de 1 página para a "Clínica Amigo Fiel" em entregas/teste/site/, mobile-first, e diga como publicar no Netlify (não publique).` | página sem rolagem horizontal em 360 px, instruções de deploy |
| designer | `Use o designer: post 1080x1350 e story 1080x1920 "Vacinação em dia" para a Clínica Amigo Fiel, em SVG, com paleta e fontes documentadas.` | 2 SVG + `design.md`, área segura e contraste ok |
| revisor | `Use o revisor: revise entregas/teste/roteiro/roteiro.md e entregas/teste/legenda.srt.` | `VEREDITO: APROVADO` ou `REPROVADO` com lista numerada |

## Fluxo completo de exemplo
```
Você → orquestrador: "Reels de 30 s + versão YouTube: 'Vacina do seu pet em dia em 3 passos'."
1. orquestrador  briefing.md + plano (TodoWrite)                     Recepção: carimba / kanban
2. roteirista    roteiro.md, 3 ganchos, tabela de cenas, legenda    Roteiro: máquina de escrever
3. animador      vinheta 3 s (cena 1) em 9:16 e 16:9                Animação: mesa digitalizadora
   designer      (em paralelo) thumbnail 1280x720 e capa 1080x1920   Design: roda de cores
4. editor-video  montagem, .srt, 9:16 + 16:9, loudnorm, thumb        Edição: timeline correndo
5. revisor       APROVADO / REPROVADO (volta só os itens; máx. 2x)   Revisão: lupa + carimbo
6. orquestrador  checklist-entrega + mensagem final com caminhos    Recepção: comemora
```

## Validação
Ver `.claude/skills/` (21 skills). Scripts auxiliares testáveis:
`cortes-ffmpeg/testar.sh`, `padrao-export/export.sh`, `legendas-srt/checar-srt.mjs`,
`sprite-aseprite/checar-sprite.mjs`, `paleta-escritorio/palette-to-gpl.mjs`, `motion-remotion/template/`.

# Escritório de IA Animado

Cada subagente do Claude Code vira um personagem pixel art (16-bit, vista 3/4) sentado na sua sala.
O personagem anima conforme o que o agente está fazendo:

| Situação | Na tela |
|---|---|
| Trabalhando | animação da função (editor na timeline, roteirista na máquina de escrever...) |
| Lendo / pesquisando | folheia papel; lupa quando é busca na web |
| Sem tarefa | ocioso → cochila (20 s) → dorme na cadeira com "zZz" (60 s) → vai dormir no sofá do lounge (2 min) |
| Precisa de você | balão "?" piscando sobre a cabeça |
| Erro de ferramenta | gota de suor / fumaça por 2 s |
| Terminou | comemora por 2 s e volta a ficar ocioso |

Toda a arte é própria (gerada por código em `art/`), então não há restrição de licença de pacotes de terceiros.

## Como rodar

```bash
cd escritorio-ia
npm install          # instala só o "ws"
npm run sprites      # (opcional) regenera os sprites em public/assets/
npm start            # servidor em http://127.0.0.1:4317
```

Abra **http://127.0.0.1:4317** no navegador.

- **Ver sem o Claude Code:** com o servidor ligado, rode `npm run demo` (ou `npm run demo -- --loop --fast`)
  em outro terminal: ele simula o fluxo roteiro → animação → edição → revisão.
- **Ver sem servidor nenhum:** abra `public/index.html` servido por qualquer servidor estático com `?demo=1`.
- **Usar de verdade:** abra o Claude Code **dentro da pasta `escritorio-ia/`** (é onde estão
  `.claude/settings.json`, os agentes e as skills). Os hooks mandam cada evento para o servidor.
  Para a sessão principal agir como orquestrador: `claude --agent orquestrador`.
- Testes: `npm test`.
- Porta: variável `ESCRITORIO_PORT` (padrão 4317) — use a mesma no servidor e no Claude Code.

## Arquitetura

```
Subagentes (Claude Code) ──evento──▶ Hooks (.claude/settings.json → hooks/send-event.js)
      ──POST JSON──▶ Servidor local (server/, Node) ──WebSocket /ws──▶ Tela do escritório (public/, Canvas)
```

- `hooks/send-event.js` — recebe o JSON do hook no stdin e faz POST para o servidor; nunca trava o Claude Code.
- `server/state.js` — máquina de estados de cada personagem (eventos + timers 20 s / 60 s / 2 min).
- `server/index.js` — HTTP (estático + `/event` + `/state`) e WebSocket.
- `public/` — tela do escritório em Canvas 2D, sem build; funciona também com quadrados coloridos se faltar sprite.
- `art/` — gerador de sprites em Node puro: paleta fechada, PNG + JSON no formato Aseprite (que Phaser e PixiJS também leem).
- `.claude/agents/` — os 8 agentes; `.claude/skills/` — as skills de cada cargo.
- `shared/rooms.json` — salas, cores de destaque, posição no mapa e tempos (ajuste aqui os 20 s / 60 s).

O protocolo completo (eventos, estados, mensagens, formato dos sprites) está em [`CONTRATO.md`](CONTRATO.md).

## A equipe

| Agente | Sala | Modelo | Trabalhando |
|---|---|---|---|
| orquestrador | Recepção | opus | carimba papéis, move cartões no kanban |
| roteirista | Sala de Roteiro | opus | bate na máquina de escrever |
| editor-video | Sala de Edição | sonnet | fone no ouvido, mão no mouse, timeline correndo |
| animador | Estúdio de Animação | sonnet | desenha na mesa digitalizadora |
| programador | Sala de Servidores | sonnet | digita rápido, código verde rolando |
| desenvolvedor | App-Mobile | sonnet | testa app no celular |
| designer | Estúdio de Design | sonnet | gira a roda de cores |
| revisor | Sala de Revisão | haiku | olha com a lupa e bate o carimbo |

Áreas comuns sem agente: **Copa** e **Lounge**. Agentes desconhecidos (ex.: `Explore`) aparecem como visitantes no lounge.
Detalhes e prompts de teste de cada sala: [`.claude/agents/README.md`](.claude/agents/README.md).

## Como o projeto foi dividido

As cinco frentes do documento foram feitas em paralelo, cada uma por um subagente, a partir de um
contrato comum (`CONTRATO.md`): back-end de eventos, pixel art, front do escritório, engenharia de
agentes e integração/produto.

## Próximos passos (polimento)

- Sons (máquina de escrever, carimbo, "ding" ao terminar).
- Trocar a arte gerada por arte retocada no Aseprite mantendo os mesmos nomes de tags — o front não muda.
- Decidir a pergunta em aberto: uso interno ou produto? Como a arte já é própria, as duas opções ficam abertas.

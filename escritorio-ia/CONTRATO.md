# Contrato entre as frentes (fonte da verdade)

Projeto: **Escritório de IA Animado**. Raiz: `escritorio-ia/`. Node >= 18, ES modules (`"type": "module"`),
única dependência de runtime: `ws`. Sem etapa de build no front (HTML + ES modules + Canvas 2D).
Salas, cores e tempos ficam em `shared/rooms.json` — **ninguém duplica esses valores, todos leem o arquivo**.

## Estrutura de pastas e dono de cada uma

| Caminho | Frente (dono) |
|---|---|
| `server/`, `hooks/`, `scripts/demo.js`, `test/`, `.claude/settings.json` | Back-end de eventos |
| `art/`, `public/assets/` (gerado por `npm run sprites`) | Pixel art |
| `public/index.html`, `public/css/`, `public/js/` | Front do escritório |
| `.claude/agents/`, `.claude/skills/` | Engenharia de agentes |
| `README.md`, `CONTRATO.md`, `package.json`, `shared/` | Integração (orquestrador) |

## 1. Hooks → servidor

- `hooks/send-event.js`: lê o JSON do hook no stdin e faz `POST http://127.0.0.1:${ESCRITORIO_PORT||4317}/event`
  com o JSON **cru** no corpo. Timeout 800 ms. **Nunca** falha nem imprime em stdout (sempre `exit 0`),
  para não atrapalhar o Claude Code se o servidor estiver desligado.
- `.claude/settings.json` registra o script em: `SessionStart`, `UserPromptSubmit`, `SubagentStart`,
  `SubagentStop`, `PreToolUse`, `PostToolUse`, `PostToolUseFailure`, `Notification`, `Stop`, `SessionEnd`.
  Comando: `node "$CLAUDE_PROJECT_DIR/hooks/send-event.js"`.
- Campos usados do JSON do hook: `hook_event_name`, `session_id`, `tool_name`, `agent_id`, `agent_type`,
  `message`, `prompt` (opcional), `error` (opcional).

## 2. Mapeamento evento → sala

- `agent_type` igual a um `id` de `shared/rooms.json` → aquela sala.
- Sem `agent_type` (sessão principal) → `orquestrador`.
- `agent_type` desconhecido (ex.: `Explore`) → vira **visitante** com id `visitante:<agent_type>`, `room: "lounge"`.
- `SessionStart` → todos os personagens das 8 salas passam de `absent` para `idle` ("entram e sentam").

## 3. Estados do personagem (servidor é a autoridade)

`state` ∈ `absent | idle | working | waiting | done | error | dozing | sleeping`
`activity` (só quando `working`) ∈ `typing | reading | machine | searching | thinking`

| Evento | Efeito |
|---|---|
| `UserPromptSubmit` | orquestrador → `working/thinking` |
| `SubagentStart` | sala do `agent_type` → `working/thinking` |
| `PreToolUse` Edit, Write, MultiEdit, NotebookEdit | `working/typing` |
| `PreToolUse` Read, Grep, Glob, LS | `working/reading` |
| `PreToolUse` Bash | `working/machine` |
| `PreToolUse` WebSearch, WebFetch | `working/searching` |
| `PreToolUse` Task, Agent (orquestrador delegando) | `working/typing` |
| `PreToolUse` outra ferramenta | `working/thinking` |
| `PostToolUse` | continua `working` (atualiza `lastEventAt`) |
| `PostToolUseFailure` | `error` por `timers.errorMs`, depois volta ao estado anterior |
| `Notification` | `waiting` (balão "?") até o próximo evento daquele agente |
| `SubagentStop` | sala do agente → `done` por `doneMs`, depois `idle`; `tasksDone++` |
| `Stop` | orquestrador → `done` → `idle`; `tasksDone++` |
| `SessionEnd` | todos → `idle` |
| sem evento por `dozeAfterMs` (20 s) estando `idle` | `dozing` |
| sem evento por `sleepAfterMs` (60 s) | `sleeping` |
| sem evento por `loungeAfterMs` (120 s) | `sleeping` com `location: "lounge"` (dorme no sofá) |
| qualquer evento novo | acorda (`location` volta para a sala) |

Os tempos contam a partir de `lastEventAt`. `waiting` não cochila.

## 4. Servidor → tela

- Porta `ESCRITORIO_PORT` (padrão **4317**), host `127.0.0.1`. O mesmo servidor HTTP:
  - serve estático de `public/` (GET `/` → `public/index.html`) e `GET /shared/rooms.json`;
  - `POST /event` (corpo = JSON do hook) → `204`;
  - `GET /state` → `{ agents: Agent[], rooms, serverTime }`;
  - WebSocket no caminho `/ws`.
- Mensagens WebSocket (JSON):
  - ao conectar: `{ "type": "snapshot", "agents": Agent[], "serverTime": number }`
  - a cada mudança: `{ "type": "agent", "agent": Agent }`
  - log de evento: `{ "type": "event", "event": { "at": number, "agentId": string, "hook": string, "tool": string|null, "summary": string } }`
- `Agent`:
```json
{ "id": "editor-video", "room": "editor-video", "location": "editor-video", "visitor": false,
  "state": "working", "activity": "machine", "tool": "Bash",
  "since": 1732460000000, "lastEventAt": 1732460000000, "tasksDone": 3, "lastMessage": "ffmpeg -i ..." }
```

## 5. Pixel art → front (`public/assets/`)

Regras de estilo: tiles 16x16, personagens 16x32, paleta fechada de 32 a 48 cores (`art/palette.js`,
exportada em `public/assets/palette.json`), exibição em escala inteira com nearest neighbor.

Arquivos gerados por `npm run sprites` (gerador próprio em Node puro, PNG via `zlib`, sem dependências):

- `public/assets/manifest.json`:
```json
{
  "tile": 16, "char": { "w": 16, "h": 32 },
  "room": { "w": 160, "h": 112 },
  "animations": { "base_idle": { "fps": 4, "loop": true }, "...": {} },
  "characters": { "<roomId>": { "image": "char_<roomId>.png", "data": "char_<roomId>.json" } },
  "rooms": { "<roomId|copa|lounge>": {
      "background": "room_<id>.png",
      "seat":   { "x": 72, "y": 56 },
      "object": { "image": "obj_<id>.png", "data": "obj_<id>.json", "x": 88, "y": 40 },
      "sofa":   { "x": 40, "y": 60 } } },
  "fx": { "image": "fx.png", "data": "fx.json" },
  "visitor": { "image": "char_visitante.png", "data": "char_visitante.json" }
}
```
  (`seat` = pé do personagem, ponto inferior-central, em pixels da sala; `sofa` só no lounge.)
- `char_<roomId>.png/.json` e `char_visitante.*`: sprite sheet em **formato Aseprite JSON hash**
  (`frames: { "<anim>_<n>": { frame:{x,y,w,h}, duration } }`, `meta.frameTags: [{ name, from, to, direction }]`).
  Tags obrigatórias: `base_idle, base_read, base_doze, base_sleep, base_wait, base_done, base_error,
  base_walk_down, base_walk_up, base_walk_left, base_walk_right, <roomId>_work`
  (o visitante usa `visitante_work`). Quadros/FPS conforme a tabela do PDF
  (work 4–6@8, read 4@6, idle 2@4, doze 4@4, sleep 4@3, wait 2@4, done 4@8, error 3@6, walk 4@8).
- `room_<id>.png`: fundo 160x112 já com piso, paredes e móveis do ambiente descrito no PDF.
- `obj_<id>.png/.json`: objeto animado da sala, tags `obj_off`, `obj_work`, `obj_sleep`
  (tela acende quando trabalha, descanso de tela quando dorme).
- `fx.png/.json`: tags `fx_zzz`, `fx_question`, `fx_smoke`, `fx_sweat`, `fx_star`, `fx_magnifier`.

O front **precisa funcionar sem os assets** (modo placeholder com quadrados coloridos:
verde trabalhando, cinza dormindo, amarelo esperando), conforme o passo 2 do PDF.

## 6. Mapeamento estado → animação (front)

| state/activity | Personagem | FX | Objeto |
|---|---|---|---|
| working/typing, working/machine, working/thinking | `<roomId>_work` | — | `obj_work` |
| working/reading | `base_read` | — | `obj_work` |
| working/searching | `base_read` | `fx_magnifier` | `obj_work` |
| idle | `base_idle` | — | `obj_off` |
| dozing | `base_doze` | — | `obj_off` |
| sleeping | `base_sleep` | `fx_zzz` | `obj_sleep` |
| waiting | `base_wait` | `fx_question` (piscando) | `obj_work` |
| done | `base_done` | `fx_star` | `obj_work` |
| error | `base_error` | `fx_smoke` (ou `fx_sweat`) | `obj_work` |
| absent | não desenha (cadeira vazia) | — | `obj_off` |

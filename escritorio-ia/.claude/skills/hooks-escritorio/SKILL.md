---
name: hooks-escritorio
description: Use para manter ou depurar a ligação Claude Code → servidor do próprio Escritório de IA - hooks registrados, script hooks/send-event.js, POST /event, mapeamento evento → sala → estado, timers, GET /state e WebSocket /ws. Acione quando um personagem não se mexe, fica na sala errada, não dorme, ou quando for mudar o protocolo.
---

# Hooks do escritório (protocolo)

Fonte da verdade: **`CONTRATO.md`** (seções 1–4). Este resumo é para manutenção; se divergir, vale o contrato.
Salas e tempos: **`shared/rooms.json`** (nunca duplique valores no código).

## Fluxo
```
Claude Code ──hook (stdin JSON)──> hooks/send-event.js ──POST /event──> server (127.0.0.1:4317)
                                                                      ├─ GET /state
                                                                      └─ WS /ws ──> public/ (tela)
```

## 1. Registro dos hooks (`.claude/settings.json`, dono: back-end)
Eventos: `SessionStart`, `UserPromptSubmit`, `SubagentStart`, `SubagentStop`, `PreToolUse`,
`PostToolUse`, `PostToolUseFailure`, `Notification`, `Stop`, `SessionEnd`.
Comando: `node "$CLAUDE_PROJECT_DIR/hooks/send-event.js"`. Formato de cada entrada:
```json
{ "hooks": { "PreToolUse": [ { "matcher": "*", "hooks": [ { "type": "command", "command": "node \"$CLAUDE_PROJECT_DIR/hooks/send-event.js\"" } ] } ] } }
```

## 2. `hooks/send-event.js` (regras invioláveis)
- Lê o JSON do stdin e faz `POST http://127.0.0.1:${ESCRITORIO_PORT||4317}/event` com o JSON **cru**.
- Timeout **800 ms**. **Sempre `exit 0`**, **nada em stdout** (stdout de hook pode virar contexto/decisão
  no Claude Code). Erros, se precisar, só em stderr e só com `ESCRITORIO_DEBUG=1`.

## 3. Mapeamento → sala
| Situação | Personagem |
|---|---|
| `agent_type` = `id` de `shared/rooms.json` | aquela sala |
| sem `agent_type` (sessão principal) | `orquestrador` |
| `agent_type` desconhecido (ex.: `Explore`) | visitante `visitante:<agent_type>`, `room: "lounge"` |
| `SessionStart` | as 8 salas: `absent` → `idle` |

Por isso o `name` de cada arquivo em `.claude/agents/` é **igual** ao id da sala.

## 4. Estados
`state`: `absent | idle | working | waiting | done | error | dozing | sleeping`
`activity` (só em `working`): `typing | reading | machine | searching | thinking`

| Evento | Efeito |
|---|---|
| `UserPromptSubmit` | orquestrador → working/thinking |
| `SubagentStart` | sala → working/thinking |
| `PreToolUse` Edit/Write/MultiEdit/NotebookEdit | working/typing |
| `PreToolUse` Read/Grep/Glob/LS | working/reading |
| `PreToolUse` Bash | working/machine |
| `PreToolUse` WebSearch/WebFetch | working/searching |
| `PreToolUse` Task/Agent | working/typing |
| `PreToolUse` outra | working/thinking |
| `PostToolUse` | segue working (atualiza `lastEventAt`) |
| `PostToolUseFailure` | `error` por `timers.errorMs`, depois volta |
| `Notification` | `waiting` até o próximo evento do agente (não cochila) |
| `SubagentStop` | `done` por `doneMs` → `idle`; `tasksDone++` |
| `Stop` | orquestrador `done` → `idle`; `tasksDone++` |
| `SessionEnd` | todos `idle` |
| idle sem evento `dozeAfterMs` (20 s) | `dozing` |
| sem evento `sleepAfterMs` (60 s) | `sleeping` |
| sem evento `loungeAfterMs` (120 s) | `sleeping` + `location: "lounge"` |
| qualquer evento | acorda; `location` volta à sala |

## 5. Saída
- `GET /state` → `{ agents: Agent[], rooms, serverTime }`
- WS `/ws`: `snapshot` ao conectar; `agent` a cada mudança; `event` para o log
  (`{ at, agentId, hook, tool, summary }`).
- `Agent`: `{ id, room, location, visitor, state, activity, tool, since, lastEventAt, tasksDone, lastMessage }`.

## Depuração rápida
```bash
npm start                                   # sobe o servidor (porta 4317)
curl -s http://127.0.0.1:4317/state | head -c 600; echo
# simula um subagente trabalhando:
for ev in SubagentStart PreToolUse SubagentStop; do
  curl -s -X POST http://127.0.0.1:4317/event -H 'content-type: application/json' \
    -d "{\"hook_event_name\":\"$ev\",\"session_id\":\"dbg\",\"agent_type\":\"editor-video\",\"tool_name\":\"Bash\"}"
  sleep 1
done
# testa o hook como o Claude Code chamaria (deve sair 0 sem imprimir nada):
echo '{"hook_event_name":"UserPromptSubmit","session_id":"dbg","prompt":"oi"}' | node hooks/send-event.js; echo "exit=$?"
# ouve o WebSocket:
node --input-type=module -e "import W from 'ws';const w=new W('ws://127.0.0.1:4317/ws');w.on('message',m=>console.log(String(m).slice(0,200)))"
npm run demo                                # cena de demonstração (scripts/demo.js)
```

| Sintoma | Verifique |
|---|---|
| Ninguém se mexe | servidor rodando? `.claude/settings.json` com os hooks? `CLAUDE_PROJECT_DIR` certo? |
| Subagente vira visitante | `name` do agente ≠ id da sala (veja `.claude/agents/*.md`) |
| Não dorme | `waiting` não cochila; algum evento periódico atualizando `lastEventAt`? |
| Claude Code lento | hook sem timeout ou imprimindo em stdout |

## Mudando o protocolo
1. Altere o `CONTRATO.md` primeiro (com o orquestrador/integração).
2. Servidor + testes (skill `testes`), depois front (`phaser-escritorio`).
3. Mantenha compatibilidade: campos novos opcionais; não renomeie estados.

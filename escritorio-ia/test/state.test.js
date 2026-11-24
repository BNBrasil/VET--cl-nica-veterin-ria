import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createState, activityForTool, loadRoomsConfig } from '../server/state.js';

const rooms = loadRoomsConfig();
const ROOM_IDS = rooms.rooms.map((r) => r.id);

function setup(timers) {
  let t = 1_000_000;
  const clock = { now: () => t, advance: (ms) => { t += ms; } };
  const s = createState({ now: clock.now, timers });
  return { s, clock };
}
const ev = (hook_event_name, extra = {}) => ({ hook_event_name, session_id: 's1', ...extra });

describe('estado inicial e SessionStart', () => {
  test('8 personagens começam absent', () => {
    const { s } = setup();
    const snap = s.snapshot();
    assert.equal(snap.length, 8);
    assert.deepEqual(snap.map((a) => a.id).sort(), [...ROOM_IDS].sort());
    for (const a of snap) {
      assert.equal(a.state, 'absent');
      assert.equal(a.room, a.id);
      assert.equal(a.location, a.id);
      assert.equal(a.visitor, false);
      assert.equal(a.tasksDone, 0);
    }
  });

  test('SessionStart leva todos de absent para idle e reporta mudanças', () => {
    const { s } = setup();
    const { changed, log } = s.handle(ev('SessionStart', { source: 'startup' }));
    assert.equal(changed.length, 8);
    for (const a of s.snapshot()) assert.equal(a.state, 'idle');
    assert.equal(log.hook, 'SessionStart');
  });

  test('SessionStart não mexe em quem já está trabalhando', () => {
    const { s } = setup();
    s.handle(ev('SessionStart'));
    s.handle(ev('UserPromptSubmit', { prompt: 'oi' }));
    s.handle(ev('SessionStart', { source: 'resume' }));
    assert.equal(s.get('orquestrador').state, 'working');
  });

  test('timers vêm de shared/rooms.json', () => {
    const { s } = setup();
    assert.deepEqual(s.timers, rooms.timers);
  });
});

describe('tabela evento → estado', () => {
  test('UserPromptSubmit: orquestrador working/thinking', () => {
    const { s } = setup();
    s.handle(ev('SessionStart'));
    s.handle(ev('UserPromptSubmit', { prompt: 'Faça um vídeo' }));
    const a = s.get('orquestrador');
    assert.equal(a.state, 'working');
    assert.equal(a.activity, 'thinking');
    assert.equal(a.lastMessage, 'Faça um vídeo');
  });

  test('SubagentStart: sala do agent_type working/thinking', () => {
    const { s } = setup();
    s.handle(ev('SessionStart'));
    s.handle(ev('SubagentStart', { agent_type: 'roteirista', agent_id: 'a1' }));
    const a = s.get('roteirista');
    assert.equal(a.state, 'working');
    assert.equal(a.activity, 'thinking');
    assert.equal(s.get('orquestrador').state, 'idle');
  });

  const cases = [
    [['Edit', 'Write', 'MultiEdit', 'NotebookEdit'], 'typing'],
    [['Read', 'Grep', 'Glob', 'LS'], 'reading'],
    [['Bash'], 'machine'],
    [['WebSearch', 'WebFetch'], 'searching'],
    [['Task', 'Agent'], 'typing'],
    [['TodoWrite', 'mcp__foo__bar', 'Skill'], 'thinking'],
  ];
  for (const [tools, activity] of cases) {
    for (const tool of tools) {
      test(`PreToolUse ${tool} → working/${activity}`, () => {
        const { s } = setup();
        s.handle(ev('SessionStart'));
        s.handle(ev('PreToolUse', { tool_name: tool, agent_type: 'programador', agent_id: 'p1', tool_input: { command: 'ls -la' } }));
        const a = s.get('programador');
        assert.equal(a.state, 'working');
        assert.equal(a.activity, activity);
        assert.equal(a.tool, tool);
        assert.equal(activityForTool(tool), activity);
      });
    }
  }

  test('PreToolUse sem agent_type vai para o orquestrador; lastMessage do tool_input', () => {
    const { s } = setup();
    s.handle(ev('SessionStart'));
    s.handle(ev('PreToolUse', { tool_name: 'Bash', tool_input: { command: 'ffmpeg -i in.mp4 out.mp4' } }));
    const a = s.get('orquestrador');
    assert.equal(a.activity, 'machine');
    assert.equal(a.lastMessage, 'ffmpeg -i in.mp4 out.mp4');
  });

  test('PostToolUse continua working e atualiza lastEventAt', () => {
    const { s, clock } = setup();
    s.handle(ev('SessionStart'));
    s.handle(ev('PreToolUse', { tool_name: 'Read', agent_type: 'revisor' }));
    clock.advance(5000);
    s.handle(ev('PostToolUse', { tool_name: 'Read', agent_type: 'revisor' }));
    const a = s.get('revisor');
    assert.equal(a.state, 'working');
    assert.equal(a.activity, 'reading');
    assert.equal(a.lastEventAt, clock.now());
  });

  test('PostToolUseFailure → error por errorMs, depois volta ao estado anterior', () => {
    const { s, clock } = setup();
    s.handle(ev('SessionStart'));
    s.handle(ev('PreToolUse', { tool_name: 'Bash', agent_type: 'animador' }));
    s.handle(ev('PostToolUseFailure', { tool_name: 'Bash', agent_type: 'animador', error: 'exit 1' }));
    assert.equal(s.get('animador').state, 'error');
    assert.equal(s.get('animador').lastMessage, 'exit 1');
    clock.advance(rooms.timers.errorMs - 1);
    assert.deepEqual(s.tick(), []);
    assert.equal(s.get('animador').state, 'error');
    clock.advance(1);
    const changed = s.tick();
    assert.equal(changed.length, 1);
    const a = s.get('animador');
    assert.equal(a.state, 'working');
    assert.equal(a.activity, 'machine');
  });

  test('evento durante o error não o apaga; é aplicado ao fim do error', () => {
    const { s, clock } = setup();
    s.handle(ev('SessionStart'));
    s.handle(ev('PreToolUse', { tool_name: 'Bash', agent_type: 'animador' }));
    s.handle(ev('PostToolUseFailure', { tool_name: 'Bash', agent_type: 'animador' }));
    clock.advance(500);
    s.handle(ev('PreToolUse', { tool_name: 'Edit', agent_type: 'animador' }));
    assert.equal(s.get('animador').state, 'error');
    clock.advance(rooms.timers.errorMs);
    s.tick();
    assert.equal(s.get('animador').state, 'working');
    assert.equal(s.get('animador').activity, 'typing');
  });

  test('Notification → waiting até o próximo evento; waiting não cochila', () => {
    const { s, clock } = setup();
    s.handle(ev('SessionStart'));
    s.handle(ev('Notification', { message: 'Claude precisa de permissão' }));
    const a = s.get('orquestrador');
    assert.equal(a.state, 'waiting');
    assert.equal(a.lastMessage, 'Claude precisa de permissão');
    clock.advance(rooms.timers.loungeAfterMs + 1000);
    s.tick();
    assert.equal(s.get('orquestrador').state, 'waiting');
    assert.equal(s.get('orquestrador').location, 'orquestrador');
    s.handle(ev('PreToolUse', { tool_name: 'Bash' }));
    assert.equal(s.get('orquestrador').state, 'working');
  });

  test('SubagentStop → done por doneMs, depois idle; tasksDone++', () => {
    const { s, clock } = setup();
    s.handle(ev('SessionStart'));
    s.handle(ev('SubagentStart', { agent_type: 'editor-video', agent_id: 'e1' }));
    s.handle(ev('SubagentStop', { agent_type: 'editor-video', agent_id: 'e1' }));
    assert.equal(s.get('editor-video').state, 'done');
    assert.equal(s.get('editor-video').tasksDone, 1);
    clock.advance(rooms.timers.doneMs);
    s.tick();
    assert.equal(s.get('editor-video').state, 'idle');
  });

  test('SubagentStop sem agent_type usa o agent_id visto antes', () => {
    const { s } = setup();
    s.handle(ev('SessionStart'));
    s.handle(ev('SubagentStart', { agent_type: 'designer', agent_id: 'd9' }));
    s.handle(ev('SubagentStop', { agent_id: 'd9' }));
    assert.equal(s.get('designer').state, 'done');
    assert.equal(s.get('orquestrador').tasksDone, 0);
  });

  test('Stop → orquestrador done → idle; tasksDone++', () => {
    const { s, clock } = setup();
    s.handle(ev('SessionStart'));
    s.handle(ev('UserPromptSubmit', { prompt: 'x' }));
    s.handle(ev('Stop'));
    assert.equal(s.get('orquestrador').state, 'done');
    assert.equal(s.get('orquestrador').tasksDone, 1);
    clock.advance(rooms.timers.doneMs);
    s.tick();
    assert.equal(s.get('orquestrador').state, 'idle');
  });

  test('SessionEnd → todos idle', () => {
    const { s } = setup();
    s.handle(ev('SessionStart'));
    s.handle(ev('PreToolUse', { tool_name: 'Bash', agent_type: 'programador' }));
    s.handle(ev('Notification', { message: '?' }));
    s.handle(ev('SessionEnd', { reason: 'exit' }));
    for (const a of s.snapshot()) assert.equal(a.state, 'idle');
  });

  test('evento sem hook_event_name é ignorado', () => {
    const { s } = setup();
    assert.deepEqual(s.handle({ foo: 1 }), { changed: [], log: null });
  });
});

describe('timers de inatividade', () => {
  test('idle → dozing (20 s) → sleeping (60 s) → lounge (120 s)', () => {
    const { s, clock } = setup();
    s.handle(ev('SessionStart'));
    const T = rooms.timers;
    clock.advance(T.dozeAfterMs - 1);
    assert.deepEqual(s.tick(), []);
    assert.equal(s.get('designer').state, 'idle');
    clock.advance(1);
    assert.equal(s.tick().length, 8);
    assert.equal(s.get('designer').state, 'dozing');
    clock.advance(T.sleepAfterMs - T.dozeAfterMs);
    s.tick();
    assert.equal(s.get('designer').state, 'sleeping');
    assert.equal(s.get('designer').location, 'designer');
    assert.deepEqual(s.tick(), [], 'tick sem mudança não reporta nada');
    clock.advance(T.loungeAfterMs - T.sleepAfterMs);
    s.tick();
    assert.equal(s.get('designer').state, 'sleeping');
    assert.equal(s.get('designer').location, 'lounge');
  });

  test('qualquer evento acorda e volta para a sala', () => {
    const { s, clock } = setup();
    s.handle(ev('SessionStart'));
    clock.advance(rooms.timers.loungeAfterMs);
    s.tick();
    assert.equal(s.get('roteirista').location, 'lounge');
    s.handle(ev('SubagentStart', { agent_type: 'roteirista' }));
    const a = s.get('roteirista');
    assert.equal(a.state, 'working');
    assert.equal(a.location, 'roteirista');
  });

  test('tempos contam a partir de lastEventAt (done → idle → dozing)', () => {
    const { s, clock } = setup();
    s.handle(ev('SessionStart'));
    clock.advance(15000);
    s.handle(ev('SubagentStop', { agent_type: 'revisor' }));
    clock.advance(10000);
    s.tick();
    assert.equal(s.get('revisor').state, 'idle');
    assert.equal(s.get('programador').state, 'dozing');
    clock.advance(10000);
    s.tick();
    assert.equal(s.get('revisor').state, 'dozing');
  });

  test('working não cochila', () => {
    const { s, clock } = setup();
    s.handle(ev('SessionStart'));
    s.handle(ev('PreToolUse', { tool_name: 'Bash', agent_type: 'programador' }));
    clock.advance(rooms.timers.loungeAfterMs * 2);
    s.tick();
    assert.equal(s.get('programador').state, 'working');
  });

  test('override de timers por opções', () => {
    const { s, clock } = setup({ dozeAfterMs: 100, sleepAfterMs: 200, loungeAfterMs: 300 });
    s.handle(ev('SessionStart'));
    clock.advance(100); s.tick();
    assert.equal(s.get('animador').state, 'dozing');
    clock.advance(100); s.tick();
    assert.equal(s.get('animador').state, 'sleeping');
    clock.advance(100); s.tick();
    assert.equal(s.get('animador').location, 'lounge');
  });
});

describe('visitantes', () => {
  test('agent_type desconhecido vira visitante:<tipo> no lounge', () => {
    const { s } = setup();
    s.handle(ev('SessionStart'));
    const { changed } = s.handle(ev('SubagentStart', { agent_type: 'Explore', agent_id: 'x1' }));
    const v = s.get('visitante:Explore');
    assert.ok(v);
    assert.equal(v.visitor, true);
    assert.equal(v.room, 'lounge');
    assert.equal(v.location, 'lounge');
    assert.equal(v.state, 'working');
    assert.equal(changed.length, 1);
    assert.equal(changed[0].id, 'visitante:Explore');
    s.handle(ev('PreToolUse', { tool_name: 'Grep', agent_type: 'Explore', agent_id: 'x1' }));
    assert.equal(s.get('visitante:Explore').activity, 'reading');
    s.handle(ev('SubagentStop', { agent_type: 'Explore', agent_id: 'x1' }));
    assert.equal(s.get('visitante:Explore').state, 'done');
    assert.equal(s.snapshot().length, 9);
  });
});

describe('log de evento', () => {
  test('log tem at/agentId/hook/tool/summary', () => {
    const { s, clock } = setup();
    const { log } = s.handle(ev('PreToolUse', { tool_name: 'Bash', agent_type: 'editor-video', tool_input: { command: 'ffmpeg -i a b' } }));
    assert.equal(log.at, clock.now());
    assert.equal(log.agentId, 'editor-video');
    assert.equal(log.hook, 'PreToolUse');
    assert.equal(log.tool, 'Bash');
    assert.match(log.summary, /ffmpeg/);
  });
});

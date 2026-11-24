#!/usr/bin/env node
// Hook do Claude Code: repassa o JSON do stdin ao servidor do Escritório de IA.
// Nunca falha, nunca escreve em stdout, sempre sai com código 0.
import http from 'node:http';

const port = Number(process.env.ESCRITORIO_PORT) || 4317;
const TIMEOUT_MS = 800;

let finished = false;
function finish() {
  if (finished) return;
  finished = true;
  process.exit(0);
}

// Rede de segurança: nunca segurar o Claude Code por mais que ~1,5 s.
setTimeout(finish, 1500).unref();
process.on('uncaughtException', finish);
process.on('unhandledRejection', finish);

function post(body) {
  try {
    const req = http.request(
      {
        host: '127.0.0.1',
        port,
        path: '/event',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
        timeout: TIMEOUT_MS,
      },
      (res) => {
        res.resume();
        res.on('end', finish);
        res.on('error', finish);
      },
    );
    req.on('timeout', () => {
      req.destroy();
      finish();
    });
    req.on('error', finish);
    req.end(body);
  } catch {
    finish();
  }
}

try {
  const chunks = [];
  process.stdin.on('data', (c) => chunks.push(c));
  process.stdin.on('end', () => {
    const body = Buffer.concat(chunks).toString('utf8');
    if (!body.trim()) return finish();
    post(body);
  });
  process.stdin.on('error', finish);
} catch {
  finish();
}

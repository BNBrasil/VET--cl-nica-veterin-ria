---
name: padrao-api
description: Use ao criar ou alterar qualquer endpoint HTTP, webhook ou integração (inclusive o servidor do escritório em server/) - convenções de rotas, status, JSON de erro, validação, timeouts, CORS, logs e como testar com curl. Node puro (http) sem framework, ES modules.
---

# Padrão de API

Estilo da casa: **Node ≥ 18, ES modules, módulo `http` nativo**, sem framework, poucas dependências
(o escritório só usa `ws`). `fetch` nativo para chamadas externas.

## Convenções
| Item | Padrão |
|---|---|
| Host local | `127.0.0.1` (não `0.0.0.0` sem pedido) |
| Porta | variável de ambiente com padrão (`ESCRITORIO_PORT || 4317`) |
| Rotas | substantivos em minúsculas: `GET /state`, `POST /event`; versão só para API pública (`/v1/...`) |
| Corpo | JSON UTF-8, `content-type: application/json; charset=utf-8` |
| Limite de corpo | 1 MB (responda 413 acima) |
| Sucesso sem corpo | `204` |
| Criado | `201` + objeto |
| Erro de entrada | `400` `{ "error": { "code": "invalid_json", "message": "..." } }` |
| Não encontrado | `404` mesmo formato de erro |
| Método errado | `405` + header `allow` |
| Erro interno | `500`, loga o stack no servidor, **não** devolve stack ao cliente |
| Timeout de chamada externa | `AbortSignal.timeout(5000)` |
| Logs | uma linha por requisição: método, rota, status, ms (stderr) |

## Esqueleto (http nativo)
```js
import http from 'node:http';

const PORT = Number(process.env.ESCRITORIO_PORT) || 4317;

function json(res, status, body) {
  const data = body === undefined ? '' : JSON.stringify(body);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'content-length': Buffer.byteLength(data) });
  res.end(data);
}
const erro = (res, status, code, message) => json(res, status, { error: { code, message } });

async function lerJson(req, limite = 1_000_000) {
  let tam = 0; const partes = [];
  for await (const p of req) { tam += p.length; if (tam > limite) throw Object.assign(new Error('corpo grande'), { status: 413 }); partes.push(p); }
  try { return JSON.parse(Buffer.concat(partes).toString('utf8') || '{}'); }
  catch { throw Object.assign(new Error('JSON inválido'), { status: 400, code: 'invalid_json' }); }
}

const server = http.createServer(async (req, res) => {
  const t0 = Date.now();
  const { pathname } = new URL(req.url, 'http://x');
  res.on('finish', () => console.error(`${req.method} ${pathname} ${res.statusCode} ${Date.now() - t0}ms`));
  try {
    if (req.method === 'POST' && pathname === '/event') { const ev = await lerJson(req); /* ... */ return json(res, 204); }
    if (req.method === 'GET' && pathname === '/state') return json(res, 200, { ok: true });
    return erro(res, 404, 'not_found', `rota ${pathname}`);
  } catch (e) {
    if (!e.status) console.error(e);
    return erro(res, e.status || 500, e.code || 'internal', e.status ? e.message : 'erro interno');
  }
});
server.listen(PORT, '127.0.0.1');
export default server;
```
Exporte o `server` (ou uma função `criarServidor({ port })`) para os testes subirem em porta 0.

## Validação
- Valide campos obrigatórios e tipos na borda; ignore campos desconhecidos (o JSON do hook do Claude
  Code muda entre versões — seja tolerante).
- Nunca confie em `agent_type`/`tool_name` para caminho de arquivo ou comando.

## Testar com curl
```bash
curl -i -X POST http://127.0.0.1:4317/event -H 'content-type: application/json' -d '{"hook_event_name":"UserPromptSubmit","session_id":"t1"}'
curl -s http://127.0.0.1:4317/state | node -e "process.stdin.pipe(process.stdout)"
curl -i -X POST http://127.0.0.1:4317/event -d 'nao-json'     # espera 400
```

## Integrações externas
- Segredos só em variável de ambiente; nunca no código nem em log.
- Retry só em idempotentes (GET, PUT), 3 tentativas com backoff 250/500/1000 ms.
- Webhook recebido: responda 2xx rápido e processe depois.

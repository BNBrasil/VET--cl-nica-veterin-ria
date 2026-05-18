# ContraCheque+ — Sistema de Autenticação Própria
## Última atualização: 2026-04-11

## Visão Geral

O sistema usa **JWT + bcrypt + cookie httpOnly** para autenticação.
Não há mais dependência do Firebase Auth no fluxo do ContraCheque+.

## Stack
- Hashing: `bcryptjs` (10 rounds)
- Tokens: `jsonwebtoken` — expiração 7 dias
- Sessão: Cookie `httpOnly`, `sameSite: lax`, `secure: true` em produção

## Fluxo Completo

```
1. POST /api/auth/register
   Body: { username, password, nome?, email? }
   → Valida duplicatas
   → bcrypt.hash(password, 10)
   → INSERT usuarios
   → INSERT perfis (uid = "usr_<id>")
   → Cria JWT
   → res.cookie('token', jwt, { httpOnly: true })
   → Retorna { user: AuthUser }

2. POST /api/auth/login
   Body: { username, password }  (username aceita email também)
   → SELECT FROM usuarios WHERE username=? OR email=?
   → bcrypt.compare(password, hash)
   → Cria JWT
   → res.cookie('token', jwt, { httpOnly: true })
   → UPDATE perfis SET lastSeen = Date.now()
   → Retorna { user: AuthUser }

3. GET /api/auth/me
   → Lê cookie 'token'
   → verifyToken(token) → AuthPayload
   → Busca perfil no banco
   → Retorna { user: AuthUser, perfil: Perfil }

4. POST /api/auth/logout
   → res.clearCookie('token')
   → Retorna { success: true }
```

## Tipo AuthUser (Frontend)

```ts
interface AuthUser {
  id: number;      // ID na tabela usuarios
  username: string;
  email?: string;
  nome?: string;
  role: 'admin' | 'user';
  uid: string;     // "usr_<id>" — FK na tabela perfis
}
```

## Estrutura de UID

O `uid` no campo `perfis.uid` segue o padrão: `usr_<id_da_tabela_usuarios>`
Exemplo: usuário com id=42 → uid = "usr_42"

## Middleware

- `authMiddleware` — verifica token em cookie, injeta `req.user` 
- `adminMiddleware` — verifica `req.user.role === 'admin'` (usa após authMiddleware)

## Proteção de Rotas

| Rota | Auth | Admin |
|------|------|-------|
| POST /api/auth/* | ❌ | ❌ |
| GET /api/auth/me | ✅ | ❌ |
| GET /api/perfis | ✅ | ✅ |
| GET /api/perfis/:uid | ✅ | ❌ |
| POST /api/perfis | ✅ | ❌ |
| GET/POST/PUT/DELETE /api/holerites | ✅ | ❌ |
| GET/POST/PUT/DELETE /api/lancamentos | ✅ | ❌ |
| GET/POST/DELETE /api/pontos | ✅ | ❌ |
| GET /api/feedbacks | ✅ | ✅ |
| POST /api/feedbacks | ✅ | ❌ |
| POST /api/ai/chat | ✅ | ❌ |
| POST /api/ai/ocr | ✅ | ❌ |

## Variáveis Obrigatórias no .env

```
JWT_SECRET=<string longa e aleatória>
JWT_EXPIRES_IN=7d
```

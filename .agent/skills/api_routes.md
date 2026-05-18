# ContraCheque+ — Mapa de Rotas da API
## Última atualização: 2026-04-11

## Base URL
- Dev: `http://localhost:3000/api`
- Prod: `https://<seu-app>.hostinger.app/api`

## Autenticação

| Método | Rota | Auth | Body | Resposta |
|--------|------|------|------|----------|
| POST | /auth/register | ❌ | `{username, password, nome?, email?}` | `{user: AuthUser}` + cookie |
| POST | /auth/login | ❌ | `{username, password}` | `{user: AuthUser}` + cookie |
| POST | /auth/logout | ❌ | - | `{success: true}` + clear cookie |
| GET | /auth/me | ✅ cookie | - | `{user: AuthUser, perfil: Perfil}` |

## Perfis

| Método | Rota | Auth | Body | Resposta |
|--------|------|------|------|----------|
| GET | /perfis | ✅ 🔑 Admin | - | `Perfil[]` |
| GET | /perfis/:uid | ✅ | - | `Perfil` |
| POST | /perfis | ✅ | `Perfil` | `{success, uid}` |

## Holerites

| Método | Rota | Auth | Body | Resposta |
|--------|------|------|------|----------|
| GET | /holerites/:userId | ✅ | - | `Holerite[]` |
| POST | /holerites | ✅ | `Holerite` | `{id, ...holerite}` |
| PUT | /holerites/:id | ✅ | `Holerite` | `{success, id}` |
| DELETE | /holerites/:id | ✅ | `{userId}` | `{success}` |

## Lançamentos (Finanças)

| Método | Rota | Auth | Body | Resposta |
|--------|------|------|------|----------|
| GET | /lancamentos/:userId | ✅ | - | `Financa[]` |
| POST | /lancamentos | ✅ | `Financa` | `{id, ...lancamento}` |
| PUT | /lancamentos/:id | ✅ | `Financa` | `{success, id}` |
| DELETE | /lancamentos/:id | ✅ | `{userId}` | `{success}` |

## Pontos (Ponto Eletrônico)

| Método | Rota | Auth | Body | Resposta |
|--------|------|------|------|----------|
| GET | /pontos/:userId | ✅ | - | `Ponto[]` |
| POST | /pontos | ✅ | `Ponto` | `{success}` |
| DELETE | /pontos/:userId/:data | ✅ | - | `{success}` |

## Feedbacks / Suporte

| Método | Rota | Auth | Body | Resposta |
|--------|------|------|------|----------|
| GET | /feedbacks | ✅ 🔑 Admin | - | tickets[] |
| POST | /feedbacks | ✅ | `{userId, userName, message}` | `{id, ...}` |

## IA (Proxy Gemini)

| Método | Rota | Auth | Body | Resposta |
|--------|------|------|------|----------|
| POST | /ai/chat | ✅ | `{message, systemInstruction?}` | `{text: string}` |
| POST | /ai/ocr | ✅ | `{imageBase64, mimeType, prompt}` | `{text: string}` |

## Notas

- Todas as rotas autenticadas requerem cookie `token` (httpOnly)
- O cookie é enviado automaticamente pelo browser e pelo `fetch` com `credentials: 'include'`
- UID no banco: formato `usr_<id>` (ex: usr_42)
- JSON Fields (holerites): `horasNormais`, `horasExtras`, `adicionalNoturno`, `adicionais`, `descontos` são serializados como JSON no MySQL

# ⚡ QUICK START - REFERÊNCIA RÁPIDA

**Objetivo:** Comandos e informações mais frequentes  
**Atualizado:** 13 de Maio de 2026

---

## 🚀 INÍCIO RÁPIDO (Primeira vez)

```bash
# 1. Clonar/Entrar no projeto
cd "e:/VET- clínica veterinária"

# 2. Backend
cd backend
npm install
cp .env.example .env  # Editar variáveis
npx prisma migrate dev
npm run dev          # Roda em localhost:3000

# 3. Frontend (outra aba/terminal)
cd frontend
npm install
npm run dev          # Roda em localhost:5173

# 4. Validar
# ✅ Backend: http://localhost:3000/api/health
# ✅ Frontend: http://localhost:5173
# ✅ Swagger: http://localhost:3000/api-docs
```

---

## 📋 CHECKLIST DIÁRIO (5 min)

```bash
# Ao chegar/começar trabalho
□ Abrir: .agent/Task.md
□ Revisar tarefas do dia
□ Marcar 1-2 como "in-progress": [x]
□ Abrir Terminal em cada pasta (backend + frontend)
□ Iniciar: npm run dev
□ Validar: Ambos rodando sem erros
```

---

## 💻 COMANDOS FREQUENTES

### Backend (Node.js + TypeScript)
```bash
cd backend

# Desenvolvimento
npm run dev              # Inicia servidor (localhost:3000)
npm run build            # Compila TS para JS
npm run lint             # Verifica erros de código
npm test                 # Roda testes (Vitest)

# Banco de dados
npx prisma studio       # Abre interface visual do BD
npx prisma migrate dev  # Executa migrations
npx prisma db push      # Sincroniza schema com BD
npx prisma generate     # Regenera Prisma client

# Produção
npm run build
NODE_ENV=production npm start
```

### Frontend (React + Vite)
```bash
cd frontend

# Desenvolvimento
npm run dev              # Dev server (localhost:5173)
npm run build            # Build otimizado
npm run lint             # ESLint check
npm run preview          # Preview do build

# Produção
npm run build
# Deploy a pasta dist/ no servidor web
```

---

## 🐛 ERROS COMUNS & SOLUÇÕES RÁPIDAS

### Backend não conecta ao banco
```bash
# Problema: DATABASE_URL incorreta ou BD offline
Solução:
1. Verificar .env → DATABASE_URL
2. Testar conexão: npx prisma db push
3. Confirmar PostgreSQL rodando
4. Revistar credenciais no painel
```

### "EADDRINUSE: address already in use :::3000"
```bash
# Solução: Porta já está em uso
# Windows:
netstat -ano | findstr :3000
taskkill /PID [PID] /F

# Mac/Linux:
lsof -i :3000
kill -9 [PID]
```

### TypeScript Errors (Type not assignable)
```bash
# Solução rápida:
1. npm run build (vê erro exato)
2. Adicionar tipo explícito: `: Tipo`
3. Nunca use `any`
4. Consultar .instructions.md para padrão correto
```

### "Cannot find module 'X'"
```bash
# Solução:
1. npm install (se novo pacote)
2. Limpar node_modules: rm -rf node_modules
3. npm install novamente
4. Reiniciar servidor
```

### CORS Error no Frontend
```bash
# Solução:
1. Verificar FRONTEND_URL no backend .env
2. Verificar VITE_API_URL no frontend .env
3. Confirmar credentials: true em ambos lados
4. Reiniciar ambos os servidores
```

---

## 🔐 VARIÁVEIS DE AMBIENTE (.env)

### Backend
```bash
# Database
DATABASE_URL="postgresql://user:senha@localhost:5432/vet_dev"

# Auth
JWT_SECRET="seu-secret-super-secreto-aleatorio"
JWT_EXPIRES_IN="7d"

# Server
PORT=3000
NODE_ENV="development"

# Frontend
FRONTEND_URL="http://localhost:5173"

# Email (opcional)
SMTP_HOST="smtp.seuhost.com"
SMTP_PORT=587
SMTP_USER="seu-email@example.com"
SMTP_PASS="sua-senha"
```

### Frontend
```bash
# .env ou .env.local
VITE_API_URL="http://localhost:3000"
VITE_APP_NAME="VET Clínica"
```

---

## 📁 ESTRUTURA RÁPIDA

```
VET - clínica veterinária/
├── .agent/              ← Guias e checklists
├── backend/
│   ├── src/
│   │   ├── controllers/ ← Lógica
│   │   ├── routes/      ← Endpoints
│   │   ├── middlewares/ ← Auth, upload
│   │   └── utils/       ← Helpers
│   └── prisma/
│       └── schema.prisma ← Modelos BD
├── frontend/
│   └── src/
│       ├── pages/       ← Páginas React
│       ├── components/  ← Componentes
│       ├── stores/      ← Estado (Zustand)
│       └── api/         ← Cliente HTTP
└── docs/               ← Documentação geral
```

---

## 🎯 TAREFAS COMUNS

### Adicionar novo endpoint
```bash
# 1. Criar controller: backend/src/controllers/novoController.ts
# 2. Criar rotas: backend/src/routes/novoRoutes.ts
# 3. Importar em server.ts: app.use('/api/novo', novoRoutes)
# 4. Testar em localhost:3000/api/novo
# 5. Documentar em ARCHITECTURE.md
```

### Adicionar nova página
```bash
# 1. Criar página: frontend/src/pages/NovaPagina.tsx
# 2. Criar rota: frontend/src/App.tsx (adicionar <Route>)
# 3. Adicionar menu: frontend/src/components/Layout.tsx
# 4. Testar em localhost:5173/nova-pagina
```

### Modificar banco de dados
```bash
# 1. Editar: backend/prisma/schema.prisma
# 2. Criar migration: npx prisma migrate dev --name descricao
# 3. Validar: npx prisma studio
# 4. Commit: git commit -m "[DB] Descrição"
```

---

## 🧪 TESTES MANUAIS BÁSICOS

### Login
```
1. Abrir http://localhost:5173
2. Clicar "Login"
3. Email: seu-email@example.com
4. Senha: SuaSenha123!
5. ✅ Esperado: Redireciona para Dashboard
```

### CRUD de Animal
```
1. Na Dashboard, ir para "Animais"
2. Clicar "Novo Animal"
3. Preencher: Nome, Raça, Espécie
4. Upload de foto
5. Salvar
6. ✅ Esperado: Animal aparece na lista
```

### API Direct (cURL/Postman)
```bash
# Login (obter token)
POST http://localhost:3000/api/auth/login
{
  "email": "user@example.com",
  "password": "password123"
}

# Criar animal (com cookie do login)
POST http://localhost:3000/api/animals
{
  "name": "Bella",
  "species": "DOG",
  "breed": "Golden Retriever"
}
```

---

## 🔍 DEBUGGING RÁPIDO

### Backend
```bash
# Ver logs detalhados
npm run dev  # (já mostra logs do Express)

# Adicionar log no código:
console.log('Debug:', variavel);

# Ver erro exato:
npm run build  # Mostra todos os TypeScript errors

# Prisma debugging:
npx prisma studio  # Interface visual
```

### Frontend
```bash
# DevTools do Browser (F12)
# Console → Erros React
# Network → Requisições API
# Application → LocalStorage/Cookies

# Adicionar log:
console.log('Debug:', dados);

# Validar componente:
Abrir React DevTools (extensão)
```

---

## 📊 STATUS VERIFICAÇÃO

### Checklist de tudo funcionando:
```bash
□ Backend rodando (localhost:3000)
□ Frontend rodando (localhost:5173)
□ Banco conectado (prisma studio abre)
□ Login funciona
□ Sem console.errors
□ TypeScript sem errors
```

### Antes de Commit:
```bash
□ Código testado localmente
□ Sem console.log deixado
□ Sem TypeScript errors
□ Arquivo .env não foi comitado
□ Task.md será atualizado
```

### Antes de Deploy:
```bash
□ CHECKLIST.md foi lido
□ npm test passou
□ npm run build sem warnings
□ .env producao configurado
□ Backup do BD feito
```

---

## 🚀 DEPLOY RÁPIDO

### Staging (teste)
```bash
cd backend
npm run build
NODE_ENV=staging npm start  # em servidor teste

cd ../frontend
npm run build
# Deploy pasta dist/ em servidor teste
```

### Produção
```bash
# Ler CHECKLIST.md completamente primeiro!

cd backend
npm run build
NODE_ENV=production npm start

cd ../frontend
npm run build
# Deploy em CDN ou servidor prod
```

---

## 📱 ENDPOINTS DA API

```
# Auth
POST   /api/auth/login          Login
POST   /api/auth/register       Registro
POST   /api/auth/logout         Logout
GET    /api/auth/me             Dados usuário

# Animals
GET    /api/animals             Listar
POST   /api/animals             Criar
PUT    /api/animals/:id         Editar
DELETE /api/animals/:id         Deletar

# Appointments (Consultas)
GET    /api/appointments        Listar
POST   /api/appointments        Agendar
PUT    /api/appointments/:id    Atualizar
DELETE /api/appointments/:id    Cancelar

# Prescriptions (Receitas)
GET    /api/prescriptions/:id   Ver receita
POST   /api/prescriptions       Criar
GET    /api/prescriptions/:id/pdf Baixar PDF

# Completo em:
/api-docs  (Swagger)
```

---

## 🎓 RECURSOS

| Recurso | Link |
|---------|------|
| Prisma | https://www.prisma.io/docs/ |
| Express | https://expressjs.com/en/4x/api.html |
| React | https://react.dev |
| TailwindCSS | https://tailwindcss.com/docs |
| Zustand | https://github.com/pmndrs/zustand |

---

## 💡 PRO TIPS

```bash
# Alias útil no terminal
alias dev-be="cd backend && npm run dev"
alias dev-fe="cd frontend && npm run dev"
alias lint-all="npm run lint && cd ../frontend && npm run lint"

# Watch files changes
npm run dev  # Já faz isso automaticamente

# Fazer request rápida
curl http://localhost:3000/api/animals

# Ver processos em portas
# Windows:
netstat -ano

# Killer de processo
kill-port 3000  # Se tiver alias
```

---

## 🔗 LINKS RÁPIDOS

**Locais:**
- Backend: http://localhost:3000
- Frontend: http://localhost:5173
- Swagger: http://localhost:3000/api-docs
- Prisma Studio: Execute `npx prisma studio`

**Na pasta .agent:**
- 📋 Task.md - Tarefas
- 📊 PROGRESS.md - Histórico
- 🏗️ ARCHITECTURE.md - Arquitetura
- 🤖 .instructions.md - Padrões
- ✅ CHECKLIST.md - Validações
- 📖 README.md - Guia

---

**Última atualização:** 13 de Maio de 2026  
**Bookmark esta página!** 🔖


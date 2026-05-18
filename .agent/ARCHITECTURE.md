# 🏗️ ARQUITETURA DO SISTEMA - VET CLÍNICA VETERINÁRIA

**Versão:** 2.0.0  
**Data:** 13 de Maio de 2026  
**Status:** Completo

---

## 📐 DIAGRAMA DE ARQUITETURA

```
┌─────────────────────────────────────────────────────────────────┐
│                    CLIENTE (Browser)                             │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ React + TypeScript + TailwindCSS + Zustand              │  │
│  │ ├─ Pages: Login, Dashboard, Animals, Appointments...     │  │
│  │ ├─ Components: Layout, Forms, Tables, Modals             │  │
│  │ └─ Stores: authStore, animalStore, appointmentStore     │  │
│  └──────────────────────────────────────────────────────────┘  │
│                           ▼                                      │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Axios HTTP Client (axios.ts)                             │  │
│  │ └─ Base URL: http://localhost:3000/api                  │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
            │                          ▲
            │ HTTPS/HTTP               │ JSON
            ▼                          │
┌─────────────────────────────────────────────────────────────────┐
│                   API REST (Express + TypeScript)                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ SERVER.TS (Port 3000)                                    │  │
│  │ ├─ CORS Middleware                                       │  │
│  │ ├─ Cookie Parser                                         │  │
│  │ ├─ Rate Limiter                                          │  │
│  │ └─ Error Handler                                         │  │
│  └──────────────────────────────────────────────────────────┘  │
│                           ▼                                      │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ ROTAS (/api/*)                                           │  │
│  │ ├─ /api/auth       → authRoutes        [LOGIN/REGISTER]  │  │
│  │ ├─ /api/animals    → animalRoutes      [CRUD Animal]    │  │
│  │ ├─ /api/tutors     → tutorRoutes       [CRUD Tutor]     │  │
│  │ ├─ /api/appoint    → appointmentRoutes [CRUD Consult]   │  │
│  │ ├─ /api/queue      → queueRoutes       [Fila Atend]     │  │
│  │ ├─ /api/exams      → examRoutes        [CRUD Exame]     │  │
│  │ ├─ /api/vaccines   → vaccineRoutes     [CRUD Vacina]    │  │
│  │ ├─ /api/prescribe  → prescriptionRoutes[CRUD Receita]   │  │
│  │ └─ /api/clinic     → clinicRoutes      [Config Clínica] │  │
│  └──────────────────────────────────────────────────────────┘  │
│                           ▼                                      │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ MIDDLEWARES                                              │  │
│  │ ├─ authMiddleware   → Valida JWT do cookie               │  │
│  │ ├─ uploadMiddleware → Multer + Sharp para imagens        │  │
│  │ ├─ rateLimiter      → express-rate-limit                │  │
│  │ └─ errorHandler     → Tratamento centralizado de erros   │  │
│  └──────────────────────────────────────────────────────────┘  │
│                           ▼                                      │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ CONTROLLERS (Lógica de Negócio)                          │  │
│  │ ├─ authController     → signup, login, logout            │  │
│  │ ├─ animalController   → create, read, update, delete     │  │
│  │ ├─ tutorController    → CRUD de proprietários            │  │
│  │ ├─ appointmentCtrl    → CRUD de consultas                │  │
│  │ ├─ queueController    → Geração de senhas, prioridades   │  │
│  │ ├─ prescriptionCtrl   → Criação e export PDF             │  │
│  │ ├─ vaccineController  → Controle de vacinação            │  │
│  │ ├─ examController     → Solicitação e resultados         │  │
│  │ └─ clinicController   → Dados da clínica                 │  │
│  └──────────────────────────────────────────────────────────┘  │
│                           ▼                                      │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ UTILS & HELPERS                                          │  │
│  │ ├─ auth.ts    → JWT sign/verify, bcrypt hash             │  │
│  │ ├─ audit.ts   → Logging de alterações                    │  │
│  │ └─ validation → Schemas Zod                              │  │
│  └──────────────────────────────────────────────────────────┘  │
│                           ▼                                      │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ PRISMA ORM (Type-safe Database Queries)                 │  │
│  │ └─ Abstract layer para PostgreSQL                        │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
            │                          ▲
            │ SQL                      │ Resultados
            ▼                          │
┌─────────────────────────────────────────────────────────────────┐
│                      PostgreSQL Database                         │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ TABLES                                                   │  │
│  │ ├─ users       → Usuários (admin, veterinário, etc)      │  │
│  │ ├─ animals     → Animais com fotos                       │  │
│  │ ├─ tutors      → Proprietários                           │  │
│  │ ├─ appointments → Consultas agendadas                    │  │
│  │ ├─ queues      → Filas com senhas                        │  │
│  │ ├─ exams       → Exames solicitados                      │  │
│  │ ├─ vaccines    → Histórico de vacinação                  │  │
│  │ ├─ prescriptions → Receitas emitidas                     │  │
│  │ ├─ audit_logs  → Log de alterações                       │  │
│  │ └─ clinic_config → Dados da clínica                      │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔐 FLUXO DE AUTENTICAÇÃO

```
┌──────────────────┐
│ Usuário digita   │
│ Login/Senha      │
└────────┬─────────┘
         │
         ▼
┌──────────────────────────────┐
│ POST /api/auth/login         │
│ body: { email, password }    │
└────────┬─────────────────────┘
         │
         ▼
┌──────────────────────────────────────┐
│ 1. Buscar usuário no banco          │
│ 2. Verificar bcrypt(password)       │
│ 3. Gerar JWT assinado               │
│ 4. Enviar via cookie httpOnly       │
└────────┬────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────┐
│ Resposta: 200 OK                     │
│ Cookie: jwt_token=<assinado>        │
│ HttpOnly: true                       │
│ SameSite: Lax                        │
│ Secure: true (produção)              │
└────────┬────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────┐
│ Requisições futuras:                 │
│ - Cookie enviado automaticamente     │
│ - authMiddleware valida assinatura   │
│ - req.user preenchido                │
│ - Acesso a rotas protegidas          │
└──────────────────────────────────────┘
```

---

## 📊 MODELOS DE DADOS (Simplificado)

### User
```typescript
{
  id: string              // UUID
  email: string           // Único
  password: string        // bcrypt hash
  name: string
  role: 'ADMIN' | 'VET' | 'RECEPTIONIST' | 'CLIENT'
  clinic_id: string
  createdAt: DateTime
  updatedAt: DateTime
}
```

### Animal
```typescript
{
  id: string
  name: string
  species: 'CACHORRO' | 'GATO' | 'PASSARO' | ...
  breed: string
  photo_url?: string      // Armazenado em /public/uploads
  tutor_id: string        // FK User
  createdAt: DateTime
  updatedAt: DateTime
}
```

### Appointment
```typescript
{
  id: string
  animal_id: string       // FK Animal
  veterinarian_id: string // FK User (role: VET)
  date_time: DateTime
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'MISSED' | 'CANCELLED'
  notes?: string
  createdAt: DateTime
  updatedAt: DateTime
}
```

### Prescription
```typescript
{
  id: string
  appointment_id: string  // FK Appointment
  medications: [{
    name: string
    dosage: string
    frequency: string
    duration: string
  }]
  createdAt: DateTime
}
```

---

## 🔀 PADRÕES DE DESIGN

### 1. MVC (Model-View-Controller)
- **Model:** Prisma Schema
- **View:** React Components
- **Controller:** Controllers do Express

### 2. Separation of Concerns
```
Routes → Controllers → Business Logic → Prisma → Database
```

### 3. Middleware Pipeline
```
Request → CORS → Cookie Parser → Auth Middleware → Rate Limiter → Controller → Response
```

### 4. Error Handling
```
Try-Catch → Error Logger → Error Response → Client
```

---

## 🔒 SEGURANÇA

### Camadas de Proteção
1. **HTTPS/TLS** → Criptografia em trânsito
2. **CORS** → Validação de origem
3. **JWT + HttpOnly Cookies** → Autenticação sem exposição XSS
4. **Rate Limiting** → Proteção contra brute force
5. **Input Validation** → Zod schemas
6. **Password Hashing** → bcryptjs (10 rounds)
7. **RBAC** → Controle por roles
8. **Audit Logging** → Rastreamento de alterações

---

## 📦 STACK TÉCNICO

### Backend
```
Framework:        Express 5.2.1
Language:         TypeScript 5.x
Database ORM:     Prisma 5.22.0
Database:         PostgreSQL
Auth:             JWT + bcryptjs
Validation:       Zod
File Upload:      Multer 2.1.1
Image Processing: Sharp 0.34.5
PDF Generation:   PDFKit 0.18.0
Documentation:    Swagger UI Express
Testing:          Vitest
```

### Frontend
```
Framework:        React 18.3.1
Build Tool:       Vite 5.4.10
Language:         TypeScript 5.6.3
Router:           React Router 6.28.0
State Mgmt:       Zustand 5.0.1
Styling:          TailwindCSS 3.4.14
Animations:       Framer Motion 11.11.9
Forms:            React Hook Form 4.0.0
Validation:       Zod 3.23.8
Icons:            Lucide React 0.460.0
HTTP Client:      Axios 1.7.7
```

---

## 🚀 DEPLOYMENT

### Ambiente Local
```bash
# Backend
cd backend
npm install
npm run dev          # localhost:3000

# Frontend
cd frontend
npm install
npm run dev          # localhost:5173
```

### Ambiente Produção
```bash
# Backend
npm run build        # Compila TS para JS
npm start           # Roda em NODE_ENV=production

# Frontend
npm run build       # Otimizado com Vite
# Deploy em servidor estático ou CDN
```

---

## 📊 PERFORMANCE

### Otimizações Implementadas
- ✅ Compressão Gzip (Express)
- ✅ Lazy loading de componentes (React)
- ✅ Image optimization (Sharp 150x150)
- ✅ Database indexing (Prisma)
- ✅ Caching headers (HTTP)

### Metas
- TTFB < 200ms
- LCP < 2.5s
- CLS < 0.1

---

## 🔧 CONFIGURAÇÃO DE AMBIENTES

### `.env.local` (Desenvolvimento)
```bash
# Backend
DATABASE_URL="postgresql://user:pass@localhost:5432/vet_dev"
JWT_SECRET="chave-secreta-dev"
NODE_ENV="development"
FRONTEND_URL="http://localhost:5173"
PORT=3000

# Frontend (.env)
VITE_API_URL="http://localhost:3000"
```

### `.env.production`
```bash
# Backend
DATABASE_URL="postgresql://prod-user:prod-pass@prod-host/vet_prod"
JWT_SECRET="chave-secreta-forte-aleatoria"
NODE_ENV="production"
FRONTEND_URL="https://vet-clinic.com"
PORT=8080

# Frontend
VITE_API_URL="https://api.vet-clinic.com"
```

---

## 🧪 ESTRATÉGIA DE TESTES

### Unit Tests (Vitest)
- Controllers
- Utils (auth, validation)
- Prisma queries

### Integration Tests
- API endpoints
- Database transactions
- Authentication flows

### E2E Tests (Playwright)
- User login flow
- CRUD operations
- Navigation

---

## 🔄 CI/CD Pipeline (Futuro)

```
Git Push
  ├─ Lint (ESLint)
  ├─ Type Check (TypeScript)
  ├─ Tests (Vitest)
  ├─ Build (tsc, Vite)
  └─ Deploy (if main branch)
```

---

## 📚 REFERÊNCIAS EXTERNAS

- [Prisma Documentation](https://www.prisma.io/docs/)
- [Express TypeScript](https://expressjs.com/)
- [React Documentation](https://react.dev)
- [TailwindCSS](https://tailwindcss.com)
- [Zustand](https://github.com/pmndrs/zustand)
- [Zod Validation](https://zod.dev)

---

**Mantido por:** Engenharia de Software  
**Última Atualização:** 13 de Maio de 2026

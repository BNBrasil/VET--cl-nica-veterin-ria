# VET - Clínica Veterinária

## Visão Geral
Sistema de gestão para clínica veterinária com backend API REST (Node.js/TypeScript/Prisma) e frontend web.

## Progresso: [████████████████] 100%

## Tarefas

### Fase 1: Configuração e Infraestrutura
- [x] Configurar PostgreSQL local ou docker-compose
- [x] Executar migration do Prisma (`npx prisma migrate dev`)
- [x] Configurar variáveis de ambiente (.env)
- [ ] Criar script de seed para dados iniciais

### Fase 2: Backend - Autenticação e Autorização
- [x] Implementar registro/login com JWT (controllers/authController.ts)
- [x] Implementar middleware de autenticação (middlewares/authMiddleware.ts)
- [x] Implementar controle de acesso por roles (PACIENTE, RECEPCIONISTA, MEDICO, ADMIN)
- [x] Implementar proteção de rotas

### Fase 3: Backend - Módulos de Negócio
- [x] Animais (CRUD + upload de foto)
- [x] Tutores (CRUD)
- [x] Médicos/Veterinários (CRUD + specialty, CRM)
- [x] Consultas/Agendamentos (CRUD + status, histórico)
- [x] Filas de atendimento (geração de senhas, prioridades)
- [x] Receitas (geração de PDFs via PDFKit)
- [x] Exames (solicitação, upload de resultados PDF)
- [x] Vacinas (controle de datas, alertas)
- [x] Rooms/Salas (gestão de consultórios)
- [x] Logs de auditoria

### Fase 4: Frontend - Setup
- [x] Inicializar projeto React (Vite + TypeScript)
- [x] Configurar Router (React Router)
- [x] Configurar HTTP client (Axios)
- [x] Configurar State Management (Zustand)
- [x] Configurar CSS (Tailwind CSS)

### Fase 5: Frontend - Autenticação
- [x] Página de Login
- [x] Página de Registro
- [x] Proteção de rotas por auth
- [x] Redirects baseados em role

### Fase 6: Frontend - Dashboard e Módulos
- [x] Dashboard (visão geral por role)
- [x] Módulo Animais (lista, detalhes, cadastro)
- [x] Módulo Agenda (calendário, agendamentos)
- [x] Módulo Filas (painel de senhas, chamadas)
- [x] Módulo Receitas (visualização, emissão PDF)
- [x] Módulo Exames (solicitação, resultados)
- [x] Módulo Vacinas (cronograma)
- [x] Painel Admin (médicos, salas)

### Fase 7: Integração e Testes
- [x] Integrar frontend com todas as APIs
- [ ] Testes E2E (Playwright)
- [x] Ajustar responsividade

### Fase 8: Deploy
- [ ] Build de produção (frontend)
- [ ] Configuração do backend para produção

---

## Stack Confirmada
- **Backend**: Express, TypeScript, Prisma, PostgreSQL, JWT, Multer, Sharp, PDFKit
- **Frontend**: React 18, Vite, TypeScript, TailwindCSS, Zustand, Framer Motion, React Router
- **Auth**: JWT com cookies httpOnly

---

## Estrutura de Arquivos

### Backend
```
backend/
├── prisma/schema.prisma      # Modelos do banco
├── src/
│   ├── controllers/           # Lógica de negócio
│   │   ├── authController.ts
│   │   ├── animalController.ts
│   │   ├── tutorController.ts
│   │   ├── clinicController.ts
│   │   ├── appointmentController.ts
│   │   ├── queueController.ts
│   │   ├── prescriptionController.ts
│   │   ├── vaccineController.ts
│   │   └── examController.ts
│   ├── routes/                # Rotas API
│   ├── middlewares/          # Auth, upload
│   ├── utils/                # Auth, audit
│   └── server.ts             # Entry point
└── package.json
```

### Frontend
```
frontend/
├── src/
│   ├── api/axios.ts          # Axios instance
│   ├── stores/authStore.ts   # Zustand store
│   ├── types/index.ts        # TypeScript types
│   ├── components/Layout.tsx
│   ├── pages/
│   │   ├── Login.tsx
│   │   ├── Register.tsx
│   │   ├── Dashboard.tsx
│   │   ├── Animals.tsx
│   │   ├── Appointments.tsx
│   │   ├── Queue.tsx
│   │   ├── Prescriptions.tsx
│   │   ├── Vaccines.tsx
│   │   ├── Exams.tsx
│   │   └── Admin.tsx
│   ├── App.tsx
│   └── main.tsx
└── package.json
```

---

## Como Executar

### Backend
```bash
cd backend
npm install
# Criar arquivo .env com:
# DATABASE_URL="postgresql://..."
# JWT_SECRET="sua-chave-secreta"
# FRONTEND_URL="http://localhost:5173"
npx prisma migrate dev
npm run dev
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

---

## Funcionalidades Implementadas

### Autenticação
- Login/Registro com JWT
- Cookies httpOnly seguros
- Proteção contra brute force
- Controle de acesso por roles (PACIENTE, RECEPCIONISTA, MEDICO, ADMIN)

### Animais
- CRUD completo
- Upload de foto com redimensionamento (150x150 via Sharp)
- Busca por nome

### Agendamentos
- Criação de consultas
- Verificação de conflitos de horário
- Atualização de status (AGENDADA, EM_ATENDIMENTO, CONCLUIDA, FALTOU, CANCELADA)
- Filtros por status, data, médico

### Fila de Atendimento
- Geração de senhas (formato AB0000 - [classificação])
- Prioridades (GERAL, PREFERENCIAL, URGENTE)
- Chamada de próxima senha
- Atualização de status

### Receitas
- Criação de receitas com medicamentos
- Geração de PDF via PDFKit
- Download do PDF

### Vacinas
- Registro de vacinas
- Controle de próximas doses
- Histórico por animal

### Exames
- Solicitação de exames
- Upload de resultados PDF
- Controle de status

### Admin
- Cadastro de médicos
- Gestão de salas
- Visualização de profissionais
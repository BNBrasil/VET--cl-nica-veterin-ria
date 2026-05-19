# VET - Clinica Veterinaria

Sistema VET para gestao de clinica veterinaria, com frontend React/Vite, backend Node/Express, autenticacao, agenda, fila de atendimento, animais, tutores, exames, vacinas, receitas e painel administrativo.

## Ultimas Atualizacoes

- Fila de atendimento com som conforme a especie do pet ao chamar senha.
- Busca interativa de pets em agendamentos, exames e vacinas.
- Modais de nova consulta, editar agendamento e cancelar consulta com visual melhorado.
- Layout mobile revisado nas telas principais do VET.
- Dependencias do backend declaradas para build independente: `zod`, `sharp` e `pdfkit`.
- Arquivo `.env.example` incluido para facilitar instalacao local ou em servidor.

## Rodar Independente

1. Instale as dependencias:

```bash
npm install
```

2. Crie o arquivo de ambiente:

```bash
copy .env.example .env
```

No Linux/macOS:

```bash
cp .env.example .env
```

3. Preencha o `.env` com seus dados:

```env
DATABASE_URL=mysql://usuario:senha@localhost:3306/vet_clinic
VET_JWT_SECRET=troque-esta-chave-em-producao
FRONTEND_URL=http://localhost:5173
SMTP_HOST=sandbox.smtp.mailtrap.io
SMTP_PORT=2525
SMTP_USER=
SMTP_PASS=
```

4. Gere o cliente Prisma:

```bash
npx prisma generate
```

5. Gere o build:

```bash
npm run build
```

6. Inicie a aplicacao:

```bash
npm start
```

## Desenvolvimento

Frontend:

```bash
npm run dev
```

Backend:

```bash
npm run dev:backend
```

## Docker

Tambem e possivel rodar com Docker:

```bash
docker compose up --build
```

## Variaveis De Ambiente

Nao envie `.env` real para o GitHub. Use `.env.example` como modelo e mantenha senhas, banco e credenciais SMTP apenas no ambiente local ou no servidor.

Principais variaveis:

- `DATABASE_URL`: conexao MySQL usada pelo Prisma.
- `PORT`: porta do backend.
- `FRONTEND_URL`: origem permitida no CORS.
- `VET_JWT_SECRET`: chave secreta dos tokens.
- `VET_JWT_EXPIRES_IN`: validade do token.
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`: envio de e-mails.
- `VITE_API_BASE_URL`: URL da API para o frontend, quando nao usar mesma origem.

## Build Validado

O build completo foi validado com:

```bash
npm run build
```

Esse comando compila o frontend e empacota o backend em `dist/server.js`.

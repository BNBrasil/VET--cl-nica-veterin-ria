# VET - Clínica Veterinária

Este repositório contém o sistema VET (backend + frontend). Objetivo: facilitar execução local e publicação no GitHub.

Pré-requisitos
- Docker & Docker Compose (recomendado para rodar em qualquer sistema operacional)
- Node.js 18+ (opcional, para desenvolvimento sem Docker)

Rodar com Docker (recomendado, cross-platform)

```bash
docker compose up --build
```

O `docker-compose.yml` já traz serviços para backend e banco. Para rodar apenas backend ou frontend sem Docker, veja as pastas `backend/` e `frontend/`.

Variáveis de ambiente
- Não comite arquivos `.env`. Crie um `.env` local baseado em `.env.example` na raiz e em `backend/.env.example`.

Contribuição
- Ajuste variáveis e credenciais localmente antes de rodar.

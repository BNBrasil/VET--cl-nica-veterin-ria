# 🎯 INDEX - PASTA .AGENT

**Bem-vindo à central de controle do projeto VET!**

---

## 🚀 COMECE AQUI (Escolha o seu cenário)

### 👤 Novo no Projeto?
1. [README.md](./README.md) - Visão geral (5 min)
2. [ARCHITECTURE.md](./ARCHITECTURE.md) - Como tudo funciona (15 min)
3. [QUICK_START.md](./QUICK_START.md) - Comandos práticos (5 min)

### 💻 Vou Começar a Codificar?
1. [.instructions.md](./.instructions.md) - Padrões obrigatórios (10 min)
2. [QUICK_START.md](./QUICK_START.md) - Referência rápida
3. [Task.md](./Task.md) - Veja tarefas disponíveis

### 📋 Gerenciando Tarefas?
1. [Task.md](./Task.md) - Marque tarefas concluídas
2. [PROGRESS.md](./PROGRESS.md) - Documente o dia
3. [Task.md](./Task.md) - Prepare próximo dia

### 🚀 Vou Fazer Deploy?
1. **OBRIGATÓRIO:** [CHECKLIST.md](./CHECKLIST.md)
2. Siga cada validação
3. Obtenha aprovação
4. Deploy!

### 🆘 Preciso de Ajuda?
- **Qual arquivo usar?** → [MANIFEST.md](./MANIFEST.md)
- **Dúvida técnica?** → [.instructions.md](./.instructions.md)
- **Comando rápido?** → [QUICK_START.md](./QUICK_START.md)
- **Entender arquitetura?** → [ARCHITECTURE.md](./ARCHITECTURE.md)

---

## 📁 ARQUIVOS PRINCIPAIS

| Arquivo | Descrição | Frequência | Leitura |
|---------|-----------|-----------|---------|
| 📖 [README.md](./README.md) | Guia de uso da pasta | 1x ao começar | 5 min |
| 📋 [Task.md](./Task.md) | Roteiro de tarefas | **DIÁRIA** | 5 min |
| 📊 [PROGRESS.md](./PROGRESS.md) | Histórico de progresso | **DIÁRIA** | 10 min |
| 🏗️ [ARCHITECTURE.md](./ARCHITECTURE.md) | Documentação técnica | Conforme necessário | 15 min |
| 🤖 [.instructions.md](./.instructions.md) | Padrões de código | Antes de codificar | 10 min |
| ✅ [CHECKLIST.md](./CHECKLIST.md) | Validações pré-deploy | **ANTES DE DEPLOY** | 15 min |
| ⚡ [QUICK_START.md](./QUICK_START.md) | Referência rápida | Sempre aberto | 2 min |
| 📋 [MANIFEST.md](./MANIFEST.md) | Índice completo | 1x | 5 min |
| 🎯 [INDEX.md](./INDEX.md) | Este arquivo | Quando perdido | 2 min |

---

## 🎯 MATRIZ DE DECISÃO

```
┌─────────────────────────────────────────────────┐
│ O QUE VOCÊ PRECISA FAZER?                       │
├─────────────────────────────────────────────────┤
│                                                 │
│ "Não sei por onde começar"                      │
│   └─→ README.md                                 │
│                                                 │
│ "Quero ver as tarefas"                          │
│   └─→ Task.md                                   │
│                                                 │
│ "Preciso documentar o dia"                      │
│   └─→ PROGRESS.md                               │
│                                                 │
│ "Vou escrever código"                           │
│   └─→ .instructions.md                          │
│                                                 │
│ "Preciso de um comando"                         │
│   └─→ QUICK_START.md                            │
│                                                 │
│ "Preciso entender como funciona"                │
│   └─→ ARCHITECTURE.md                           │
│                                                 │
│ "Vou fazer deploy"                              │
│   └─→ CHECKLIST.md (OBRIGATÓRIO!)              │
│                                                 │
│ "Qual arquivo para X?"                          │
│   └─→ MANIFEST.md                               │
│                                                 │
└─────────────────────────────────────────────────┘
```

---

## ⏰ ROTINA DIÁRIA

### Ao Chegar (5-10 min)
```
1. Abrir: Task.md
2. Revisar tarefas
3. Marcar 1-2 como "in-progress"
4. Iniciar: npm run dev (ambos terminais)
5. Começar a codificar!
```

### Fim do Dia (5-10 min)
```
1. Marcar tarefas como "completed" em Task.md
2. Documentar dia em PROGRESS.md
3. Preparar próximo dia
4. Commit com referência às tarefas
```

### Antes de Deploy (30 min)
```
1. Ler CHECKLIST.md COMPLETAMENTE
2. Executar TODAS as validações
3. Testar em staging
4. Obter aprovação
5. Deploy
```

---

## 🔥 COMANDOS MAIS USADOS

```bash
# Desenvolvimento (2 terminais)
cd backend && npm run dev       # Terminal 1: Backend em :3000
cd frontend && npm run dev      # Terminal 2: Frontend em :5173

# Banco de dados
npx prisma studio              # Interface visual do BD
npx prisma migrate dev          # Criar/aplicar migrations

# Validação antes de deploy
npm run build                   # Compila sem erros?
npm run lint                    # Código está bem formatado?
npm test                        # Testes passam?

# Útil para debugging
curl http://localhost:3000/api  # Teste simples da API
```

---

## 📊 STATUS DO PROJETO

| Aspecto | Status | Progresso |
|---------|--------|-----------|
| **Backend** | ✅ 95% | [████████░] |
| **Frontend** | ✅ 90% | [█████████░] |
| **Testes** | ⏳ 20% | [██░░░░░░░░] |
| **Deploy** | 🔴 0% | [░░░░░░░░░░] |
| **Docs** | ✅ 100% | [██████████] |

**Última atualização:** 13 de Maio de 2026

---

## 🚀 PRÓXIMOS PASSOS

### Agora (Hoje)
- [ ] Leia [README.md](./README.md)
- [ ] Configure ambiente local
- [ ] Execute `npm run dev`

### Esta Semana
- [ ] Revise [ARCHITECTURE.md](./ARCHITECTURE.md)
- [ ] Implemente 3-5 tarefas de [Task.md](./Task.md)
- [ ] Documente em [PROGRESS.md](./PROGRESS.md)

### Esta Próxima
- [ ] Testes unitários
- [ ] Validações de [CHECKLIST.md](./CHECKLIST.md)
- [ ] Preparar para deploy

---

## 🆘 QUICK HELP

### "Qual arquivo devo ler?"
→ [MANIFEST.md](./MANIFEST.md)

### "Como fazer X?"
→ [QUICK_START.md](./QUICK_START.md)

### "Qual é o padrão para código?"
→ [.instructions.md](./.instructions.md)

### "Como é a arquitetura?"
→ [ARCHITECTURE.md](./ARCHITECTURE.md)

### "Qual é o progresso?"
→ [PROGRESS.md](./PROGRESS.md)

### "O que fazer próximo?"
→ [Task.md](./Task.md)

---

## 📚 ESTRUTURA DE PASTAS

```
.agent/                        ← Você está aqui
├── 📖 Documentação
│   ├── README.md             (Guia principal)
│   ├── ARCHITECTURE.md       (Arquitetura)
│   ├── .instructions.md      (Padrões)
│   ├── MANIFEST.md           (Índice)
│   └── INDEX.md              (Este arquivo)
│
├── 📋 Gestão
│   ├── Task.md               (Tarefas)
│   ├── PROGRESS.md           (Histórico)
│   ├── CHECKLIST.md          (Validações)
│   └── QUICK_START.md        (Referência rápida)
│
├── 🔧 Técnico
│   ├── auth_middleware.ts
│   ├── routes_map.json
│   ├── db_config.json
│   └── memory.json
│
└── 📁 Extras
    ├── skills/
    └── istalador de skills/
```

---

## ✨ DESTAQUES

### 📋 Documentação Completa
✅ 8 arquivos de documentação  
✅ ~2000 linhas de guias  
✅ Mantida atualizada  

### 🎯 Gestão Clara
✅ 100+ tarefas organizadas  
✅ Progresso rastreável  
✅ Prioridades definidas  

### 🔒 Segurança
✅ 80+ validações pré-deploy  
✅ Checklists de qualidade  
✅ Padrões obrigatórios  

### ⚡ Referência Rápida
✅ QUICK_START.md sempre à mão  
✅ Comandos mais usados listados  
✅ Troubleshooting rápido  

---

## 💡 FILOSOFIA

> **"Organização = Eficiência = Sucesso"**

Esta pasta existe para que você:
- 📋 Mantenha tudo organizado
- 📊 Rastreie progresso claramente
- 🎯 Foque nas prioridades
- 🔒 Garanta qualidade
- 🚀 Entregue com confiança

---

## 🎓 DICA FINAL

**Não tente fazer tudo de uma vez!**

1. Escolha seu cenário acima
2. Leia os arquivos sugeridos
3. Comece pequeno
4. Atualize Task.md e PROGRESS.md diariamente
5. Sucesso! 🎉

---

## 📞 ONDE PROCURAR

| Situação | Arquivo |
|----------|---------|
| Básico | README.md |
| Tarefas | Task.md |
| Técnico | ARCHITECTURE.md |
| Código | .instructions.md |
| Comando | QUICK_START.md |
| Deploy | CHECKLIST.md |
| Índice | MANIFEST.md |

---

**Bem-vindo ao projeto VET! 🏥🐾**

Começe lendo [README.md](./README.md) agora! ⬇️

---

**Criado:** 13 de Maio de 2026  
**Status:** ✅ Operacional  
**Mantido por:** Engenharia de Software

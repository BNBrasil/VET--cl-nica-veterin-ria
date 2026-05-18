# 🤖 PASTA .AGENT - GUIA DE USO

**Objetivo:** Centro de controle para desenvolvimento organizado e eficiente  
**Criado:** 13 de Maio de 2026  
**Versão:** 1.0.0

---

## 📁 O QUE VOCÊ ENCONTRA AQUI?

Esta pasta contém toda a infraestrutura de planejamento, organização e documentação do projeto **VET - Clínica Veterinária**.

```
.agent/
├── 📋 Task.md              ← LEIA PRIMEIRO: Roteiro principal de tarefas
├── 📊 PROGRESS.md          ← Log de progresso e histórico
├── 🏗️ ARCHITECTURE.md      ← Documentação da arquitetura
├── ✅ CHECKLIST.md         ← Validações pré-deploy
├── 🤖 .instructions.md     ← Padrões de desenvolvimento
├── 📖 README.md            ← Este arquivo
├── 🔧 auth_middleware.ts   ← Middleware de autenticação
├── 📋 routes_map.json      ← Mapeamento de rotas
├── 🗄️ db_config.json       ← Configuração de banco
├── 💾 memory.json          ← Notas persistentes
├── 📁 skills/              ← Extensões customizadas
└── 📦 istalador de skills/ ← Ferramentas auxiliares
```

---

## 🚀 COMO COMEÇAR

### 1️⃣ Primeira Coisa - Leia o Roteiro
```bash
# Abra e leia completamente
Task.md
```
Aqui você encontra:
- ✅ Status geral do projeto
- 📋 Todas as tarefas organizadas
- 🎯 Objetivos principais
- 📅 Cronograma

### 2️⃣ Entenda a Arquitetura
```bash
# Leia para entender como tudo funciona
ARCHITECTURE.md
```
Aqui você encontra:
- 📐 Diagramas de componentes
- 🔐 Fluxo de autenticação
- 📊 Modelo de dados
- 🔀 Padrões de design
- 🚀 Stack técnico

### 3️⃣ Siga os Padrões
```bash
# Use estes padrões em TODOS os códigos
.instructions.md
```
Aqui você encontra:
- 💻 Padrões TypeScript
- 🔒 Checklist de segurança
- 📝 Estrutura de commits
- 🧪 Estratégia de testes

### 4️⃣ Valide Antes de Deploy
```bash
# Sempre verifique ANTES de colocar em produção
CHECKLIST.md
```
Aqui você encontra:
- ✔️ Validações por fase
- 🧪 Testes manuais
- 🔍 Checklist de segurança
- 📊 Critérios de aceite

### 5️⃣ Rastreie o Progresso
```bash
# Atualizo constantemente com novo status
PROGRESS.md
```
Aqui você encontra:
- 📈 Histórico de tarefas
- 🎯 Objetivos de sprint
- 🐛 Bugs conhecidos
- 💡 Lições aprendidas

---

## 📋 FLUXO DE TRABALHO TÍPICO

### Manhã: Planejamento
```
1. Abrir Task.md
2. Revisar tarefas do dia
3. Marcar 1-2 tarefas como "in-progress"
4. Abrir .instructions.md para refresca padrões
```

### Durante o Dia: Desenvolvimento
```
1. Seguir padrões de .instructions.md
2. Fazer commits estruturados
3. Testar localmente
4. Atualizar PROGRESS.md
```

### Fim do Dia: Finalização
```
1. Marcar tarefas como "completed" em Task.md
2. Documentar no PROGRESS.md
3. Preparar ambiente para próximo dia
4. Verificar se alguma validação de CHECKLIST é necessária
```

### Antes de Deploy
```
1. Ler CHECKLIST.md completamente
2. Executar todas as validações
3. Testar em staging
4. Obter aprovação
5. Deploy
```

---

## 🎯 ESTRUTURA DE TAREFAS

### Task.md usa categorias:

```markdown
### Fase X: [Nome da Fase]
- [x] Tarefa concluída
- [ ] Tarefa pendente
- [ ] Tarefa bloqueada
```

**Estados:**
- ✅ `[x]` = Concluído
- ⏳ `[ ]` = Pendente
- 🔴 `[!]` = Bloqueado (adicione motivo)

### Exemplo de uso:
```bash
Task.md:
- [x] Setup inicial
- [ ] Implementar controllers
- [!] Aguardando aprovação do schema - BLOQUEADO

PROGRESS.md:
Dia 13/05: 
✅ Setup `.agent` concluído
⏳ Iniciando implementação controllers
```

---

## 📊 MÉTRICAS DE SUCESSO

Acompanhe no PROGRESS.md:

| Métrica | Meta | Atual |
|---------|------|-------|
| Tasks Completadas | 100% | 95% |
| TypeScript Errors | 0 | 0 |
| Test Coverage | 80%+ | _A medir_ |
| Security Issues | 0 críticas | 0 ✅ |
| Bugs Ativos | < 5 | 0 ✅ |

---

## 🔧 ARQUIVOS AUXILIARES

### auth_middleware.ts
Middleware de autenticação JWT. Referência para implementação de proteção de rotas.

### routes_map.json
Mapeamento de todas as rotas da API para referência rápida.

### db_config.json
Configuração do banco de dados para desenvolvimento.

### memory.json
Notas persistentes e informações importantes para reutilização.

---

## 🤝 COLABORAÇÃO

### Quando adicionar um novo membro:
1. Compartilhe esta pasta `.agent`
2. Peça para ler: Task.md → ARCHITECTURE.md → .instructions.md
3. Revise os padrões juntos
4. Configure ambiente local

### Quando terminar uma tarefa:
1. Marque em Task.md como `[x]`
2. Documente em PROGRESS.md
3. Faça commit com referência à tarefa
4. Atualize status se algo mudou

---

## 🆘 TROUBLESHOOTING

### "Não sei por onde começar"
→ Leia `Task.md` seção "Próximos Passos"

### "Qual padrão devo seguir?"
→ Consulte `.instructions.md`

### "Preciso validar antes de deploy"
→ Use `CHECKLIST.md`

### "Quero entender a arquitetura"
→ Estude `ARCHITECTURE.md`

### "Qual é o progresso atual?"
→ Veja `PROGRESS.md`

---

## 📚 REFERÊNCIAS RÁPIDAS

### Links Importantes
- [Prisma Docs](https://www.prisma.io/docs/)
- [Express TypeScript](https://expressjs.com/)
- [React Docs](https://react.dev)
- [TailwindCSS](https://tailwindcss.com)

### Comandos Frequentes
```bash
# Backend
npm run dev          # Inicia servidor
npm run build        # Compila TS
npm run lint         # Verifica código
npm test             # Roda testes

# Frontend
npm run dev          # Inicia dev server
npm run build        # Build otimizado
npm run lint         # Verifica código

# Prisma
npx prisma studio   # Visual DB explorer
npx prisma migrate dev  # Cria migration
```

### Estrutura de Pastas Principal
```
VET - clínica veterinária/
├── .agent/         ← Você está aqui
├── backend/        ← API REST
├── frontend/       ← Interface React
└── docs/          ← Documentação geral
```

---

## ✨ BOAS PRÁTICAS

### ✅ Sempre fazer:
- ✅ Ler Task.md antes de começar
- ✅ Seguir padrões de .instructions.md
- ✅ Atualizar PROGRESS.md
- ✅ Marcar tarefas como concluídas
- ✅ Testar antes de deploy
- ✅ Revisar CHECKLIST.md
- ✅ Documentar decisões importantes

### ❌ Nunca fazer:
- ❌ Ignorar validações de CHECKLIST.md
- ❌ Deploy sem testes
- ❌ Commitar com `any` type
- ❌ Deixar console.logs em produção
- ❌ Esquecer de atualizar documentação
- ❌ Fazer mudanças sem rastrear em Task.md
- ❌ Ignorar warnings do TypeScript

---

## 🔄 MANUTENÇÃO

### Semanal
- [ ] Revisar Task.md
- [ ] Atualizar PROGRESS.md
- [ ] Validar status de sprints

### Mensal
- [ ] Revisar ARCHITECTURE.md
- [ ] Atualizar .instructions.md se necessário
- [ ] Revisar CHECKLIST.md
- [ ] Documentar lições aprendidas

### Trimestral
- [ ] Revisão geral de estrutura
- [ ] Atualizar documentação
- [ ] Planejar próximas fases

---

## 📞 SUPORTE

**Dúvidas sobre:**
- Tarefas → Veja `Task.md`
- Código → Veja `.instructions.md`
- Arquitetura → Veja `ARCHITECTURE.md`
- Segurança → Veja `CHECKLIST.md`
- Progresso → Veja `PROGRESS.md`

---

## 🎉 LEMBRE-SE

> **"A organização é a chave para o sucesso."**

Esta pasta existe para:
- ✨ Manter o projeto organizado
- 📋 Rastrear progresso claramente
- 🎯 Focar nas prioridades
- 🔒 Garantir qualidade
- 🚀 Facilitar deploy

**Use-a bem!** 🚀

---

**Criado por:** Engenharia de Software  
**Data:** 13 de Maio de 2026  
**Status:** ✅ Ativo e em uso

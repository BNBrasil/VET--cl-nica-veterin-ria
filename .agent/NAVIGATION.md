# 🗺️ MAPA DE NAVEGAÇÃO - .AGENT

**Visual Guide para navegar na pasta .agent**  
**Data:** 13 de Maio de 2026

---

## 📍 VOCÊ ESTÁ AQUI

```
🏥 VET - Clínica Veterinária
│
└─ .agent/ ← 👈 VOCÊ ESTÁ AQUI
   │
   ├─ 📖 DOCUMENTAÇÃO GERAL
   │  ├─ INDEX.md              ← 🎯 COMECE AQUI (Você acabou de ler!)
   │  ├─ README.md             ← Guia de uso completo
   │  ├─ MANIFEST.md           ← Índice de todos os arquivos
   │  └─ QUICK_START.md        ← Referência rápida
   │
   ├─ 🎯 GESTÃO DE TAREFAS
   │  ├─ Task.md               ← Roteiro principal (ABRA DIARIAMENTE)
   │  ├─ PROGRESS.md           ← Histórico (ATUALIZE DIARIAMENTE)
   │  └─ CHECKLIST.md          ← Validações (LEIA ANTES DE DEPLOY)
   │
   ├─ 🏗️ ARQUITETURA & PADRÕES
   │  ├─ ARCHITECTURE.md       ← Documentação técnica completa
   │  └─ .instructions.md      ← Padrões de desenvolvimento
   │
   └─ 🔧 ARQUIVOS TÉCNICOS
      ├─ auth_middleware.ts    ← Exemplo de middleware
      ├─ routes_map.json       ← Mapeamento de rotas
      ├─ db_config.json        ← Configuração do BD
      ├─ memory.json           ← Notas persistentes
      ├─ skills/               ← Extensões customizadas
      └─ istalador de skills/  ← Ferramentas auxiliares
```

---

## 🧭 ROTEIROS VISUAIS

### 🚀 ROTEIRO: NOVO NO PROJETO?

```
START
  ↓
[INDEX.md] ← Você está aqui
  ↓
[README.md] ← Entender o objetivo
  ↓
[ARCHITECTURE.md] ← Como funciona
  ↓
[.instructions.md] ← Padrões
  ↓
[QUICK_START.md] ← Comandos
  ↓
[Task.md] ← Tarefas
  ↓
npm run dev ← COMEÇAR!
```

### 💻 ROTEIRO: CODIFICAR

```
START
  ↓
[.instructions.md] ← Revisar padrões
  ↓
[QUICK_START.md] ← Ver comandos
  ↓
[Task.md] ← Escolher tarefa
  ↓
VS Code
  ↓
Escrever código
  ↓
[Task.md] ← Marcar completo
  ↓
[PROGRESS.md] ← Documentar
  ↓
git commit
```

### 📊 ROTEIRO: GERENCIAR PROGRESSO

```
Início do Dia
  ↓
[Task.md] ← Ver tarefas
  ↓
npm run dev ← Iniciar servidores
  ↓
Codificar
  ↓
Fim do Dia
  ↓
[Task.md] ← Marcar concluídas
  ↓
[PROGRESS.md] ← Documentar dia
  ↓
git commit
  ↓
Próximo dia!
```

### 🚀 ROTEIRO: DEPLOY

```
Código pronto?
  ↓
[CHECKLIST.md] ← OBRIGATÓRIO!
  ↓
npm run build
  ↓
npm test
  ↓
npm run lint
  ↓
[CHECKLIST.md] ← Todas validações OK?
  ↓
[ SIM? ] ──→ DEPLOY ✅
  ↓
[ NÃO? ] ──→ Corrigir
           ↓
           [Task.md]
```

---

## 🎯 MATRIZ DE SELEÇÃO

### Você precisa de...

**INSTRUÇÕES?**
```
Novo no projeto?
  └─ README.md + ARCHITECTURE.md
  
Diretrizes de código?
  └─ .instructions.md
  
Comando rápido?
  └─ QUICK_START.md
  
Índice completo?
  └─ MANIFEST.md
```

**TAREFAS?**
```
Ver tarefas de hoje?
  └─ Task.md
  
Histórico de progresso?
  └─ PROGRESS.md
  
Validações antes de deploy?
  └─ CHECKLIST.md
```

**TÉCNICO?**
```
Como tudo funciona?
  └─ ARCHITECTURE.md
  
Middleware de exemplo?
  └─ auth_middleware.ts
  
Rotas da API?
  └─ routes_map.json
  
Config do banco?
  └─ db_config.json
```

---

## ⏰ QUANDO USAR CADA ARQUIVO

### 📅 DIARIAMENTE (Essencial)
```
Ao chegar:
  [Task.md] + [QUICK_START.md]

Ao trabalhar:
  [.instructions.md] (conforme necessário)

Ao terminar:
  [Task.md] + [PROGRESS.md]
```

### 📅 SEMANALMENTE
```
Segunda:
  [Task.md] ← Revisar semana

Quarta:
  [PROGRESS.md] ← Status intermediário

Sexta:
  [PROGRESS.md] ← Resumo semanal + plano próxima
```

### 📅 MENSALMENTE
```
Início do mês:
  [ARCHITECTURE.md] ← Revisar se ainda válido

Meio do mês:
  [.instructions.md] ← Atualizar padrões se necessário

Fim do mês:
  [MANIFEST.md] ← Revisar estrutura completa
```

### 📅 CONFORME NECESSÁRIO
```
Antes de deploy:
  [CHECKLIST.md] ← 100% OBRIGATÓRIO

Quando perdido:
  [INDEX.md] ou [MANIFEST.md]

Pesquisando:
  [QUICK_START.md]
```

---

## 📍 LOCALIZAÇÃO RÁPIDA

### "Como faço para..."

| Pergunta | Arquivo |
|----------|---------|
| ...começar? | INDEX.md |
| ...entender tudo? | README.md |
| ...código novo? | .instructions.md |
| ...um comando? | QUICK_START.md |
| ...conhecer tarefas? | Task.md |
| ...ver progresso? | PROGRESS.md |
| ...antes de deploy? | CHECKLIST.md |
| ...indice? | MANIFEST.md |
| ...arquitetura? | ARCHITECTURE.md |

---

## 🎨 ESTRUTURA VISUAL

```
┌─────────────────────────────────────────────────┐
│          PASTA .AGENT - ESTRUTURA               │
├─────────────────────────────────────────────────┤
│                                                 │
│  ENTRADA                                        │
│  ├─ 🎯 INDEX.md         (Você está aqui)       │
│  └─ 📖 README.md        (Guia principal)       │
│                                                 │
│  GESTÃO DIÁRIA                                  │
│  ├─ 📋 Task.md          (Tarefas)              │
│  ├─ 📊 PROGRESS.md      (Progresso)            │
│  └─ 🗺️ MAPA.md          (Navegação)            │
│                                                 │
│  DESENVOLVIMENTO                                │
│  ├─ 🤖 .instructions.md (Padrões)              │
│  └─ ⚡ QUICK_START.md   (Referência)           │
│                                                 │
│  QUALIDADE                                      │
│  ├─ ✅ CHECKLIST.md     (Validações)           │
│  └─ 🏗️ ARCHITECTURE.md  (Técnico)              │
│                                                 │
│  INFORMAÇÃO                                     │
│  ├─ 📋 MANIFEST.md      (Índice)               │
│  └─ 📚 docs/            (Extra)                │
│                                                 │
└─────────────────────────────────────────────────┘
```

---

## 🚀 FLUXO COMPLETO DO DIA

```
MANHÃ
  ↓
[START]
  ↓
Abrir [Task.md]
  ↓
Ver tarefas pendentes
  ↓
Selecionar 1-2 tarefas
  ↓
npm run dev (ambos)
  ↓
  │
TRABALHO
  ↓
Consult [.instructions.md]
  ↓
Codificar
  ↓
Testar
  ↓
  │
TARDE
  ↓
Consult [QUICK_START.md]
  ↓
Mais codificação
  ↓
Testes adicionais
  ↓
  │
FIM DO DIA
  ↓
Marcar [Task.md] ✅
  ↓
Atualizar [PROGRESS.md]
  ↓
git commit
  ↓
Próximo dia no [Task.md]
  ↓
[END]
```

---

## 🔄 CICLO DE VIDA DE UMA TAREFA

```
1. VER EM TASK.md
   [ ] Tarefa pendente
   
2. COMEÇAR
   [x] Tarefa em andamento
   
3. DURANTE TRABALHO
   └─ Consultar [.instructions.md]
   └─ Consultar [QUICK_START.md]
   └─ Testar localmente
   
4. COMPLETAR
   └─ Marcar [x] em [Task.md]
   └─ Documentar [PROGRESS.md]
   └─ git commit
   
5. ANTES DE DEPLOY
   └─ Verificar [CHECKLIST.md]
   └─ Validações
   └─ Deploy ✅
```

---

## 📌 PONTOS-CHAVE

**Em Destaque:**
- 🌟 Leia [README.md] primeiro
- 🌟 Atualize [Task.md] diariamente
- 🌟 Documente em [PROGRESS.md] todo dia
- 🌟 Revise [CHECKLIST.md] antes de deploy
- 🌟 Consulte [.instructions.md] ao codificar

**Não Esqueça:**
- ⚠️ NUNCA faça deploy sem [CHECKLIST.md]
- ⚠️ SEMPRE siga padrões de [.instructions.md]
- ⚠️ MANTENHA [Task.md] e [PROGRESS.md] atualizados
- ⚠️ LEIA [ARCHITECTURE.md] quando tiver dúvida técnica
- ⚠️ USE [QUICK_START.md] para referência rápida

---

## 🎓 DICA IMPORTANTE

**Toda informação que você precisa está em um destes 9 arquivos:**

1. INDEX.md (aqui!)
2. README.md
3. Task.md
4. PROGRESS.md
5. ARCHITECTURE.md
6. .instructions.md
7. CHECKLIST.md
8. QUICK_START.md
9. MANIFEST.md

**Não se sinta perdido!**  
Se não souber, consulte INDEX.md → MANIFEST.md

---

## 💡 ATALHO MENTAL

```
Confuso?          → INDEX.md
Novo?             → README.md
Tarefas?          → Task.md
Padrões?          → .instructions.md
Comando?          → QUICK_START.md
Deploy?           → CHECKLIST.md
Técnico?          → ARCHITECTURE.md
Índice?           → MANIFEST.md
Mapa?             → Este arquivo
```

---

## 🎉 ESTÁ PRONTO?

Se você leu até aqui:

✅ Entende o objetivo  
✅ Conhece os arquivos  
✅ Sabe onde procurar  
✅ Pronto para começar!

**Próximo passo:**
1. Abra [README.md]
2. Depois [Task.md]
3. Comece a codificar! 🚀

---

## 📞 ÚLTIMO LEMBRETE

**Esta pasta é seu aliado!**

- Mantém você organizado
- Rastreia progresso
- Garante qualidade
- Facilita colaboração
- Documenta decisões

**Use-a bem!** 🎯

---

**Criado:** 13 de Maio de 2026  
**Versão:** 1.0.0  
**Status:** ✅ Operacional e pronto

**Bem-vindo! Vamos ao trabalho! 🚀**

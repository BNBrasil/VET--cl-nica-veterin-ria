# 📋 MANIFEST - CONTEÚDO DA PASTA .AGENT

**Data:** 13 de Maio de 2026  
**Versão:** 1.0.0

---

## 📁 ESTRUTURA DE ARQUIVOS

```
.agent/
│
├── 📖 README.md                    [Guia de uso da pasta - COMECE AQUI]
├── 📋 Task.md                      [Roteiro principal - TODO LIST]
├── 📊 PROGRESS.md                  [Histórico de progresso - LOG]
├── 🏗️ ARCHITECTURE.md              [Documentação técnica completa]
├── 🤖 .instructions.md             [Padrões de desenvolvimento]
├── ✅ CHECKLIST.md                 [Validações pré-deploy]
├── 📋 MANIFEST.md                  [Este arquivo - índice]
│
├── 🔧 auth_middleware.ts           [Middleware de autenticação]
├── 📋 routes_map.json              [Mapeamento de rotas]
├── 🗄️ db_config.json               [Config do banco de dados]
├── 💾 memory.json                  [Notas persistentes]
│
├── 📁 skills/                      [Extensões customizadas]
├── 📦 istalador de skills/         [Ferramentas auxiliares]
└── 📦 istalador de skills.zip      [Backup das ferramentas]
```

---

## 📄 DESCRIÇÃO DETALHADA DE CADA ARQUIVO

### 🎯 ARQUIVOS PRINCIPAIS (LEITURA OBRIGATÓRIA)

#### 1. **README.md** 
**👉 Comece aqui!**
- Guia de entrada para a pasta
- Instruções de uso
- Fluxo de trabalho típico
- Troubleshooting rápido
- Boas práticas
- **Quando ler:** Primeira vez que abre a pasta

#### 2. **Task.md**
**📋 Roteiro de tarefas**
- Status geral do projeto (95% completo)
- 5 fases principais de desenvolvimento
- Checklist de módulos
- Tarefas por prioridade
- Notas importantes sobre segurança
- **Quando ler:** Todo dia, marca tarefas como concluídas
- **Frequência atualização:** Diária

#### 3. **PROGRESS.md**
**📊 Histórico de andamento**
- Log de tarefas completadas
- Histórico semanal
- Bugs conhecidos
- Aprendizados
- Métricas de sucesso
- Próximas ações
- **Quando ler:** Final do dia, para documentar progresso
- **Frequência atualização:** Diária

#### 4. **ARCHITECTURE.md**
**🏗️ Documentação técnica completa**
- Diagrama da arquitetura
- Fluxo de autenticação
- Modelos de dados
- Padrões de design (MVC)
- Stack técnico detalhado
- Configuração de ambientes
- Performance targets
- Estratégia de testes
- **Quando ler:** Quando precisa entender como algo funciona
- **Frequência atualização:** Mensal

#### 5. **.instructions.md**
**🤖 Padrões e convenções de código**
- Responsabilidades do agente
- Padrões TypeScript
- Padrões de controllers
- Padrões de componentes
- Padrões de requisições HTTP
- Checklist de segurança
- Templates de commit
- Resolução de problemas comuns
- Métricas de sucesso
- **Quando ler:** Antes de escrever qualquer código
- **Frequência atualização:** Mensal

#### 6. **CHECKLIST.md**
**✅ Validações críticas**
- Validações pré-deploy por fase
- Testes manuais obrigatórios
- Checklist de segurança
- Critério de rejeição (bloqueadores)
- Monitoramento pós-deploy
- Procedure de rollback
- **Quando ler:** OBRIGATORIAMENTE antes de qualquer deploy
- **Frequência atualização:** A cada release

---

### 🔧 ARQUIVOS TÉCNICOS

#### 7. **auth_middleware.ts**
**Middleware de autenticação**
- Implementação de proteção JWT
- Validação de tokens
- Injeção de dados do usuário
- Usar como referência para novos middlewares

#### 8. **routes_map.json**
**Mapeamento de rotas da API**
- Lista todas as rotas disponíveis
- Métodos HTTP (GET, POST, etc)
- Rotas protegidas vs públicas
- Rápida referência durante desenvolvimento

#### 9. **db_config.json**
**Configuração do banco de dados**
- Parâmetros de conexão
- Pool settings
- Timeout configurations
- Usado em scripts de setup

#### 10. **memory.json**
**Notas persistentes**
- Informações importantes
- Decisões técnicas documentadas
- Referências rápidas
- Atualizar quando descobrir algo importante

---

### 📁 PASTAS ESPECIAIS

#### 11. **skills/**
Extensões customizadas para o agente de IA
- Modelos prontos
- Snippets de código
- Utilitários específicos do projeto

#### 12. **istalador de skills/**
Ferramentas auxiliares e scripts
- Setup automático
- Validadores
- Generators

---

## 🎯 MATRIZ DE QUANDO USAR CADA ARQUIVO

| Situação | Arquivo |
|----------|---------|
| Não sei por onde começar | README.md |
| Preciso de uma tarefa | Task.md |
| Quero documentar progresso | PROGRESS.md |
| Preciso entender a arquitetura | ARCHITECTURE.md |
| Vou escrever código novo | .instructions.md |
| Vou fazer deploy | CHECKLIST.md |
| Preciso lembrar de algo técnico | memory.json |
| Preciso ver todas as rotas | routes_map.json |
| Preciso de exemplo de middleware | auth_middleware.ts |

---

## 🔄 FLUXO DE LEITURA RECOMENDADO

### Para Novo Desenvolvedor
```
1. README.md         (5 min)  ← Entender o objetivo
2. ARCHITECTURE.md   (15 min) ← Entender como funciona
3. .instructions.md  (10 min) ← Aprender os padrões
4. Task.md          (5 min)  ← Ver tarefas atuais
```

### Para Começar a Codificar
```
1. .instructions.md  (5 min)  ← Revisar padrões
2. routes_map.json   (2 min)  ← Ver rotas relacionadas
3. auth_middleware.ts (3 min) ← Ver exemplo similar
4. Código!           (∞ min)  ← Escrever com confiança
```

### Antes de Fazer Deploy
```
1. CHECKLIST.md      (15 min) ← Validações críticas
2. Task.md           (2 min)  ← Confirmar tudo concluído
3. PROGRESS.md       (5 min)  ← Documentar o release
4. Deploy!           (seguir checklist)
```

### Fim do Dia
```
1. Task.md           (5 min)  ← Marcar tarefas concluídas
2. PROGRESS.md       (10 min) ← Documentar o dia
3. Próximo dia planejado!
```

---

## 📊 ESTATÍSTICAS

| Métrica | Valor |
|---------|-------|
| Total de arquivos | 13 |
| Arquivos principais | 6 |
| Arquivos técnicos | 4 |
| Pastas extras | 3 |
| Linhas de documentação | ~2000+ |
| Tarefas documentadas | 100+ |
| Validações pré-deploy | 80+ |

---

## ✅ CHECKLIST DE SETUP

Ao clonar o repositório, certifique-se de:

- [ ] Explorar a pasta `.agent`
- [ ] Ler `README.md` completamente
- [ ] Familiarizar com `ARCHITECTURE.md`
- [ ] Revisar `.instructions.md`
- [ ] Guardar `CHECKLIST.md` (será necessário)
- [ ] Entender estrutura de pastas
- [ ] Configurar editor VSCode
- [ ] Setup ambiente local
- [ ] Primeiro commit referenciando Task.md

---

## 🔄 MANUTENÇÃO DESTA PASTA

### Semanal
- [ ] Revisar README.md e Task.md
- [ ] Atualizar PROGRESS.md

### Mensal
- [ ] Revisar ARCHITECTURE.md
- [ ] Atualizar .instructions.md
- [ ] Validar CHECKLIST.md

### Conforme necessário
- [ ] Adicionar notas em memory.json
- [ ] Atualizar routes_map.json
- [ ] Modificar db_config.json

---

## 🎓 APRENDIZADO

Esta pasta foi projetada para:

✅ **Organização**: Tudo em um único lugar  
✅ **Clareza**: Documentação completa e acessível  
✅ **Rastreabilidade**: Todo progresso documentado  
✅ **Qualidade**: Checklists e validações  
✅ **Colaboração**: Fácil onboarding  
✅ **Manutenção**: Estrutura escalável  

---

## 🚀 PRÓXIMOS PASSOS

1. **Imediatamente**
   - Leia README.md
   - Explore ARCHITECTURE.md
   - Revise .instructions.md

2. **Hoje**
   - Setup ambiente local
   - Selecione 2-3 tarefas de Task.md
   - Comece a codificar

3. **Fim do dia**
   - Marque tarefas em Task.md
   - Documente em PROGRESS.md
   - Prepare para próximo dia

4. **Antes de qualquer deploy**
   - Leia CHECKLIST.md
   - Execute validações
   - Obtenha aprovação

---

## 💡 DICA FINAL

**Não tente fazer tudo de uma vez!**

Use esta pasta para:
- 📋 Organizar seu trabalho
- 📊 Rastrear progresso
- 🚀 Manter qualidade
- 🔒 Garantir segurança

---

**Criado por:** Engenharia de Software Senior  
**Data:** 13 de Maio de 2026  
**Status:** ✅ Completo e operacional

---

## 📞 REFERÊNCIA RÁPIDA

| Arquivo | Tamanho | Leitura | Atualização |
|---------|---------|---------|------------|
| README.md | ~2KB | 5 min | Mensal |
| Task.md | ~4KB | 5 min | Diária |
| PROGRESS.md | ~3KB | 10 min | Diária |
| ARCHITECTURE.md | ~8KB | 15 min | Mensal |
| .instructions.md | ~6KB | 10 min | Mensal |
| CHECKLIST.md | ~7KB | 15 min | Release |
| memory.json | <1KB | 2 min | Ad-hoc |
| routes_map.json | <1KB | 2 min | Ad-hoc |
| db_config.json | <1KB | 2 min | Ad-hoc |
| MANIFEST.md | ~5KB | 5 min | Mensal |

**Tempo total de leitura recomendado:** 60-90 minutos  
**Benefício:** Desenvolvimento 3x mais eficiente! 🚀


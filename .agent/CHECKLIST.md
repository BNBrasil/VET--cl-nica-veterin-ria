# ✅ CHECKLIST PRÉ-DEPLOY & VALIDAÇÕES

**Objetivo:** Garantir qualidade e segurança antes de cada lançamento  
**Atualizado:** 13 de Maio de 2026

---

## 🔍 VALIDAÇÕES ANTES DE QUALQUER DEPLOY

### ✔️ Fase 1: Ambiente Local

**Preparação**
- [ ] Branch atualizado com `main`
- [ ] `.env` configurado com dados válidos
- [ ] Node.js versão 18+ instalado
- [ ] PostgreSQL rodando
- [ ] `npm install` executado nos dois projetos

**Backend**
```bash
[ ] npm run build (sem errors)
[ ] npm run lint (zero warnings)
[ ] npm test (todos passando)
[ ] npm run dev (serverStarting em localhost:3000)
[ ] Swagger acessível em /api/docs
```

**Frontend**
```bash
[ ] npm run build (sem errors ou warnings)
[ ] npm run lint (zero warnings)
[ ] npm run dev (rodando em localhost:5173)
[ ] sem console.errors ou warnings
```

---

### ✔️ Fase 2: Testes Manuais

**Autenticação**
- [ ] Login com credenciais válidas
- [ ] Login com credenciais inválidas (erro 401)
- [ ] Registro de novo usuário
- [ ] Logout funciona corretamente
- [ ] Token expira após 7 dias
- [ ] Rate limiting bloqueia após 10 tentativas (15min)
- [ ] Redirecionamento automático em 401

**Dados**
- [ ] Criar animal com imagem
- [ ] Atualizar dados do animal
- [ ] Deletar animal
- [ ] Buscar animal por nome
- [ ] Upload de arquivo > 5MB é bloqueado
- [ ] Imagem redimensionada corretamente (150x150)

**Appointments**
- [ ] Criar consulta sem conflito
- [ ] Impedir consulta no mesmo horário
- [ ] Mudar status de consulta
- [ ] Listar consultas por período
- [ ] Cancelar consulta

**Fila**
- [ ] Gerar senha começa em AB0000
- [ ] Prioridades aplicadas corretamente
- [ ] Chamada de próxima senha funciona
- [ ] Status da fila atualiza em tempo real

**Prescrições**
- [ ] Gerar PDF com medicamentos
- [ ] Download funciona corretamente
- [ ] PDF contém dados corretos
- [ ] Formatação do PDF está adequada

---

### ✔️ Fase 3: Segurança

**HTTPS & Certificados**
- [ ] HTTPS configurado (produção)
- [ ] Certificado SSL válido
- [ ] Redirects de HTTP → HTTPS

**Cookies & JWT**
- [ ] Cookie HttpOnly ativado
- [ ] Cookie SameSite=Lax configurado
- [ ] Cookie Secure=true (produção)
- [ ] JWT_SECRET é forte (>32 chars, aleatório)
- [ ] JWT_SECRET não está no Git
- [ ] Cookie não está acessível por JavaScript

**CORS**
- [ ] CORS permite apenas origem esperada
- [ ] Credentials: true configurado em ambos lados
- [ ] Methods corretos (GET, POST, PUT, DELETE)
- [ ] Headers customizados permitidos

**Validações**
- [ ] Todos os inputs validados com Zod
- [ ] Nenhum campo permite `any` type
- [ ] Erros não expõem informações internas
- [ ] SQL injection impossível (Prisma)
- [ ] XSS impossível (React escapa HTML)

**Passwords**
- [ ] Senhas com bcrypt + 10 salt rounds
- [ ] Senhas > 8 caracteres obrigatório
- [ ] Requisição POST para `/auth/login` é segura

**Rate Limiting**
- [ ] `/api/auth/*` tem limite 10 req/15min
- [ ] IPs são rastreados corretamente
- [ ] Bloqueio funciona conforme esperado

**Auditoria**
- [ ] Todas alterações são logadas (user, data, ação)
- [ ] Logs contêm timestamp preciso
- [ ] Logs não expõem dados sensíveis

---

### ✔️ Fase 4: Performance

**Backend**
- [ ] Tempo médio resposta < 200ms
- [ ] Queries otimizadas (sem N+1)
- [ ] Índices no banco estão criados
- [ ] Compression (gzip) ativado
- [ ] Cache headers configurados

**Frontend**
- [ ] Lighthouse score > 80 (desktop)
- [ ] Bundle size otimizado
- [ ] Lazy loading de componentes
- [ ] Imagens otimizadas
- [ ] Sem console.log em produção

**Database**
- [ ] Migrations executadas corretamente
- [ ] Schema está sincronizado
- [ ] Backups automáticos configurados
- [ ] Connection pooling otimizado

---

### ✔️ Fase 5: Documentação & Logs

**Documentação**
- [ ] Swagger/OpenAPI atualizado
- [ ] README.md completo
- [ ] Instruções de setup claras
- [ ] Variáveis de ambiente documentadas
- [ ] API endpoints documentados

**Logs**
- [ ] Logs estruturados com timestamp
- [ ] Níveis de log corretos (INFO, WARN, ERROR)
- [ ] Logs rodam para arquivo ou serviço
- [ ] Sem logs sensíveis (passwords, tokens)
- [ ] Log de errors com stack trace completo

---

### ✔️ Fase 6: Dependências & Vulnerabilidades

```bash
# Executar before deploy
[ ] npm audit (zero vulnerabilities críticas)
[ ] npm outdated (revisar atualizações)
[ ] Dependências legítimas (sem typosquatting)
[ ] Licenças compatíveis (MIT, Apache, etc)
```

---

### ✔️ Fase 7: Banco de Dados

**Backup & Recovery**
- [ ] Backup automático configurado
- [ ] Recovery procedure testado
- [ ] Disaster recovery plan documentado
- [ ] Retenção de backups: 30 dias

**Migrations**
- [ ] Todas migrations reversíveis
- [ ] Seed data disponível
- [ ] Migration order correto
- [ ] Sem dados perdidos no rollback

**Integridade**
- [ ] Foreign keys configuradas
- [ ] Constraints validadas
- [ ] Indexes otimizados
- [ ] Tamanho do banco monitorado

---

### ✔️ Fase 8: Deploy & Infraestrutura

**Environment**
- [ ] Variáveis de ambiente setadas
- [ ] DATABASE_URL aponta para produção
- [ ] JWT_SECRET é novo (aleatório)
- [ ] NODE_ENV=production
- [ ] API_URL é a URL de produção

**Build**
- [ ] Backend compilado sem errors
- [ ] Frontend compilado otimizado
- [ ] Source maps inclusos (para debugging)
- [ ] Assets servidos com versionamento

**Servidor**
- [ ] Reverse proxy (nginx) configurado
- [ ] SSL/TLS ativo
- [ ] Firewall permite apenas portas necessárias
- [ ] Monitoramento ativo (uptime, CPU, memória)

**CI/CD**
- [ ] Pipeline executou com sucesso
- [ ] Testes passaram (100%)
- [ ] Build artifacts criados
- [ ] Deployment aprovado

---

## 📋 TEMPLATE DE VALIDAÇÃO PRÉ-DEPLOY

```markdown
## Pre-Deploy Checklist - [DATA]

**Versão:** [VERSÃO]
**Branches:** frontend:[BRANCH] backend:[BRANCH]

### Funcional
- [ ] Feature 1 testada
- [ ] Feature 2 testada
- [ ] Bug fix 1 validado
- [ ] Regressões testadas

### Performance
- [ ] Bundle size: ___MB (< 500KB target)
- [ ] TTFB: ___ms (< 200ms target)
- [ ] API Response: ___ms

### Segurança
- [ ] npm audit: ✅ PASS
- [ ] XSS tests: ✅ PASS
- [ ] CORS tests: ✅ PASS
- [ ] Rate limit tests: ✅ PASS

### Documentação
- [ ] Swagger updated
- [ ] README updated
- [ ] Env vars documented

**Aprovado por:** ________________
**Data:** ___/___/_____
```

---

## 🚨 CRITÉRIO DE REJEIÇÃO (BLOQUEADORES)

### ❌ NUNCA fazer deploy se:
1. Existe erro TypeScript (`npm run build` falha)
2. Teste unitário falha (`npm test` < 100%)
3. Security vulnerability crítica existe
4. HTTPS/TLS não configurado (produção)
5. Credenciais em repositório
6. Mais de 10 console.errors
7. Database migration falha
8. API não responde em teste manual

---

## 🔔 MONITORAMENTO PÓS-DEPLOY

### Primeira Hora
```
[ ] Serviço está online (200 OK)
[ ] Logs sem errors críticos
[ ] Performance normal (< 200ms)
[ ] Taxa de erro < 0.1%
[ ] CPU/Memória normal
```

### Primeiro Dia
```
[ ] Nenhum usuário reportou issue
[ ] Alertas não foram acionados
[ ] Funcionalidades principais funcionam
[ ] Backup foi executado automaticamente
```

### Primeira Semana
```
[ ] Relatório de performance gerado
[ ] Nenhuma regressão reportada
[ ] Logs analisados
[ ] User feedback coletado
```

---

## 🔄 ROLLBACK PROCEDURE

Se detectado problema crítico após deploy:

```bash
# 1. Parar serviço
systemctl stop vet-api

# 2. Reverter para versão anterior
git checkout [PREVIOUS_TAG]
npm install
npm run build

# 3. Restartar
systemctl start vet-api

# 4. Validar
curl -s http://localhost:3000/api/health | jq .

# 5. Documentar
echo "Rollback: [VERSÃO_ANTERIOR] - [MOTIVO]" >> DEPLOYMENT.log
```

---

## 📞 ESCALAÇÃO

| Problema | Responsável | Tempo Resposta |
|----------|-------------|-----------------|
| API Down | DevOps | 15 min |
| Data Loss | DBA | 30 min |
| Security Issue | Security Team | Imediato |
| Performance | Backend Team | 1h |

---

**Checklist revisado:** 13 de Maio de 2026  
**Próxima revisão:** 27 de Maio de 2026

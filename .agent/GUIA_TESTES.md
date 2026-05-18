# 🧪 GUIA DE TESTES - VALIDAÇÃO DO AMBIENTE

**Data:** 13 de Maio de 2026  
**Status:** Ready to Test

---

## 🚀 AMBOS OS SERVIDORES ESTÃO RODANDO!

```
✅ Backend:  http://localhost:3000  (Express + Node.js)
✅ Frontend: http://localhost:5173  (Vite + React)
```

---

## 📋 TESTES BÁSICOS

### 1. Backend - Teste de Conectividade

```bash
# Abra o terminal/PowerShell:
curl http://localhost:3000

# Esperado: Resposta da API ou HTML
# Se receber "Connection refused": Backend não está rodando
```

### 2. Frontend - Teste de Interface

```
Abra no navegador:
http://localhost:5173

Esperado:
- Login page com campos de email/password
- Sem erros no console (F12)
- Layout responsivo
- Sem console.errors
```

### 3. Login Manual

```
1. Abra http://localhost:5173
2. Clique em "Login"
3. Tente um email
4. Tente uma senha
5. Clique "Entrar"

Esperado:
- Validação de campos
- Mensagem de erro (credenciais inválidas)
- Sem crashes
```

### 4. Verificar Rotas da API

```bash
# Terminal/PowerShell:

# Listar animais (sem auth, pode retornar erro)
curl http://localhost:3000/api/animals

# Verificar health da API
curl http://localhost:3000

# Expected: Alguma resposta (JSON ou HTML)
```

---

## 🔍 VALIDAÇÕES DE ERRO

### Backend - Se der erro na porta 3000

```
❌ "Connection refused"
→ Terminal 1 está fechado
→ npm run dev não está rodando
→ Reinicie: npm run dev em backend/

❌ "TypeError: Cannot read properties"
→ Há erro no código
→ Verifique mensagem de erro no terminal
→ Corrija o arquivo indicado
```

### Frontend - Se der erro na porta 5173

```
❌ "Connection refused"
→ Terminal 2 está fechado
→ npm run dev não está rodando
→ Reinicie: npm run dev em frontend/

❌ Blank page / erro "Uncaught SyntaxError"
→ Há erro no código React
→ Verifique o console (F12)
→ Corrija o arquivo indicado
```

---

## 🎯 TESTES MANUAIS RECOMENDADOS

### Teste 1: Página de Login
```
✅ Painel de login aparece
✅ Campos de email/password visíveis
✅ Botão "Entrar" presente
✅ Link de "Registrar" (se houver)
✅ Validação de campos (visual)
✅ Sem console.errors
```

### Teste 2: API Status
```
✅ Backend responde em localhost:3000
✅ Rota /api/animals acessível
✅ Sem erro 500 (erros internos)
✅ CORS configurado
✅ Headers corretos
```

### Teste 3: Hot Reload
```
✅ Edite um arquivo .ts ou .tsx
✅ Arquivo salva automaticamente
✅ Página recarrega no navegador
✅ Mudanças aparecem
✅ Sem perder estado (se possível)
```

### Teste 4: Integração Frontend-Backend
```
✅ Frontend consegue conectar a backend
✅ Requisições HTTP funcionam
✅ CORS não bloqueia
✅ Cookies são enviados
✅ JWT é armazenado
```

---

## 📊 CHECKLIST DE STATUS

Abra o terminal do seu projeto e valide:

```bash
# Terminal 1 - Backend
cd backend
npm run dev
# Esperado: 🚀 VET CRM API Servidor rodando na porta 3000

# Terminal 2 - Frontend
cd frontend
npm run dev
# Esperado: VITE v5.4.21  ready in XXX ms
#          ➜  Local:   http://localhost:5173/
```

---

## 🔒 VALIDAÇÕES DE SEGURANÇA

```
✅ API não expõe dados sensíveis em erro 500
✅ CORS está restritivo
✅ JWT está em cookie HttpOnly
✅ Passwords não aparecem em logs
✅ Rate limiting não bloqueia testes locais
```

---

## 📈 PERFORMANCE

Abra DevTools (F12) no Firefox/Chrome:

```
Network tab:
- Load time: < 2 segundos
- Bundle size: < 500KB (ideal)
- Sem requests em erro (404, 500)

Performance tab:
- LCP (Largest Contentful Paint) < 2.5s
- CLS (Cumulative Layout Shift) < 0.1
- FID (First Input Delay) < 100ms
```

---

## 🎓 PRÓXIMAS AÇÕES

Depois que validar que ambos rodam:

1. **Documentar no Task.md**
   ```
   [x] Backend rodando
   [x] Frontend rodando
   [ ] Teste de login
   [ ] Teste de CRUD
   ```

2. **Atualizar PROGRESS.md**
   ```
   Dia 14/05: Ambiente validado, stack completo operacional
   ```

3. **Começar desenvolvimento**
   ```
   Selecione tarefas de Task.md
   Siga padrões de .instructions.md
   Valide com CHECKLIST.md antes de deploy
   ```

---

## 📞 TROUBLESHOOTING RÁPIDO

| Problema | Solução |
|----------|---------|
| Porta 3000 já em uso | `netstat -ano \| findstr :3000` depois matar processo |
| Porta 5173 já em uso | Mudar porta: `npm run dev -- --port 5174` |
| node_modules corrompido | `rm -r node_modules && npm install` |
| npm com erro | `npm cache clean --force` |
| TypeScript error | Verifique arquivo indicado, há erro de tipo |
| React não recarrega | Salve arquivo novamente ou Ctrl+Shift+R |

---

## ✅ VALIDAÇÃO FINAL

```
Checklist de funcionamento:

[ ] Backend iniciando sem erros
[ ] Frontend iniciando sem erros
[ ] Ambos em portas diferentes (3000 e 5173)
[ ] Sem conflitos de porta
[ ] Hot reload funcionando
[ ] F12 sem console.errors
[ ] Interface carregando
[ ] API respondendo
[ ] CORS funcionando
[ ] Ready para desenvolvimento
```

---

## 🎉 SE TUDO PASSOU

**Parabéns! Seu ambiente está pronto!**

Próximos passos:
1. Consulte `Task.md` para tarefas
2. Siga `instructions.md` para padrões
3. Use `CHECKLIST.md` antes de deploy
4. Atualize `PROGRESS.md` diariamente

---

**Desenvolvido:** 13 de Maio de 2026  
**Status:** ✅ Pronto para Testes


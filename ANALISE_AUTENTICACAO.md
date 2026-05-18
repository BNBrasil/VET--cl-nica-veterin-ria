# Análise de Arquitetura: Login, Cadastro e Autenticação — B.N.B.R

Este documento descreve detalhadamente o ecossistema de segurança implementado para gerenciar o acesso dos usuários ao ambiente do **B.N.B.R**. Aqui abordamos como a infraestrutura foi projetada, os motivos por trás das principais decisões técnicas, e uma avaliação crítica com sugestões de otimização futura.

---

## 🛡️ Como Foi Feito (Implementação Técnica)

O sistema adota uma arquitetura de **autenticação sem estado (stateless) robustecida**, integrando camadas de proteção ativa no servidor e uma interface dinâmica no cliente.

### 1. Mecanismo de Sessão (JWT & Cookies)
A identidade do usuário é assegurada via **JSON Web Tokens (JWT)**. O token não é exposto à aplicação JavaScript do front-end; em vez disso, ele é assinado com a chave `JWT_SECRET` e entregue via cookie seguro do navegador.
*   **Configuração de Cookies**: O back-end utiliza a flag `httpOnly: true` combinada com `sameSite: 'lax'` e ativação dinâmica de `secure: true` em ambientes de produção (HTTPS).
*   **Duração**: O cookie possui validade configurada para 7 dias (`JWT_EXPIRES_IN` ou `maxAge: 7 * 24 * 60 * 60 * 1000`), eliminando a necessidade de login repetitivo no uso cotidiano.

### 2. Back-end (Express & MySQL)
A lógica de autenticação fica centralizada no Node.js/Express (via [server.ts](file:///e:/B.N.B.R/B.N.B.R/backend/server.ts) e [auth.ts](file:///e:/B.N.B.R/B.N.B.R/backend/auth.ts)), conversando com o banco relacional (MySQL na Hostinger).
*   **Segurança de Senhas**: Utiliza hashing criptográfico unidirecional robusto através do `bcryptjs` com **10 salt rounds** nas etapas de cadastro e de redefinição de senha.
*   **Middlewares de Controle**:
    *   `authMiddleware`: Extrai e valida a assinatura do JWT contido no cookie, injetando os dados do usuário em `req.user` no ciclo da requisição ou retornando erro `401 Unauthorized`.
    *   `adminMiddleware`: Valida se o papel do usuário (`role`) é explicitamente `'admin'`, bloqueando qualquer rota administrativa privada com um erro `403 Forbidden`.

### 3. Camadas Extras de Proteção Ativa
Para se defender contra ataques comuns da Web (como dicionário, hijacking e flood), incluíram-se as seguintes defesas:
*   **Anti-Brute Force no Login**: O sistema monitora erros consecutivos de acesso utilizando colunas de controle direto no banco (`failed_attempts` e `locked_until`). Ao bater a marca de **5 tentativas erradas consecutivas**, a conta é travada automaticamente por **30 minutos**.
*   **Rate Limiter por IP**: Integrado nativamente com o pacote `express-rate-limit`. Requisições nas rotas críticas de autenticação (`/api/auth/*`) são reguladas pelo `authLimiter` com limite estrito de **10 requisições a cada 15 minutos por IP**.
*   **Duplo Fator de Autenticação (2FA via E-mail)**: Caso a feature esteja ativa (`two_factor_enabled`), o login parcial gera um código numérico temporário de 6 dígitos válido por 10 minutos, despachado via SMTP autenticado (`nodemailer`). A validação é realizada pela tabela temporária `two_factor_codes`.
*   **Fluxo de Recuperação Altamente Seguro**: O fluxo de redefinição gera tokens voláteis na tabela `password_resets` (expiração em 15 min). Se o código for inserido incorretamente mais de 3 vezes, o token de recuperação é autodestruído.

### 4. Front-end (React, Tailwind & Framer Motion)
Uma experiência moderna implementada no componente [Login.tsx](file:///e:/B.N.B.R/B.N.B.R/src/screens/Login.tsx).
*   **Validação Pró-ativa em Tempo Real**: Um conjunto visual de checks alerta o usuário se a senha cumpre os padrões (pelo menos 6 letras, 1 maiúscula, 1 número e 1 especial) antes do envio da requisição.
*   **Navegação Fluida**: Transições dinâmicas gerenciadas pelo `<AnimatePresence>` do Framer Motion intercalam as telas de Login, Cadastro, Digitação de 2FA e Fluxo de Recuperação de Senha sem refresh de tela (Single Page Application).

---

## 🧠 Por Que Foi Feito Assim? (Racional Técnico)

### 1. Controle Total e Custo Zero (Sem Firebase)
Diferente de um Firebase Auth tradicional, uma arquitetura local elimina limitações de cota grátis, latências na conexão com nuvens externas, e viabiliza a integração nativa de relatórios financeiros unificando Perfis, Holerites e Autenticação nas queries SQL sem integrações complexas.

### 2. Resistência Robusta a Vulnerabilidades (XSS vs CSRF)
Salvar tokens JWT em chaves no `localStorage` expõe o token a ataques do tipo Cross-Site Scripting (XSS) — caso algum script externo ou biblioteca injete código maligno, sua credencial seria roubada.
A decisão por utilizar **cookies `httpOnly`** proíbe o JavaScript de "ler" o token, garantindo proteção completa contra vazamentos de credenciais por XSS.

### 3. Tolerância a Falhas no SMTP
O ecossistema utiliza credenciais SMTP da Hostinger devidamente configuradas com criptografia segura. Isso viabiliza o envio das notificações de e-mail com alto nível de entrega (SPF/DKIM configurado), impedindo que os códigos de 2FA caiam no lixo eletrônico.

### 4. Segurança Progressiva e Contas de Teste
O bypass nativo configurado para a conta de usuário `'test'` garante agilidade no ciclo de desenvolvimento e de Quality Assurance (QA), enquanto a proteção rigorosa de 2FA ativa-se de forma opcional de acordo com a preferência de privacidade e segurança de cada usuário.

---

## 🚀 Como Pode Ser Melhorado (Roadmap de Otimização)

### 🔴 Urgente: Correção de Infraestrutura de Banco
> [!IMPORTANT]
> **Adequação do Schema Base**
> Atualmente, as tabelas `password_resets`, `two_factor_codes` e as colunas de controle do anti-brute force (`failed_attempts`, `locked_until`) do modelo [usuarios](file:///e:/B.N.B.R/B.N.B.R/schema.sql) não constam declaradas no dump primário de criação nem no instalador [setup.js](file:///e:/B.N.B.R/B.N.B.R/setup.js).
> *   **Risco**: Erro fatal de banco de dados caso o projeto seja instalado em um servidor novo ou limpo (homologação).
> *   **Solução recomendada**: Atualizar o script de bootstrap do final do arquivo [server.ts](file:///e:/B.N.B.R/B.N.B.R/backend/server.ts) para criar e alterar essas tabelas de forma autônoma, similar ao tratamento de `pokemon_collections`.

### 🟡 Altamente Recomendável: Organização e Segurança de Sessão
> [!WARNING]
> **1. Modularização do `server.ts`**
> Toda a lógica dos controllers de Auth reside solta diretamente no corpo principal de rotas do [server.ts](file:///e:/B.N.B.R/B.N.B.R/backend/server.ts) (que possui mais de 2.000 linhas de código).
> *   **Impacto**: Manutenção complexa e dificuldades severas na resolução de conflitos Git em times de desenvolvimento paralelos.
> *   **Sugestão**: Mover os fluxos de Login, Cadastro e 2FA para uma estrutura `backend/controllers/authController.ts` e registrá-los em rotas específicas.

> [!TIP]
> **2. Implementação de Refresh Tokens (Rotação de JWT)**
> Atualmente, se uma credencial (JWT) for vazada, o atacante terá direito a 7 dias de acesso ininterrupto sem que o backend consiga "deslogar" este token em específico de forma remota (visto que JWTs são stateless).
> *   **Sugestão**: Adotar o fluxo tradicional de OAuth 2.0: um `AccessToken` curto (ex: 1 hora de duração) guardado em memória/cookie, e um `RefreshToken` opaco persistido no banco com validade estendida. Isso possibilita invalidar ou forçar o "Sair de Todos os Dispositivos" remotamente a qualquer instante.

### 🟢 Oportunidades de Novas Funcionalidades (UX/Security)
1.  **Migração de 2FA para TOTP (Google Authenticator)**:
    Gerar códigos 2FA locais no celular do usuário gera zero custos com SMTP, possui confiabilidade instantânea (não há atrasos de e-mail) e maior aderência técnica de segurança que canais de terceiros como e-mail.
2.  **Regulamentação e Histórico de Logins**:
    Criar uma tabela `login_history` para monitorar qual IP, Cidade/Região presumida e qual navegador/OS logou na conta. Ao detectar disparidades drásticas de localidade, enviar alertas imediatos de "Acesso Detectado de Outro Dispositivo".
3.  **Social Login (Google, GitHub)**:
    Integrar login social na tela inicial para simplificar drasticamente o cadastro e reduzir barreiras de entrada, acelerando onboarding de novos clientes corporativos.

---
*Documento elaborado pela IA Antigravity em 14 de maio de 2026 para governança e documentação do ecossistema B.N.B.R.*

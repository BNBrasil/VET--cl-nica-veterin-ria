# Como Rodar o VET em um Subdominio na Hostinger

Este guia explica como publicar o sistema VET em um subdominio, por exemplo:

```text
vet.bnbr.online
```

## Situacao Atual

Subdominio escolhido:

```text
https://vet.bnbr.online/
```

Verificacao em 19/05/2026:

- `vet.bnbr.online` responde HTTP 200.
- Ele mostra a pagina padrao da Hostinger.
- DNS atual do subdominio aponta para `91.108.127.249` e `77.37.42.205`.
- O dominio principal `bnbr.online` aponta para `147.93.14.40`, que e o servidor Node usado atualmente.

No servidor Hostinger, via SSH, hoje aparece apenas:

```text
/home/u966758071/domains/bnbr.online
/home/u966758071/domains/bnbr.online/nodejs
/home/u966758071/domains/bnbr.online/public_html
```

Ou seja: o subdominio `vet.bnbr.online` ainda nao aparece como website/dominio separado no filesystem desta hospedagem Node.

Tambem existe:

```text
/home/u966758071/domains/bnbr.online/public_html/vet/default.php
```

mas isso e apenas a pagina padrao criada pela Hostinger, nao a aplicacao VET Node.js.

Para rodar o VET de forma independente, o caminho recomendado e criar o subdominio como um website independente no hPanel.

## Opcao Recomendada: Subdominio Como Website Independente

Use essa opcao quando o VET deve rodar separado do site principal, com configuracoes proprias.

### 1. Criar o subdominio no hPanel

1. Acesse o hPanel da Hostinger.
2. Va em **Websites**.
3. Clique em **Add Website**.
4. Escolha **Node.js Apps**.
5. Informe o subdominio completo, por exemplo:

```text
vet.bnbr.online
```

6. Escolha uma das formas de deploy:
   - **Import Git Repository**, usando este repositorio do GitHub.
   - **Upload your website files**, enviando um `.zip`.

Segundo a documentacao da Hostinger, criar o subdominio como website independente da ao subdominio suas proprias configuracoes e opcoes de gerenciamento.

## Configuracao Recomendada Para Node.js App

No setup da Hostinger, use:

```text
Framework: Other ou Express.js, se detectado
Build command: npm run build
Output directory: dist
Entry file: server.js
Node version: 22.x ou 24.x
```

O projeto ja esta preparado para gerar:

```text
dist/server.js
```

com:

```bash
npm run build
```

## Variaveis de Ambiente

No hPanel, configure as variaveis em **Node.js App > Environment Variables**.

Use o arquivo `.env.example` como base:

```env
NODE_ENV=production
PORT=3000
FRONTEND_URL=https://vet.bnbr.online
DATABASE_URL=mysql://USUARIO:SENHA@HOST:3306/BANCO
VET_JWT_SECRET=crie-uma-chave-forte
VET_JWT_EXPIRES_IN=7d
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
VITE_API_BASE_URL=
```

Observacoes:

- Nao envie `.env` real para o GitHub.
- `DATABASE_URL` precisa apontar para o banco MySQL correto.
- `VET_JWT_SECRET` deve ser diferente do exemplo.
- Se frontend e backend estiverem no mesmo subdominio, `VITE_API_BASE_URL` pode ficar vazio.
- Se a API estiver em outro dominio, configure `VITE_API_BASE_URL=https://seu-dominio-da-api`.

## DNS do Subdominio

Se o dominio principal usa nameservers da Hostinger, o DNS do subdominio normalmente e criado automaticamente.

Se o DNS estiver em outro provedor, como Cloudflare, crie um registro:

```text
Tipo: A
Nome: vet
Valor: IP da hospedagem Hostinger
```

Para este projeto, o IP do servidor Node usado por `bnbr.online` e:

```text
147.93.14.40
```

Se quiser usar o mesmo servidor Node, ajuste o DNS para:

```text
Tipo: A
Nome: vet
Valor: 147.93.14.40
```

A propagacao pode levar alguns minutos, e em alguns casos ate 24 horas.

## Deploy Pelo GitHub

1. No hPanel, escolha **Import Git Repository**.
2. Autorize a Hostinger no GitHub.
3. Selecione:

```text
BNBrasil/VET--cl-nica-veterin-ria
```

4. Configure:

```text
Branch: main
Build command: npm run build
Output directory: dist
Entry file: server.js
```

5. Adicione as variaveis de ambiente.
6. Clique em **Deploy**.

## Deploy Manual Por ZIP

Caso prefira upload manual:

1. Localmente, rode:

```bash
npm install
npx prisma generate
npm run build
```

2. Compacte o conteudo da pasta `dist`.
3. Envie para o app Node.js do subdominio no hPanel.
4. Configure o entry file como:

```text
server.js
```

## Como Eu Posso Finalizar Depois

Depois que o subdominio aparecer no hPanel como website Node.js ou no SSH como pasta propria, eu consigo:

1. Enviar o build para o caminho correto.
2. Configurar/revisar os arquivos de producao.
3. Reiniciar a aplicacao Node.
4. Testar:

```text
https://vet.bnbr.online/api/health
https://vet.bnbr.online/vet/login
```

## Checklist Rapido Para Liberar o Deploy

Antes de eu finalizar o deploy no subdominio, confirme no hPanel:

- `vet.bnbr.online` foi criado como **Node.js App** ou **website independente**.
- O DNS `A vet` aponta para `147.93.14.40`, se for usar a mesma hospedagem Node.
- As variaveis de ambiente foram cadastradas no app Node.
- O app usa:

```text
Build command: npm run build
Output directory: dist
Entry file: server.js
```

## Fontes Oficiais Hostinger

- Criacao de subdominios na Hostinger: https://www.hostinger.com/support/1583405-how-to-create-and-delete-subdomains-in-hostinger/
- Deploy de Node.js App na Hostinger: https://www.hostinger.com/support/how-to-deploy-a-nodejs-website-in-hostinger/

# Usar o escritório pelo celular

O Claude Code e os agentes continuam rodando **no computador**. O celular vira um controle remoto:
chat, mapa animado e equipe, instalável na tela inicial como um app.

## 1. Em casa (mesmo Wi-Fi)

1. No computador, abra o escritório → **⚙ Configurar → Celular → Ligar acesso pelo celular**.
   - No Windows, se aparecer o aviso do Firewall para o "Node.js", marque **Redes privadas** e permita.
2. Clique em **Conectar um celular**: aparece um **QR code** e um **código de 6 dígitos** (vale 5 minutos,
   serve uma vez só).
3. No celular (no mesmo Wi-Fi), aponte a câmera para o QR code. Pronto: o aparelho fica pareado.
4. Para instalar como app: no menu do navegador, **Adicionar à tela inicial**.

## 2. Fora de casa (4G ou outro Wi-Fi) com Tailscale — recomendado

O [Tailscale](https://tailscale.com) cria uma rede privada e criptografada entre os seus aparelhos.
É gratuito para uso pessoal e **não expõe o escritório na internet**.

1. Instale o Tailscale **no computador** e **no celular** e entre com a mesma conta nos dois.
2. No computador, deixe o acesso pelo celular ligado (passo 1 acima). O Configurar passa a mostrar um
   endereço `100.x.x.x` marcado como **Tailscale**; o QR code usa esse endereço primeiro.
3. Pareie o celular pelo QR code (com o Tailscale ligado no celular). Depois disso funciona em qualquer lugar,
   desde que o computador esteja ligado, com o escritório aberto e o Tailscale conectado.

### Opcional: endereço HTTPS (app completo, notificações)

Com HTTPS o navegador libera o app instalável completo (funciona em tela cheia e avisa quando um agente
precisar de você). No computador, num terminal:

```
tailscale serve --bg 4317
```

Isso publica o escritório **só dentro da sua rede Tailscale** em `https://<nome-do-pc>.<sua-rede>.ts.net/`.
O Configurar detecta e mostra esse endereço no topo da lista de links do QR code.
(Na primeira vez o Tailscale pode pedir para habilitar HTTPS no painel dele.)
Para desfazer: `tailscale serve reset`.

> **Não** use `tailscale funnel` nem redirecionamento de porta no roteador: isso abriria o escritório
> para a internet inteira.

## Segurança

- Só aparelhos pareados entram. Cada um recebe um token próprio (cookie protegido); no computador fica
  salvo apenas o *hash* do token, em `escritorio-ia/data/aparelhos.json`.
- Em **⚙ Configurar → Celular** você vê os aparelhos conectados e pode **revogar** qualquer um.
- Pelo celular dá para conversar com os agentes, trocar nomes e o modo de permissão. **Login, chave de API,
  instalar, ligar/desligar o acesso remoto e desligar o escritório só no computador.**
- Código de pareamento: 6 dígitos, 5 minutos, uso único, no máximo 8 tentativas erradas.
- Em casa sem Tailscale a conexão é HTTP comum dentro do seu Wi-Fi: use só em rede de confiança.
  Fora de casa, sempre pelo Tailscale (criptografado).

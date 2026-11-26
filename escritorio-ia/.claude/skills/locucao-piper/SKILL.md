---
name: locucao-piper
description: Use para gerar, ouvir/conferir e corrigir a narração dos vídeos com o Piper (TTS offline e gratuito) - instalar a voz (node producao/instalar-voz.js), gerar com node producao/tts.js, escolher voz e velocidade no pauta.json, ajustar a pronúncia de nomes de jogos em producao/pronuncia.json e checar duração e volume. Acione no locutor e quando a narração soar errada.
---

# Locução com Piper

Piper é um TTS **offline e grátis** (vozes pt_BR da Rhasspy). Tudo roda no computador do usuário.
Arquivos: programa e vozes em `producao/voz/` (gerado, fora do git), pronúncias em
`producao/pronuncia.json`, código em `producao/tts.js` e `producao/lib/` (frente de vídeo: não edite o código).

## 1. Instalar (uma vez; idempotente)
```bash
node producao/instalar-voz.js            # baixa o Piper + vozes pt_BR para producao/voz/
node producao/instalar-voz.js --forcar   # rebaixa se algo corrompeu
```
Vozes: `pt_BR-faber-medium` (padrão, masculina, clara), `pt_BR-cadu-medium`, `pt_BR-jeff-medium`.

## 2. Gerar e conferir
- O `montar.js` já narra cada `fala` do pauta.json sozinho. O locutor gera antes para **conferir**:
  ```bash
  node producao/tts.js --help     # mostra as opções da versão instalada (a interface é da frente de vídeo)
  ```
  Gere um trecho de teste com as falas do dia e confira: nomes de jogos, números, siglas, preços.
- Duração: a cena dura o áudio + 0,3 s. Some as falas: precisa caber em ≤ 60 s (ideal 20–55 s).
  Confira com `ffprobe -v error -show_entries format=duration -of csv=p=0 <arquivo.wav>`.
- Velocidade no pauta.json: `"voz": { "modelo": "pt_BR-faber-medium", "velocidade": 1.0 }`
  (1.05–1.12 deixa mais "notícia rápida"; acima de 1.15 começa a embolar).

## 3. Pronúncia (`producao/pronuncia.json`)
Chave = como aparece no texto (maiúsculas/minúsculas ignoradas; frases longas têm prioridade);
valor = como falar, com acento agudo na sílaba forte. Ex.:
```json
{ "GTA 6": "gê tê á seis", "Rockstar": "róque istar", "Bread and Fred": "bréd én fréd" }
```
- Antes de narrar, liste os nomes próprios do dia (jogos, empresas, siglas) e adicione os que faltam.
- Inglês: escreva como um brasileiro fala ("Silent Hill" → "sáilent ríl"; "Ghostrunner" → "goust râner").
- Números romanos: "Final Fantasy VII" → "fáinal fântasi sete". Preços: escreva a fala por extenso
  ("setenta e quatro reais e noventa e sete") ou confira se o tts normaliza "R$ 74,97" corretamente.
- Mantenha o JSON válido (`node -e "JSON.parse(require('fs').readFileSync('producao/pronuncia.json','utf8'))"`).
- Não apague entradas de outros; acrescente.

## 4. Checklist da narração
- [ ] Todos os nomes do dia soam certos (ouviu ou conferiu a transcrição fonética no pronuncia.json)
- [ ] Sem palavra cortada no começo/fim de trecho
- [ ] Soma das durações ≤ 60 s
- [ ] Volume: o montar.js normaliza para -14 LUFS; se gerar à parte, não aplique ganho extra
- [ ] Nunca imitar voz de pessoa real; a voz é sintética (rotule como IA se a rede pedir)

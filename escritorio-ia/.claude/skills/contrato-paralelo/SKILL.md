---
name: contrato-paralelo
description: Use em TODO pedido antes de delegar - escreve o CONTRATO.md do pedido (objetivo, no mínimo 4 frentes com dono e arquivos exclusivos, interfaces, dependências, critério de pronto) e dispara as frentes em ondas paralelas de 4 ou mais agentes numa única resposta com várias chamadas Agent. Acione no orquestrador sempre, inclusive em pedidos pequenos e no fluxo canal-gamer.
---

# Contrato + trabalho em paralelo (mínimo 4 agentes por vez)

Regra do escritório: **os agentes trabalham sempre em paralelo, no mínimo 4 ao mesmo tempo, sempre a
partir de um contrato.** Nunca uma sala por vez.

## Passo a passo
### (a) Escreva o contrato antes de delegar
`entregas/<aaaa-mm-dd>-<slug>/CONTRATO.md` com:
1. **Objetivo** (1–3 linhas) e critério de pronto do pedido inteiro.
2. **Frentes (mínimo 4)**: dono (sala) e **pastas/arquivos exclusivos** de cada uma. Duas frentes
   nunca escrevem no mesmo arquivo; se precisarem, uma é dona e a outra entrega um arquivo à parte.
3. **Interfaces**: formatos, nomes de arquivo e schemas que uma frente entrega para a outra
   (ex.: `pauta.json` do `producao/CONTRATO.md`, `roteiro.md`, `.srt`, `post.json`).
4. **Dependências e ondas**: quem precisa do quê, e em qual onda cada frente roda.
5. **Critério de pronto por frente** (verificável: arquivo existe, teste passa, revisor aprovou…).

### (b) Dispare todas as frentes independentes numa ÚNICA resposta
Várias chamadas da ferramenta Agent **na mesma mensagem** → rodam simultâneas. Cada prompt é
autossuficiente e começa com "Leia primeiro entregas/<projeto>/CONTRATO.md". Nunca dispare uma,
espere, e dispare a próxima.

### (c) Dependente não espera: começa com placeholder
Quem depende de outra frente começa já, com rascunho/placeholder **no formato do contrato**
(ex.: editor prepara a montagem com um pauta.json de exemplo; social-media rascunha legenda com o tema
provável; locutor prepara pronúncias dos nomes que já se sabe). Na onda seguinte troca pelo real.

### (d) Ondas
Quando uma onda termina: integre (confira as interfaces), atualize o contrato se algo mudou e
dispare a próxima onda, **de novo com 4 ou mais em paralelo**.

### (e) Pedido pequeno? Divida em frentes complementares úteis
Nunca menos de 4. Frentes de apoio que sempre agregam: **pesquisa** (referências, fatos, fontes),
**rascunho** principal, **alternativas** (2ª versão, outro gancho, outro formato), **pré-revisão**
(revisor lendo o que já existe), **preparação de assets** (capa, thumb, imagens com crédito),
**legendas e hashtags**, **pronúncias/voz**, **testes**.

### (f) Revisor em paralelo, não só no fim
O revisor entra já na 1ª ou 2ª onda revisando o que existe (contrato, pesquisa, rascunho) e devolve
bloqueantes cedo. Na última onda faz a revisão final.

## Exemplo de contrato curto
```markdown
# CONTRATO — 2026-11-26-reels-vacina
Objetivo: reels 30 s "Vacina do seu pet em dia em 3 passos" (9:16) + post. Pronto = vídeo aprovado pelo revisor.

| Frente | Dono | Escreve só em | Entrega (interface) | Onda |
|---|---|---|---|---|
| Roteiro | roteirista | roteiro/ | roteiro.md (tabela de cenas, ~75 palavras) | 1 |
| Vinheta | animador | anim/ | vinheta_9x16.mp4 (3 s) | 1 |
| Capa e paleta | designer | design/ | capa_1080x1920.png, paleta.md | 1 |
| Pré-revisão + fatos | revisor | revisao/ | revisao-onda1.md | 1 |
| Montagem | editor-video | video/ | reels_9x16_v01.mp4 + .srt + cortes.md | 2 (começa na 1 com placeholder) |
| Legenda do post | roteirista (2ª instância) | roteiro/post/ | legenda-post.txt | 2 |

Interfaces: roteiro.md segue estrutura-roteiro; vídeo segue padrao-export; .srt segue legendas-srt.
Dependências: montagem precisa de roteiro.md + vinheta (onda 1). Revisor final na onda 3 com editor corrigindo.
```

## Exemplo de resposta com 4 chamadas Agent simultâneas
Uma única mensagem do orquestrador contendo:
```
Agent(subagent_type="roteirista",  prompt="Leia entregas/2026-11-26-reels-vacina/CONTRATO.md. Frente Roteiro: ... salve em entregas/.../roteiro/roteiro.md. Devolva o bloco ENTREGA.")
Agent(subagent_type="animador",    prompt="Leia .../CONTRATO.md. Frente Vinheta: vinheta 3 s 9:16 com o template Remotion ... salve em .../anim/. Devolva ENTREGA.")
Agent(subagent_type="designer",    prompt="Leia .../CONTRATO.md. Frente Capa e paleta: ... salve em .../design/. Devolva ENTREGA.")
Agent(subagent_type="revisor",     prompt="Leia .../CONTRATO.md. Pré-revisão: confira se o contrato tem buracos e se os fatos do briefing têm fonte. Devolva VEREDITO.")
Agent(subagent_type="editor-video", prompt="Leia .../CONTRATO.md. Frente Montagem (placeholder): prepare a timeline com testsrc no lugar da vinheta e a estrutura de cenas do contrato; na onda 2 troca pelo real. Salve em .../video/.")
```
(5 chamadas no mesmo bloco de ferramentas; o mínimo é 4.)

## Checklist do orquestrador
- [ ] CONTRATO.md escrito antes da 1ª chamada Agent
- [ ] Cada onda tem ≥ 4 chamadas Agent na MESMA resposta
- [ ] Nenhum arquivo com dois donos
- [ ] Dependentes começaram com placeholder
- [ ] Revisor entrou antes da última onda

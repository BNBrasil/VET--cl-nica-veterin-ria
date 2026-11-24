---
name: briefing
description: Use ao receber um pedido novo do cliente, antes de distribuir tarefas - transforma o pedido solto em briefing estruturado (objetivo, público, formato, prazo, tom, restrições), decide o que perguntar e o que assumir, e gera o plano de tarefas por sala.
---

# Briefing

Objetivo: sair do pedido do cliente com um `briefing.md` claro e um plano de tarefas por sala,
fazendo no máximo **uma rodada de perguntas**.

## Passo a passo
1. Leia o pedido inteiro e liste o que já está definido.
2. Preencha o modelo abaixo. Para cada campo vazio, decida:
   - **Muda o resultado?** (formato, duração, público, plataforma, prazo) → pergunte.
   - **Detalhe?** (cor exata, fonte, nº de hashtags) → assuma o padrão e registre em "Suposições".
3. Agrupe as perguntas numa mensagem só, com opções sugeridas ("9:16 para reels (padrão) ou 16:9?").
4. Crie a pasta `entregas/<aaaa-mm-dd>-<slug>/` e salve `briefing.md` ali.
5. Gere o plano: uma linha por tarefa, com sala, entrada, saída e dependência.

## Modelo de `briefing.md`
```markdown
# Briefing — <título>
- Cliente/projeto: 
- Objetivo (o que muda se der certo): 
- Público: 
- Entregáveis e formatos: (ex.: reels 9:16 30 s + versão 16:9 + 3 posts 1080x1350)
- Plataforma(s): 
- Tom de voz: (padrão: skill tom-de-voz)
- Referências: 
- Restrições: (marca, palavras proibidas, duração máx.)
- Prazo: 
- Suposições feitas: 
- Critério de pronto: (ex.: revisor APROVADO + checklist-entrega completo)

## Plano
| # | Sala | Tarefa | Entrada | Saída | Depende de |
|---|------|--------|---------|-------|-----------|
| 1 | roteirista | roteiro 30 s + 3 ganchos | briefing.md | roteiro/roteiro.md | — |
| 2 | animador | vinheta de abertura 3 s | roteiro.md cena 1 | anim/abertura.mp4 | 1 |
| 3 | editor-video | montagem 9:16 e 16:9 + srt | roteiro, anim, bruto | video/ | 1, 2 |
| 4 | revisor | QA final | tudo | veredito | 3 |
```

## Padrões quando o cliente não disser
| Item | Padrão |
|---|---|
| Vídeo curto | 9:16, 1080x1920, 30 fps, 30 s, legenda queimada |
| Vídeo longo | 16:9, 1920x1080, 30 fps |
| Post feed | 1080x1350 (4:5) |
| Idioma | português do Brasil |
| Tom | skill `tom-de-voz` |

## Perguntas que valem a pena
- Para onde vai? (Instagram, TikTok, YouTube, site)
- Qual ação o público deve tomar no fim? (CTA)
- Existe material bruto? Onde está?
- Tem identidade visual/guia de marca?

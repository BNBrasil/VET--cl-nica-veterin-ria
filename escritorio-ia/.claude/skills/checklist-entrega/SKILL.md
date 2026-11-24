---
name: checklist-entrega
description: Use no fim de um pedido, antes de entregar ao cliente - confere se todos os entregáveis do briefing existem, passaram pelo revisor e estão nomeados e organizados, e monta a mensagem final de entrega.
---

# Checklist de entrega (orquestrador)

Rode este checklist **depois** do veredito do revisor e **antes** de responder ao cliente.

## Checklist
- [ ] Todo entregável listado no `briefing.md` existe (confira com `Glob entregas/<projeto>/**`).
- [ ] Revisor devolveu **APROVADO** para a versão final (não para uma versão anterior).
- [ ] Nomes seguem o padrão `<slug>_<formato>_v<NN>.<ext>` (vídeo: ver `padrao-export`).
- [ ] Vídeo: existe 9:16 **e** 16:9 (se pedido), `.srt`, thumbnail, `cortes.md`.
- [ ] Bruto original intacto (o editor informou o caminho).
- [ ] Texto: legenda do post, CTA e hashtags conferidos pelo revisor.
- [ ] Código: testes rodaram verdes; instrução de como rodar presente.
- [ ] Design: tamanhos certos, fonte SVG/HTML + instrução de export.
- [ ] Suposições feitas estão listadas para o cliente.
- [ ] Nenhum `[CONFIRMAR]` sobrando sem estar listado como pendência.

Comandos úteis (o orquestrador não tem Bash; use Grep/Glob):
- `Glob` → `entregas/<projeto>/**/*`
- `Grep` → padrão `\[CONFIRMAR\]` em `entregas/<projeto>`

## Mensagem final
```
## Entrega: <título>
Resumo: <o que foi feito em 1–3 linhas>
Arquivos:
- entregas/<projeto>/video/<slug>_9x16_v01.mp4 — reels final
- ...
Revisão: APROVADO
Suposições: ...
Pendências: nenhuma | <lista>
```

## Se algo falhar
- Faltou arquivo → volte à sala dona com o item exato.
- Revisor reprovou 2x o mesmo item → entregue o resto e explique a pendência ao cliente.

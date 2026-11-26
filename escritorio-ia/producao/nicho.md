# Guia do nicho: notícias gamer em vídeo vertical (TikTok e Reels)

Guia de referência do canal gamer (lançamentos, promoções, GTA). Quem usa: pesquisador (escolher a
pauta), roteirista (gancho, ritmo, falas), editor-video (cortes, legenda), social-media (legenda do
post, hashtags, horários) e revisor (o que evitar).

> **Como ler este guia.** Os números de duração, horários e retenção vêm de blogs de marketing e de
> declarações públicas das plataformas, não de um manual oficial único. Trate como **recomendação
> geral / ponto de partida** e ajuste pelos dados da própria conta (TikTok Analytics e Instagram
> Insights) depois de 2–4 semanas. O que vem de regra oficial da plataforma está marcado **[regra]**.

## 1. Formato e duração
| Item | Recomendação |
|---|---|
| Formato | 9:16, 1080x1920, 30 fps, texto dentro da área segura (evite 250 px do topo e ~400 px de baixo, onde ficam botões e legenda do app) |
| Duração | **20–40 s** para notícia única; **35–55 s** para top 5/lista; nunca passar de 60 s (limite do contrato do `montar.js`) |
| Fala | ≈ 2,5 palavras/s → 30 s ≈ 75 palavras; 45 s ≈ 110 palavras |
| Cenas | 4–8 cenas; cada cena = 1 ideia, 3–6 s |
| Áudio | narração clara acima da trilha (trilha ~ -20 dB abaixo da voz), -14 LUFS no final |

Por quê: vídeos curtos têm taxa de conclusão maior; vídeos de 30–60 s rendem mais tempo total de
exibição só quando a retenção se mantém alta. Instagram considera tanto a porcentagem assistida quanto
os segundos absolutos assistidos. Na dúvida, **mais curto**.

## 2. Gancho (0–2 s)
A decisão de continuar ou passar acontece nos 2 primeiros segundos. Regras:
- **Comece pelo resultado/novidade**, nunca por "E aí, galera" ou logo/vinheta.
- Texto grande na tela (≤ 6 palavras) que funcione **sem som**, igual à primeira frase falada.
- Imagem forte já no quadro 1 (capa do jogo, número do desconto gigante, "GRÁTIS").
- Nada de promessa que o vídeo não cumpre (ver seção 8).

Exemplos por formato:
| Formato | Gancho falado | Texto na tela |
|---|---|---|
| Jogo grátis | "Esse jogo de quarenta reais tá de graça agora na Epic." | `GRÁTIS ATÉ 03/12` |
| Promoção | "Red Dead 2 por menos de setenta e cinco reais." | `-75% NA STEAM` |
| Top 5 promoções | "Cinco jogos bons que tão quase de graça nessa Black Friday." | `TOP 5 PROMOÇÕES` |
| Saiu agora | "Acabou de sair e já tá entre os mais vendidos da Steam." | `SAIU AGORA` |
| GTA (confirmado) | "A Rockstar confirmou: ..." | `OFICIAL: <fato>` |
| GTA (rumor) | "Tem um boato rolando sobre GTA 6, e ainda não é confirmado." | `RUMOR ⚠ NÃO CONFIRMADO` |

Mais fórmulas na skill `ganchos-reels`.

## 3. Ritmo, cortes e legenda dinâmica
- Troca visual a cada **1,5–3 s** (corte, zoom lento na capa, entrada de texto, número animado).
  Imagem parada por mais de 3 s derruba retenção.
- **Legenda dinâmica** queimada: 1–3 palavras por vez, destacando a palavra-chave (preço, nome do
  jogo, data) com cor de destaque; fonte grossa sem serifa, contorno/sombra para ler em qualquer fundo.
- Preço sempre como **"de R$ X por R$ Y"** + porcentagem; datas como "até quinta, 03/12".
- Efeitos sonoros curtos (whoosh na transição, "ding" no preço) — **gerados por código** em
  `producao/sons/`, nunca música/efeito de terceiros.
- Final em loop: a última cena pode puxar de volta para o início ("e o primeiro da lista você já viu").

## 4. Chamadas para ação (CTA)
- Uma CTA só, no fim, ≤ 3 s: "Segue pra receber as promoções antes de acabar", "Comenta qual você vai
  pegar", "Manda pra aquele amigo que ainda não pegou".
- "Manda pra um amigo" é boa para Instagram (compartilhamentos pesam na distribuição de Reels).
- **[regra]** Não pedir curtida/seguidor em troca de prêmio, nem "curte que eu libero o link": o TikTok
  trata incentivo falso de engajamento como inelegível para o Para Você.

## 5. Formatos que funcionam no nicho
| Formato | Quando | Estrutura (cenas) | Fonte de dados |
|---|---|---|---|
| **Jogo grátis** | toda quinta (Epic troca às 13h de Brasília) e quando surgir um | gancho → jogo + capa → até quando → como resgatar → CTA | `gratis` do fontes.js (Epic, oficial) |
| **Top 5 promoções** | 2–3x por semana; Black Friday/Steam Sale todo dia | gancho → lista 5 itens (de/por/-%) → "corre que acaba dia X" → CTA | `promocoes` (Steam, oficial) |
| **Promoção única forte** | desconto ≥ 70% em jogo grande | gancho com preço → por que vale → até quando → CTA | `promocoes` |
| **Saiu agora / lançamento** | dia do lançamento | gancho → o que é (1 frase) → preço/plataformas → nota/curiosidade com fonte → CTA | `lancamentos` + notícia oficial |
| **GTA: o que sabemos / novidades** | quando houver fato novo oficial | gancho → fato confirmado → contexto → o que ainda é rumor (rotulado) → CTA | notícias `temas: gta`, conferidas em 2 fontes |
| **Rumor rotulado** | só quando muito comentado | gancho com "boato" → o que se diz + quem disse → "não confirmado" → CTA | sempre crítico (aprovação manual) |

Varie o formato ao longo da semana; nunca o mesmo template com o mesmo texto em vários vídeos.

## 6. Horários e frequência (recomendação geral, horário de Brasília)
- Comece com **1–2 vídeos por dia**, mesmo horário todo dia (ex.: **12:00** e **19:00**), e meça.
  Pesquisas de mercado apontam janelas diferentes (manhã cedo, almoço, 18h–22h); não há horário
  universal. Depois de 2–4 semanas, use o horário em que **seus** seguidores estão ativos.
- Jogo grátis da Epic: postar logo após a troca (quinta à tarde).
- Promoção com prazo: postar com pelo menos 24 h de antecedência do fim (menos de 6 h é crítico pelo
  contrato).
- Qualidade > quantidade: 1 vídeo bom por dia vale mais que 5 repetidos (ver seção 8).

## 7. Hashtags por tema
**[regra]** Use **3–5 hashtags** por post (TikTok e Instagram passaram a limitar a 5). Misture 1–2
amplas + 2–3 específicas do assunto. Escreva sem acento.

| Tema | Amplas | Específicas (escolha 2–3) |
|---|---|---|
| Promoções | `#gamer` `#jogos` | `#promocao` `#steam` `#jogosbaratos` `#blackfriday` `#steamsale` `#<nomedojogo>` |
| Jogo grátis | `#gamer` `#jogosgratis` | `#epicgames` `#jogogratis` `#pcgamer` `#<nomedojogo>` |
| Lançamentos | `#gamer` `#jogos` | `#lancamento` `#novidadesgamer` `#ps5` `#xbox` `#nintendoswitch` `#<nomedojogo>` |
| GTA | `#gamer` `#gta6` | `#gtavi` `#rockstargames` `#gta` `#noticiasgamer` |

Legenda do post: 1ª linha = gancho (aparece antes do "mais"), 2ª = o fato com data/preço, 3ª = fonte
("Fonte: Steam / Rockstar Newswire"), depois CTA e hashtags. TikTok: até ~150 caracteres antes das
hashtags funcionam melhor; Instagram aceita mais texto, mas a primeira linha decide.

## 8. O que EVITAR
1. **Clickbait falso**: gancho que promete o que o vídeo não entrega ("GTA 6 GRÁTIS!" quando é sorteio
   ou boato). Queima retenção e confiança e pode ser tratado como enganoso.
2. **Boato como fato**: rumor/vazamento só com o rótulo "RUMOR / NÃO CONFIRMADO" na tela e na fala, com
   quem disse. Pelo contrato, todo rumor vai para aprovação manual (crítico).
3. **Gameplay, trailer, música e imagens com direitos**: não use trailer, gameplay de terceiros, música
   comercial nem foto de matéria de site de notícia (`imagemUsoLivre: false` no fontes.json). Use capa
   da loja (Steam/Epic, para divulgar o próprio produto), kit de imprensa oficial com crédito, ou fundo
   gerado. Sempre preencher `credito` na cena com imagem.
4. **Conteúdo repetitivo em massa**: **[regra]** o TikTok deixa fora do Para Você conteúdo não
   original/reproduzido sem mudança criativa, e repetir isso pode tirar a **conta inteira** das
   recomendações; o Instagram diz priorizar conteúdo original e reduzir contas agregadoras. Varie
   gancho, formato, ordem das cenas e texto; não poste o mesmo vídeo com outro título.
5. **Marca d'água de outra plataforma** (logo do TikTok no Reels e vice-versa): exporte limpo do
   `montar.js` para as duas redes.
6. **Preço desatualizado**: confira o preço na loja no dia; diga "até <data>"; promoção que acaba em
   menos de 6 h vai para aprovação manual.
7. **Rótulo de IA**: a narração é voz sintética (Piper) e a arte pode ser gerada. **[regra]** O TikTok
   pede rótulo em conteúdo de IA realista que possa passar por real; voz sintética narrando notícia
   com imagens oficiais em geral não engana ninguém, mas, se usar rosto/voz que pareça pessoa real,
   rotule. Nunca imite voz de pessoa real.
8. **Assunto sensível ou ataque a pessoas/empresas**: mortes, crimes reais, política, polêmica com
   pessoa real — fica fora ou vai para aprovação (crítico, regras 3 e 6 do contrato).

## 9. Checklist rápido do vídeo do nicho
- [ ] Gancho em ≤ 2 s, texto ≤ 6 palavras, sem vinheta antes
- [ ] 20–55 s, troca visual a cada ≤ 3 s, legenda dinâmica
- [ ] Preço "de/por/-%" e data de fim corretos e da própria loja
- [ ] Fato com fonte oficial ou 2 fontes; rumor rotulado
- [ ] Imagens só da loja/kit de imprensa/geradas, com `credito`
- [ ] 1 CTA, 3–5 hashtags, fonte citada na legenda

## Fontes consultadas (nov/2026)
- TikTok — Community Guidelines, Integrity and Authenticity (conteúdo não original inelegível ao Para Você, incentivo falso de engajamento): https://www.tiktok.com/community-guidelines/en/integrity-authenticity/
- TikTok — About AI-generated content: https://support.tiktok.com/en/using-tiktok/creating-videos/ai-generated-content
- TikTok Transparency — Supporting responsible, transparent AI-generated content: https://www.tiktok.com/transparency/en/supporting-responsible-transparent-ai-generated-content/
- TechCrunch — mudanças nas diretrizes do TikTok (2025): https://techcrunch.com/2025/08/15/tiktoks-new-guidelines-add-subtle-changes-for-live-creators-ai-content-and-more/
- Instagram Creators — Helping creators of all sizes break through: https://creators.instagram.com/blog/helping-creators-of-all-sizes-break-through
- Buffer — Instagram Reels (originalidade, Mosseri): https://buffer.com/resources/instagram-reels-instructions-and-ideas-for-small-businesses/
- Inman — Head of Instagram (3 primeiros segundos, tempo assistido): https://www.inman.com/2025/03/07/head-of-instagram-reveals-secrets-to-social-media-success/
- Social Media Today — dicas de Reels do Instagram: https://www.socialmediatoday.com/trendline/everything-you-need-to-know-about-instagram-reels/274/
- Hootsuite — TikTok tips e Instagram Reels: https://blog.hootsuite.com/tiktok-tips · https://blog.hootsuite.com/instagram-reels/
- OpusClip — duração e retenção no TikTok (estimativas de fornecedor): https://www.opus.pro/blog/tiktok-length-format-retention-data
- Streamer.guide — crescimento em TikTok/Shorts para criadores de games: https://streamer.guide/guides/tiktok-youtube-shorts-growth
- Eklipse — algoritmo do TikTok para criadores de games: https://blog.eklipse.gg/beginner-guide-2/tiktok-algorithm-gaming-creators.html
- Planoly — limite de 5 hashtags no TikTok: https://www.planoly.com/blog/tiktok-5-hashtag-limit
- Metricool — quantas hashtags por rede (2026): https://metricool.com/how-many-hashtags-to-use/
- Reportei / Sprout Social (pt-BR) / Shopify — melhores horários (sem horário universal): https://reportei.com/melhores-horarios-para-postar/ · https://sproutsocial.com/insights/best-times-to-post-on-social-media-pt_br/ · https://www.shopify.com/pt/blog/melhor-hora-para-postar-no-tiktok

Observação: os horários de troca da Epic e dados de preço vêm do próprio `fontes.js` (API da loja) no
dia; confira sempre no JSON gerado em vez de confiar neste guia.

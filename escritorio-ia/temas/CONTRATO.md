# Temas e personalização do escritório

O usuário quer mudar o **formato das salas**, o **tema** (com temas prontos e paletas diferentes) e os
**personagens**. A arte continua 100% gerada por código (art/), então um tema é só configuração.

## Arquivos
| Caminho | O que é |
|---|---|
| `temas/<id>.json` | temas prontos (versionados): `padrao`, `neon`, `pastel`, `noturno`, `natureza`, `retro` |
| `data/aparencia.json` | escolha do usuário (no .gitignore): tema ativo + ajustes por sala e por personagem |
| `art/tema.js` | lê tema + ajustes e entrega ao gerador (frente ARTE) |
| `public/assets/` | saída do gerador (como hoje) + `tema.json` com o tema aplicado |
| `server/aparencia.js` + Configurar → Aparência | interface (frente INTERFACE) |

## `temas/<id>.json`
```json
{
  "id": "neon", "nome": "Neon", "descricao": "Escritório noturno com luzes neon",
  "paleta": { "base": ["#0b0a14", "..."], "pele": ["..."], "cabelo": ["..."] },
  "salas": {
    "*":            { "piso": "carpete", "parede": "lisa", "corPiso": "#...", "corParede": "#...", "iluminacao": "noite" },
    "editor-video": { "destaque": "#b040ff", "piso": "concreto" }
  },
  "mapa": { "formato": "duas-fileiras", "tamanhoSala": "media" },
  "interface": { "fundo": "#0f0d16", "painel": "#211d30", "destaque": "#e0a030" }
}
```
- `piso`: madeira | carpete | azulejo | concreto | xadrez | grama. `parede`: lisa | tijolo | painel | papel |
  vidro. `iluminacao`: dia | tarde | noite (tinta global + luzes acesas).
- `mapa.formato`: `duas-fileiras` (atual), `uma-fileira` (corredor reto, salas lado a lado), `L` (duas alas),
  `andares` (2 andares empilhados com escada). `tamanhoSala`: pequena | media | grande (tiles por sala).
- Paleta fechada (≤ 64 cores) por tema; o validador confere.
- Cores da interface (CSS) também mudam com o tema.

## `data/aparencia.json` (ajustes do usuário, por cima do tema)
```json
{
  "tema": "neon",
  "salas": { "roteirista": { "destaque": "#ffcc00", "piso": "madeira", "parede": "tijolo" } },
  "personagens": { "roteirista": { "pele": 2, "cabelo": "longo", "corCabelo": "#c0402a",
                                   "roupa": "#3060c0", "acessorio": "oculos" } },
  "mapa": { "formato": "L", "tamanhoSala": "grande" }
}
```
- Personagem: `pele` (índice da paleta de pele), `cabelo` (curto | longo | coque | careca | bone | gorro |
  cacheado | moicano), `corCabelo`, `roupa`, `calca`, `acessorio` (nenhum | oculos | fone | bone | chapeu |
  bigode | barba | lapis). Os padrões continuam os atuais de cada cargo.
- Aplicar = `node art/generate.js` (lê `data/aparencia.json`) → `public/assets/*` → a página recarrega os
  sprites sem recarregar a página (mensagem WebSocket `{type:'aparencia', versao}`).
- O manifest v2 continua igual (o front não muda por causa do formato do mapa: seat, poly, paths, door
  vêm do gerador).

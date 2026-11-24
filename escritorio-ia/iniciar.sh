#!/usr/bin/env bash
# Escritorio de IA - iniciar.sh (macOS / Linux). Equivalente ao INICIAR.bat.
set -e
cd "$(dirname "$0")"
PORT="${ESCRITORIO_PORT:-4317}"; URL="http://127.0.0.1:$PORT/"
export PATH="$HOME/.local/bin:$PATH"
open_url() { (command -v open >/dev/null && open "$1") || (command -v xdg-open >/dev/null && xdg-open "$1") || echo "Abra $1"; }
if curl -fsS -m 2 "${URL}state" >/dev/null 2>&1; then open_url "$URL"; exit 0; fi
command -v node >/dev/null || { echo "Instale o Node.js LTS (https://nodejs.org) e rode de novo."; exit 1; }
if ! command -v claude >/dev/null; then
  echo "Instalando o Claude Code..."
  curl -fsSL https://claude.ai/install.sh | bash || npm install -g @anthropic-ai/claude-code || echo "Instale pela pagina: Configurar > Instalar."
fi
[ -f node_modules/ws/package.json ] || npm install --no-audit --no-fund
mkdir -p data
nohup node server/index.js > data/servidor.log 2> data/servidor-erros.log &
for i in $(seq 1 20); do curl -fsS -m 1 "${URL}state" >/dev/null 2>&1 && break; sleep 1; done
echo "Pronto: $URL"; open_url "$URL"

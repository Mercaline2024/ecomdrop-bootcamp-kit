#!/usr/bin/env bash
# Versión de prueba de nueva-tienda.sh: misma interfaz (<ruta> [slug]) y misma estructura de salida.
set -euo pipefail
DEST="${1:?uso: nueva-tienda.sh <ruta> [slug]}"; SLUG="${2:-$(basename "$DEST")}"
SIE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
mkdir -p "$DEST" && cd "$DEST"
[ -d .git ] || git init -q -b main
[ -d sie ] || git -c protocol.file.allow=always submodule add -q "$SIE_ROOT" sie
mkdir -p .claude/skills productos assets/marca
for s in sie/skills/*/; do n="$(basename "$s")"; ln -sfn "../../sie/skills/$n" ".claude/skills/$n"; done
python3 -c "import json,sys; t=json.load(open('sie/tienda.ejemplo.json')); t['tienda']['slug']=sys.argv[1]; json.dump(t,open('tienda.json','w'),indent=2)" "$SLUG"
[ -f CLAUDE.md ] || sed "s/{{MARCA}}/$SLUG/g" sie/plantillas/tienda/CLAUDE.md > CLAUDE.md
[ -f .gitignore ] || cp sie/plantillas/tienda/gitignore .gitignore
[ -f .env.example ] || cp sie/.env.example .env.example
echo "Tienda $SLUG creada en $DEST"

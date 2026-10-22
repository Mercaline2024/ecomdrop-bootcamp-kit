#!/usr/bin/env bash
# Exporta una copia limpia del SIE (Super Inteligencia Ecommerce) a sie/ dentro del kit.
#
#   bash scripts/exportar-sie.sh [ruta-al-SIE] [--publicar]
#   (por defecto: ~/projects/super-inteligencia-ecommerce; --publicar sube dist/sie.tar.gz como release privado)
#
# Qué hace:
#   1. toma SOLO lo versionado en git (git archive HEAD): sin .env, node_modules, referencias/ ni cachés
#   2. quita lo que no va al bootcamp (EXCLUIR)
#   3. sustituye datos de clientes por placeholders (SUSTITUIR)
#   4. deja en sie/.export.json de qué commit sale la copia
# Vuelve a correrlo cada vez que cambie el SIE; sie/ se regenera entero.
set -euo pipefail

SIE_SRC="$HOME/projects/super-inteligencia-ecommerce"
[ -n "${1:-}" ] && [ "$1" != "--publicar" ] && SIE_SRC="$1"
KIT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
DEST="$KIT_ROOT/sie"

# Rutas (relativas al SIE) que no se entregan a los estudiantes
EXCLUIR=(
  "skills/marca-a-shopify"
  ".claude/skills/marca-a-shopify"
  "referencias"
)

rojo(){ printf "\033[31m%s\033[0m\n" "$*"; }
verde(){ printf "\033[32m%s\033[0m\n" "$*"; }

[ -d "$SIE_SRC/.git" ] || { rojo "No encuentro el repo del SIE en $SIE_SRC"; exit 1; }
if [ -n "$(git -C "$SIE_SRC" status --porcelain)" ]; then
  rojo "El SIE tiene cambios sin commit; se exporta solo lo que está en HEAD."
fi

TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
git -C "$SIE_SRC" archive --format=tar HEAD | tar -x -C "$TMP"
for p in "${EXCLUIR[@]}"; do rm -rf "${TMP:?}/$p"; done

# --- datos de clientes -> placeholders ---
TPL="$TMP/temas/thema-ecomdro2.5/templates/product.base-v2.json"
if [ -f "$TPL" ]; then
  python3 - "$TPL" <<'PY'
import sys, re
p = sys.argv[1]; s = open(p, encoding="utf-8").read()
s = re.sub(r'gid://shopify/Product/[1-9][0-9]{6,}', 'gid://shopify/Product/000000000000', s)
s = s.replace('guia-de-drenaje-linfatico-facial-en-casa-el-metodo-de-90-segundos', 'handle-del-regalo')
open(p, "w", encoding="utf-8").write(s)
PY
fi

# --- crédito de autor unificado: @elkingarcia.ia (Instagram y redes) ---
CREDITO="@elkingarcia.ia"
find "$TMP/temas" -type f \( -name '*.txt' -o -name '*.liquid' -o -name '*.json' -o -name '*.md' \) -print0 |
  CREDITO="$CREDITO" xargs -0 perl -pi -e 's{instagram\.com/elkingarc[a-z_.]*}{"instagram.com/".substr($ENV{CREDITO},1)}gie; s{\@Elkingarc(?:ia_digital|_ia)\b}{$ENV{CREDITO}}gi'

# --- quitar las menciones a las skills excluidas en README y CLAUDE.md ---
for f in README.md CLAUDE.md; do
  [ -f "$TMP/$f" ] && grep -v 'marca-a-shopify' "$TMP/$f" > "$TMP/$f.tmp" && mv "$TMP/$f.tmp" "$TMP/$f"
done

rm -rf "$DEST"; mkdir -p "$DEST"
rsync -a "$TMP/" "$DEST/"
cat > "$DEST/.export.json" <<JSON
{
  "fuente": "super-inteligencia-ecommerce",
  "commit": "$(git -C "$SIE_SRC" rev-parse HEAD)",
  "exportado": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "excluido": [$(printf '"%s",' "${EXCLUIR[@]}" | sed 's/,$//')]
}
JSON
verde "SIE exportado a $DEST ($(find "$DEST" -type f | wc -l | tr -d ' ') archivos)"

# --- paquete para los estudiantes: dist/sie.tar.gz (+ sha256) ---
mkdir -p "$KIT_ROOT/dist"
tar -czf "$KIT_ROOT/dist/sie.tar.gz" -C "$KIT_ROOT" sie
( cd "$KIT_ROOT/dist" && { shasum -a 256 sie.tar.gz 2>/dev/null || sha256sum sie.tar.gz; } > sie.tar.gz.sha256 )
verde "Paquete: dist/sie.tar.gz"

# --- publicar (solo con --publicar): release en el repo PRIVADO de distribución ---
#   Los estudiantes con acceso de lectura a ese repo (equipo de GitHub del bootcamp) lo descargan con
#   `gh release download`. Quitar a alguien del equipo le corta el acceso a las actualizaciones.
if [ "${2:-}" = "--publicar" ] || [ "${1:-}" = "--publicar" ]; then
  REPO="${ECOMDROP_SIE_REPO:-Mercaline2024/ecomdrop-sie-dist}"
  TAG="sie-$(git -C "$SIE_SRC" rev-parse --short HEAD)"
  gh release view "$TAG" -R "$REPO" >/dev/null 2>&1 && { rojo "El release $TAG ya existe en $REPO"; exit 1; }
  gh release create "$TAG" -R "$REPO" --latest --title "$TAG" --notes "SIE exportado del commit $(git -C "$SIE_SRC" rev-parse HEAD)" \
    "$KIT_ROOT/dist/sie.tar.gz" "$KIT_ROOT/dist/sie.tar.gz.sha256"
  verde "Publicado $TAG en $REPO"
fi

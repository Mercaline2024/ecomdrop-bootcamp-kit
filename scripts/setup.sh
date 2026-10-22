#!/usr/bin/env bash
# Ecomdrop Bootcamp Kit — instalador para macOS y Linux (Debian/Ubuntu).
#
#   curl -fsSL https://raw.githubusercontent.com/Mercaline2024/ecomdrop-bootcamp-kit/main/scripts/setup.sh | bash
#
# Modos:
#   (por defecto)     MÍNIMO: lo que necesita permisos de administrador + Node + Claude Code + la configuración del
#                     kit. Luego abre Claude: el estudiante escribe /ecomdrop-bootcamp:instalar y Claude instala el
#                     resto con los mismos pasos (ecomdrop-paso <id>), resolviendo lo particular de cada equipo.
#   --completo        todo en la terminal, sin Claude ni navegador (CI o quien lo prefiera). Alias: --sin-asistente
#   --asistente       todo desde el asistente web con Chriss
#   --paso <id>       un solo paso: base node deps python gh claude media modelo shopify acceso sie playwright
#                     config doctor limpieza
#
# Variables útiles:
#   ECOMDROP_KIT_URL       tarball del kit (por defecto, la rama main en GitHub)
#   ECOMDROP_SIE_REPO      repo privado con los releases del SIE (por defecto ecomdrop-bootcamp/ecomdrop-sie-dist)
#   ECOMDROP_SIE_TARBALL   ruta a un sie.tar.gz local (sin descargar; útil sin internet o en CI)
#   ECOMDROP_SALTAR_MODELO=1  no descarga el modelo de whisper (1,6 GB)
#   GH_TOKEN               token de GitHub (CI); si no está, se inicia sesión con el navegador
#
# Es idempotente: lo que ya está instalado se salta. Log en ~/.ecomdrop/logs/.
set -Eeuo pipefail

# ───────────────────────── configuración ─────────────────────────
ECOMDROP_HOME="${ECOMDROP_HOME:-$HOME/.ecomdrop}"
PROYECTOS="${ECOMDROP_PROYECTOS:-$HOME/proyectos}"
SIE_DIR="$PROYECTOS/super-inteligencia-ecommerce"
KIT_URL="${ECOMDROP_KIT_URL:-https://github.com/Mercaline2024/ecomdrop-bootcamp-kit/archive/refs/heads/main.tar.gz}"
SIE_REPO="${ECOMDROP_SIE_REPO:-ecomdrop-bootcamp/ecomdrop-sie-dist}"
MODELO_URL="https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo.bin"
MODELO="${WHISPER_MODEL:-$HOME/whisper-models/ggml-large-v3-turbo.bin}"
LOCAL_BIN="$HOME/.local/bin"

PASO=""; MODO="${ECOMDROP_MODO:-minimo}"
while [ $# -gt 0 ]; do
  case "$1" in
    --paso) PASO="${2:-}"; shift 2 ;;
    --completo|--sin-asistente) MODO=completo; shift ;;
    --asistente) MODO=asistente; shift ;;
    -h|--help) sed -n '2,20p' "$0"; exit 0 ;;
    *) echo "Opción desconocida: $1"; exit 2 ;;
  esac
done
[ -n "${CI:-}" ] && MODO=completo

# ───────────────────────── salida y log ─────────────────────────
mkdir -p "$ECOMDROP_HOME/logs"
LOG="$ECOMDROP_HOME/logs/setup-$(date +%Y%m%d-%H%M%S)${PASO:+-$PASO}.log"
exec > >(tee -a "$LOG") 2>&1

if [ -t 1 ] && [ -z "${NO_COLOR:-}" ]; then
  C_AZUL=$'\033[34m'; C_VERDE=$'\033[32m'; C_AMARILLO=$'\033[33m'; C_ROJO=$'\033[31m'; C_NEGRITA=$'\033[1m'; C_FIN=$'\033[0m'
else C_AZUL=""; C_VERDE=""; C_AMARILLO=""; C_ROJO=""; C_NEGRITA=""; C_FIN=""; fi

titulo(){ printf "\n%s━━ %s%s\n" "$C_AZUL$C_NEGRITA" "$*" "$C_FIN"; }
info(){   printf "  %s→%s %s\n" "$C_AZUL" "$C_FIN" "$*"; }
ok(){     printf "  %s✔%s %s\n" "$C_VERDE" "$C_FIN" "$*"; }
aviso(){  printf "  %s!%s %s\n" "$C_AMARILLO" "$C_FIN" "$*"; }
fallo(){
  printf "\n  %s✖ %s%s\n" "$C_ROJO$C_NEGRITA" "$*" "$C_FIN"
  printf "  Log completo: %s\n  Si no sabes cómo seguir, envía ese archivo a soporte del bootcamp.\n\n" "$LOG"
  exit 1
}
trap 'fallo "Error inesperado en la línea $LINENO (comando: $BASH_COMMAND)."' ERR
tiene(){ command -v "$1" >/dev/null 2>&1; }
sha256(){ if tiene shasum; then shasum -a 256; else sha256sum; fi; }

OS="$(uname -s)"; ARCH="$(uname -m)"
case "$OS" in
  Darwin) PLATAFORMA=mac ;;
  Linux)  PLATAFORMA=linux
          tiene apt-get || fallo "Este instalador soporta Linux con apt (Debian/Ubuntu). Tu distribución no tiene apt-get." ;;
  *)      fallo "Sistema no soportado: $OS. En Windows usa setup.ps1 (PowerShell)." ;;
esac

# ───────────────────────── PATH de la sesión ─────────────────────────
cargar_entorno(){
  export PATH="$LOCAL_BIN:$PATH"
  for b in /opt/homebrew/bin/brew /usr/local/bin/brew /home/linuxbrew/.linuxbrew/bin/brew; do
    [ -x "$b" ] && eval "$("$b" shellenv)" && break
  done
  [ -d "$HOME/.fnm" ] && export PATH="$HOME/.fnm:$PATH"
  if tiene fnm; then eval "$(fnm env --shell bash)"; fnm use --silent-if-unchanged lts-latest >/dev/null 2>&1 || true; fi
  # claves del kit (APIFY_TOKEN, KIE_API_KEY…), sin exportarlas a otros procesos que no las necesitan
  if [ -f "$ECOMDROP_HOME/.env" ]; then set -a; . "$ECOMDROP_HOME/.env"; set +a; fi
  return 0
}

# Añade una línea al perfil del shell una sola vez (bash y zsh).
al_perfil(){
  local linea="$1" marca="# ecomdrop-bootcamp"
  for rc in "$HOME/.zshrc" "$HOME/.bashrc"; do
    [ "$PLATAFORMA" = linux ] && [ "$rc" = "$HOME/.zshrc" ] && [ ! -f "$rc" ] && continue
    touch "$rc"
    grep -Fq "$linea" "$rc" || printf '\n%s\n%s\n' "$marca" "$linea" >> "$rc"
  done
}

# sudo solo cuando hace falta, explicando por qué; se mantiene vivo mientras dura el paso.
pedir_admin(){
  local motivo="$1"
  [ "$(id -u)" -eq 0 ] && { SUDO=""; return; }
  SUDO="sudo"
  if sudo -n true 2>/dev/null; then return; fi
  printf "\n  %sSe necesita tu contraseña de administrador%s\n  Motivo: %s\n  (La contraseña la pide el sistema, no este script; no se guarda.)\n\n" "$C_AMARILLO$C_NEGRITA" "$C_FIN" "$motivo"
  sudo -v < /dev/tty || fallo "Sin permisos de administrador no se puede continuar con: $motivo"
  ( while true; do sudo -n true; sleep 50; kill -0 "$$" 2>/dev/null || exit; done ) >/dev/null 2>&1 &
}

# ───────────────────────── kit ─────────────────────────
# Con «curl | bash» no hay archivos locales: se descarga el kit a ~/.ecomdrop/kit.
ubicar_kit(){
  local aqui=""
  [ -n "${BASH_SOURCE[0]:-}" ] && [ -f "${BASH_SOURCE[0]}" ] && aqui="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
  if [ -n "$aqui" ] && [ -f "$aqui/asistente/servidor.mjs" ]; then KIT="$aqui"; return; fi
  # Con «curl | bash» se baja SIEMPRE la última versión: una copia de un intento anterior puede estar desactualizada.
  KIT="$ECOMDROP_HOME/kit"
  local nuevo="$KIT.nuevo"
  info "Descargando la última versión del kit…"
  rm -rf "$nuevo"; mkdir -p "$nuevo"
  if curl -fsSL "$KIT_URL" | tar --no-same-owner -xz -C "$nuevo" --strip-components=1 && [ -f "$nuevo/asistente/servidor.mjs" ]; then
    rm -rf "$KIT" && mv "$nuevo" "$KIT"
  else
    rm -rf "$nuevo"
    [ -f "$KIT/asistente/servidor.mjs" ] && aviso "No se pudo actualizar el kit; se usa la copia anterior." \
      || fallo "No se pudo descargar el kit desde $KIT_URL. Revisa tu conexión."
  fi
}

# ───────────────────────── pasos ─────────────────────────
paso_base(){
  titulo "Gestor de paquetes y herramientas del sistema"
  if [ "$PLATAFORMA" = mac ]; then
    if tiene brew; then ok "Homebrew $(brew --version | head -1 | awk '{print $2}')"
    else
      pedir_admin "Homebrew (el gestor de paquetes de macOS) crea carpetas del sistema e instala las Command Line Tools de Apple."
      info "Instalando Homebrew (puede tardar varios minutos)…"
      NONINTERACTIVE=1 /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)" \
        || fallo "No se pudo instalar Homebrew. Revisa el log y la conexión."
      cargar_entorno
      local bp; bp="$(command -v brew)"
      for rc in "$HOME/.zprofile" "$HOME/.bash_profile"; do touch "$rc"; grep -Fq "brew shellenv" "$rc" || printf '\neval "$(%s shellenv)"\n' "$bp" >> "$rc"; done
      ok "Homebrew instalado"
    fi
    tiene git && ok "git $(git --version | awk '{print $3}')" || { brew install git; ok "git instalado"; }
  else
    local faltan=() p
    for p in git curl ca-certificates unzip tar xz-utils build-essential cmake ffmpeg imagemagick python3 python3-venv; do
      dpkg -s "$p" >/dev/null 2>&1 || faltan+=("$p")
    done
    if [ ${#faltan[@]} -eq 0 ]; then ok "Paquetes del sistema ya instalados"
    else
      pedir_admin "apt instala paquetes del sistema (${faltan[*]})."
      info "Instalando con apt: ${faltan[*]}"
      $SUDO apt-get update -y
      DEBIAN_FRONTEND=noninteractive $SUDO apt-get install -y "${faltan[@]}" || fallo "apt-get no pudo instalar: ${faltan[*]}"
      ok "Paquetes del sistema instalados"
    fi
    if ! tiene gh; then
      pedir_admin "GitHub CLI se instala desde el repositorio oficial de GitHub para apt."
      info "Instalando GitHub CLI…"
      $SUDO mkdir -p -m 755 /etc/apt/keyrings
      curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | $SUDO tee /etc/apt/keyrings/githubcli-archive-keyring.gpg >/dev/null
      $SUDO chmod go+r /etc/apt/keyrings/githubcli-archive-keyring.gpg
      echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
        | $SUDO tee /etc/apt/sources.list.d/github-cli.list >/dev/null
      $SUDO apt-get update -y && DEBIAN_FRONTEND=noninteractive $SUDO apt-get install -y gh || fallo "No se pudo instalar GitHub CLI con apt."
    fi
    ok "gh $(gh --version | head -1 | awk '{print $3}')"
  fi
}

paso_node(){
  titulo "Node.js LTS (fnm)"
  if ! tiene fnm; then
    info "Instalando fnm en ~/.fnm…"
    # --force-install: en macOS el script usaría brew; así la ruta es la misma en macOS y Linux
    local extra=(); [ "$PLATAFORMA" = mac ] && extra=(--force-install)
    curl -fsSL https://fnm.vercel.app/install | bash -s -- --install-dir "$HOME/.fnm" --skip-shell ${extra[@]+"${extra[@]}"} \
      || fallo "No se pudo instalar fnm."
    cargar_entorno
  fi
  ok "fnm $(fnm --version | awk '{print $2}')"
  al_perfil '[ -d "$HOME/.fnm" ] && export PATH="$HOME/.fnm:$PATH"'
  al_perfil 'command -v fnm >/dev/null && eval "$(fnm env --use-on-cd --shell "$(basename "${SHELL:-bash}")")"'
  info "Asegurando la versión LTS de Node…"
  local i
  for i in 1 2 3; do fnm install --lts && break; aviso "La descarga de Node falló (intento $i/3); reintentando…"; sleep 3; done
  fnm list | grep -q lts-latest || fallo "No se pudo instalar Node LTS con fnm."
  fnm default lts-latest
  eval "$(fnm env --shell bash)"
  fnm use lts-latest >/dev/null
  ok "node $(node --version) · npm $(npm --version)"
}

# Linux: lo que necesita sudo se hace aquí, en la terminal, porque Claude no puede escribir contraseñas.
paso_deps(){
  [ "$PLATAFORMA" = linux ] || return 0
  titulo "Librerías del sistema para el navegador de pruebas"
  pedir_admin "Chromium (validar landings) necesita librerías del sistema que se instalan con apt."
  $SUDO env "PATH=$PATH" npx -y playwright install-deps chromium >/dev/null || fallo "No se pudieron instalar las librerías de Chromium."
  ok "Librerías de Chromium instaladas"
}

paso_python(){
  titulo "Python (uv)"
  if ! tiene uv; then
    info "Instalando uv…"
    curl -LsSf https://astral.sh/uv/install.sh | env UV_NO_MODIFY_PATH=1 sh || fallo "No se pudo instalar uv."
    al_perfil 'export PATH="$HOME/.local/bin:$PATH"'
    cargar_entorno
  fi
  ok "uv $(uv --version | awk '{print $2}')"
  if ! tiene python3 || ! python3 -c 'import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)' 2>/dev/null; then
    info "Instalando Python con uv…"
    uv python install --default || fallo "uv no pudo instalar Python."
    cargar_entorno
  fi
  ok "python3 $(python3 --version | awk '{print $2}') ($(command -v python3))"
  instalar_libs_python
}

instalar_libs_python(){
  local req="$SIE_DIR/requirements.txt" py; py="$(command -v python3)"
  if python3 -c 'import PIL, openpyxl' 2>/dev/null; then ok "Pillow y openpyxl ya instalados"; return; fi
  info "Instalando Pillow y openpyxl para $py…"
  if [ -f "$req" ]; then uv pip install --python "$py" --break-system-packages -r "$req"
  else uv pip install --python "$py" --break-system-packages "Pillow>=10" "openpyxl>=3.1"; fi
  python3 -c 'import PIL, openpyxl' || fallo "Pillow/openpyxl no quedaron importables desde python3."
  ok "Pillow y openpyxl instalados"
}

paso_gh(){
  titulo "GitHub CLI"
  if tiene gh; then ok "gh $(gh --version | head -1 | awk '{print $3}')"; return; fi
  if [ "$PLATAFORMA" = mac ]; then brew install gh || fallo "brew no pudo instalar gh."; else paso_base; fi
  ok "gh $(gh --version | head -1 | awk '{print $3}')"
}

paso_claude(){
  titulo "Claude Code"
  if tiene claude; then ok "Claude Code $(claude --version 2>/dev/null | awk '{print $1}') ya instalado"; return; fi
  info "Instalando Claude Code con el instalador nativo oficial…"
  curl -fsSL https://claude.ai/install.sh | bash || fallo "El instalador de Claude Code falló."
  al_perfil 'export PATH="$HOME/.local/bin:$PATH"'
  cargar_entorno
  tiene claude || fallo "Claude Code se instaló pero no aparece en el PATH ($LOCAL_BIN)."
  ok "Claude Code $(claude --version | awk '{print $1}')"
}

paso_media(){
  titulo "Video, audio e imagen"
  if [ "$PLATAFORMA" = mac ]; then
    local f   # en macOS las imágenes se procesan con sips (viene con el sistema): no hace falta ImageMagick
    for f in ffmpeg whisper-cpp; do
      if brew list --formula "$f" >/dev/null 2>&1; then ok "$f ya instalado"; else info "brew install $f"; brew install "$f"; ok "$f instalado"; fi
    done
  else
    { tiene ffmpeg && { tiene magick || tiene convert; }; } || paso_base
    ok "ffmpeg $(ffmpeg -version | head -1 | awk '{print $3}')"
    if tiene whisper-cli; then ok "whisper-cli ya instalado"
    else
      info "Compilando whisper-cli (whisper.cpp) — tarda unos minutos…"
      local src="$ECOMDROP_HOME/src/whisper.cpp"
      [ -d "$src/.git" ] || git clone --depth 1 https://github.com/ggml-org/whisper.cpp "$src"
      cmake -S "$src" -B "$src/build" -DCMAKE_BUILD_TYPE=Release -DBUILD_SHARED_LIBS=OFF -DWHISPER_BUILD_TESTS=OFF >/dev/null
      cmake --build "$src/build" --config Release -j "$(nproc 2>/dev/null || echo 2)" --target whisper-cli >/dev/null \
        || fallo "No se pudo compilar whisper-cli. Revisa que build-essential y cmake estén instalados."
      mkdir -p "$LOCAL_BIN"; cp "$src/build/bin/whisper-cli" "$LOCAL_BIN/whisper-cli"
      ok "whisper-cli instalado en $LOCAL_BIN"
    fi
  fi
  tiene ffprobe || fallo "ffprobe no está disponible (viene con ffmpeg)."
}

paso_modelo(){
  titulo "Modelo de transcripción (whisper large-v3-turbo)"
  if [ "${ECOMDROP_SALTAR_MODELO:-}" = 1 ]; then aviso "Saltado (ECOMDROP_SALTAR_MODELO=1)"; return; fi
  if [ -f "$MODELO" ] && [ "$(wc -c < "$MODELO")" -gt 1500000000 ]; then ok "Modelo ya descargado ($MODELO)"; return; fi
  local libre; libre=$(df -Pk "$HOME" | awk 'NR==2{print $4}')
  [ "${libre:-0}" -gt 2500000 ] || fallo "Necesitas al menos 2,5 GB libres para el modelo de whisper."
  mkdir -p "$(dirname "$MODELO")"
  info "Descargando ~1,6 GB (si se corta, vuelve a ejecutar este paso: continúa donde quedó)…"
  curl -fL --retry 5 --retry-delay 3 -C - -o "$MODELO.part" "$MODELO_URL" --progress-bar || fallo "La descarga del modelo falló. Vuelve a intentarlo."
  mv "$MODELO.part" "$MODELO"
  ok "Modelo descargado en $MODELO"
}

paso_shopify(){
  titulo "Shopify CLI"
  if tiene shopify; then ok "Shopify CLI $(shopify version 2>/dev/null | tail -1) ya instalado"; return; fi
  tiene npm || paso_node
  info "npm install -g @shopify/cli@latest"
  npm install -g @shopify/cli@latest || fallo "No se pudo instalar Shopify CLI."
  ok "Shopify CLI instalado"
}

paso_acceso(){
  titulo "Acceso al SIE (GitHub)"
  if [ -n "${ECOMDROP_SIE_TARBALL:-}" ]; then ok "Se usará el paquete local $ECOMDROP_SIE_TARBALL"; return; fi
  if ! gh auth status -h github.com >/dev/null 2>&1; then
    [ -n "${GH_TOKEN:-}" ] && fallo "GH_TOKEN está definido pero GitHub lo rechaza."
    info "Inicia sesión en GitHub con tu navegador. Copia el código de 8 caracteres y pégalo en github.com/login/device."
    gh auth login --hostname github.com --git-protocol https --web --skip-ssh-key || fallo "No se completó el inicio de sesión en GitHub."
  fi
  local usuario; usuario="$(gh api user -q .login 2>/dev/null || echo '?')"
  ok "Sesión de GitHub: $usuario"
  gh release view -R "$SIE_REPO" >/dev/null 2>&1 \
    || fallo "Tu cuenta ($usuario) no tiene acceso al SIE. Envía tu usuario de GitHub a soporte del bootcamp para que te inviten."
  ok "Tienes acceso al SIE"
}

paso_sie(){
  titulo "Instalar el SIE"
  local tmp; tmp="$(mktemp -d)"
  local paquete="${ECOMDROP_SIE_TARBALL:-}"
  if [ -z "$paquete" ]; then
    paso_acceso
    info "Descargando la última versión…"
    gh release download -R "$SIE_REPO" --pattern 'sie.tar.gz*' --dir "$tmp" || fallo "No se pudo descargar el SIE."
    ( cd "$tmp" && if tiene shasum; then shasum -a 256 -c sie.tar.gz.sha256; else sha256sum -c sie.tar.gz.sha256; fi ) >/dev/null \
      || fallo "El paquete descargado está dañado (sha256 no coincide). Vuelve a intentarlo."
    paquete="$tmp/sie.tar.gz"
  fi
  [ -f "$paquete" ] || fallo "No encuentro el paquete del SIE: $paquete"
  mkdir -p "$PROYECTOS"
  # --no-same-owner: como root, tar conservaría el dueño original y git rechazaría el repo («dubious ownership»)
  tar --no-same-owner -xzf "$paquete" -C "$tmp"
  # se conservan node_modules y .env de una instalación previa
  if [ -d "$SIE_DIR" ]; then
    [ -d "$SIE_DIR/node_modules" ] && mv "$SIE_DIR/node_modules" "$tmp/sie/" 2>/dev/null || true
    [ -f "$SIE_DIR/.env" ] && cp "$SIE_DIR/.env" "$tmp/sie/.env"
    rm -rf "$SIE_DIR"
  fi
  mv "$tmp/sie" "$SIE_DIR"
  marcar_instalacion
  versionar_sie
  rm -rf "$tmp"
  ok "SIE instalado en $SIE_DIR"
  instalar_libs_python
  info "Dependencias de Node del SIE (Playwright)…"
  ( cd "$SIE_DIR" && PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install --no-audit --no-fund ) || fallo "npm install falló en el SIE."
  ok "Dependencias del SIE instaladas"
}

# Marca de agua: un ID por instalación ligado a la cuenta de GitHub del estudiante.
marcar_instalacion(){
  local usuario id fecha
  usuario="$(gh api user -q .login 2>/dev/null || echo "${USER:-desconocido}")"
  id="$( { date +%s; echo "$usuario$RANDOM$RANDOM$$"; } | sha256 | cut -c1-16 )"
  fecha="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  cat > "$SIE_DIR/.instalacion.json" <<JSON
{ "id": "$id", "github": "$usuario", "fecha": "$fecha", "licencia": "uso personal e intransferible — Ecomdrop Bootcamp" }
JSON
  local f
  while IFS= read -r -d '' f; do
    printf '\n<!-- SIE · licencia de uso personal e intransferible · instalación %s · %s -->\n' "$id" "$usuario" >> "$f"
  done < <(find "$SIE_DIR" \( -name SKILL.md -o -name CLAUDE.md -o -name PLAYBOOK.md \) -print0)
}

# Repo git local SIN remoto: nueva-tienda.sh lo añade como submódulo a cada tienda y
# actualizar-tienda.sh trae de aquí las versiones nuevas que instale el kit.
versionar_sie(){
  ( cd "$SIE_DIR" && git init -q -b main && git add -A \
    && git -c user.name="Ecomdrop Bootcamp" -c user.email="kit@ecomdrop.invalid" commit -qm "SIE $(date +%Y-%m-%d)" ) \
    || fallo "No se pudo preparar el repo local del SIE."
}

paso_playwright(){
  titulo "Navegador de pruebas (Playwright + Chromium)"
  [ -d "$SIE_DIR/node_modules/playwright" ] || fallo "Primero instala el SIE (paso «sie»)."
  if [ "$PLATAFORMA" = linux ]; then
    pedir_admin "Chromium necesita librerías del sistema que se instalan con apt."
    ( cd "$SIE_DIR" && $SUDO env "PATH=$PATH" npx playwright install-deps chromium ) || fallo "No se pudieron instalar las librerías de Chromium."
  fi
  ( cd "$SIE_DIR" && npx playwright install chromium ) || fallo "No se pudo descargar Chromium para Playwright."
  ok "Chromium listo"
}

paso_config(){
  titulo "Configurar Claude Code"
  tiene claude || paso_claude
  tiene node || paso_node
  mkdir -p "$HOME/.claude"
  node "$KIT/scripts/configurar-claude.mjs" --kit "$KIT" --sie "$SIE_DIR" --env "$ECOMDROP_HOME/.env" \
    || fallo "No se pudo configurar Claude Code."
  # el doctor queda instalado fuera del kit para que siga disponible tras la limpieza
  if [ -d "$KIT/doctor" ]; then
    rm -rf "$ECOMDROP_HOME/doctor"; cp -R "$KIT/doctor" "$ECOMDROP_HOME/doctor"
    mkdir -p "$LOCAL_BIN"
    printf '#!/usr/bin/env bash\nexec node "%s/doctor/bin/ecomdrop-doctor.mjs" "$@"\n' "$ECOMDROP_HOME" > "$LOCAL_BIN/ecomdrop-doctor"
    chmod +x "$LOCAL_BIN/ecomdrop-doctor"
    ok "Comando ecomdrop-doctor disponible"
  fi
  # comandos que usa Claude (skill /ecomdrop-bootcamp:instalar) para ejecutar los pasos probados del kit
  printf '#!/usr/bin/env bash\n# Ejecuta un paso del instalador del kit: ecomdrop-paso <id>\nexec bash "%s/scripts/setup.sh" --paso "$@"\n' "$KIT" > "$LOCAL_BIN/ecomdrop-paso"
  printf '#!/usr/bin/env bash\n# Abre el asistente web (claves, conectores, tienda): ecomdrop-asistente [--seccion claves]\nexec node "%s/asistente/servidor.mjs" "$@"\n' "$KIT" > "$LOCAL_BIN/ecomdrop-asistente"
  chmod +x "$LOCAL_BIN/ecomdrop-paso" "$LOCAL_BIN/ecomdrop-asistente"
  ok "Comandos ecomdrop-paso y ecomdrop-asistente disponibles"
}

paso_doctor(){
  titulo "Revisión final"
  # el doctor devuelve 1 si encuentra problemas: se muestran, pero no detienen el instalador
  local d=""
  if tiene ecomdrop-doctor; then d="$(command -v ecomdrop-doctor)"
  elif [ -f "$KIT/doctor/bin/ecomdrop-doctor.mjs" ]; then d="node $KIT/doctor/bin/ecomdrop-doctor.mjs"; fi
  if [ -n "$d" ]; then $d --sistema || aviso "La revisión encontró cosas por resolver (arriba). Usa «ecomdrop-doctor --sistema --fix» o la skill /setup-proyecto."
  elif [ -f "$SIE_DIR/bin/doctor.sh" ]; then bash "$SIE_DIR/bin/doctor.sh"
  else aviso "No hay doctor instalado todavía."; fi
}

# Borra lo que dejó el instalador. Conserva: el SIE, las tiendas, ~/.ecomdrop/.env, ~/.claude y el doctor.
paso_limpieza(){
  titulo "Limpieza del instalador"
  # el kit se conserva: lo usan ecomdrop-paso y ecomdrop-asistente (y su código ya es público)
  rm -rf "$ECOMDROP_HOME/src" "$ECOMDROP_HOME/tmp"
  find "$ECOMDROP_HOME/logs" -type f ! -name "$(basename "$LOG")" -delete 2>/dev/null || true
  ok "Descargas temporales y logs anteriores borrados"
  # el log de esta limpieza se borra al salir
  trap 'rm -f "$LOG"' EXIT
}

# ───────────────────────── principal ─────────────────────────
cargar_entorno
ubicar_kit

if [ -n "$PASO" ]; then
  declare -F "paso_$PASO" >/dev/null || fallo "Paso desconocido: $PASO"
  "paso_$PASO"
  exit 0
fi

printf "\n%sEcomdrop Bootcamp · Instalador%s  (%s %s · modo %s)\n" "$C_NEGRITA" "$C_FIN" "$OS" "$ARCH" "$MODO"
printf "Log: %s\n" "$LOG"
paso_base
paso_node

if [ "$MODO" = asistente ] && [ -e /dev/tty ]; then
  titulo "Asistente de instalación"
  info "Se abrirá tu navegador. Sigue las pestañas en orden; esta ventana debe quedar abierta."
  exec node "$KIT/asistente/servidor.mjs"
fi

if [ "$MODO" = minimo ]; then
  paso_deps
  paso_claude
  paso_config
  printf "\n%s✔ Listo lo básico.%s Ahora Claude instala el resto contigo:\n\n" "$C_VERDE$C_NEGRITA" "$C_FIN"
  printf "   1. Inicia sesión con tu cuenta de claude.ai (Pro o Max) cuando Claude lo pida.\n"
  printf "   2. Escribe:  %s/ecomdrop-bootcamp:instalar%s\n\n" "$C_NEGRITA" "$C_FIN"
  printf "   Si cierras esta ventana: abre una terminal nueva, escribe  claude  y sigue desde el paso 2.\n\n"
  if [ -e /dev/tty ] && [ -z "${CI:-}" ]; then
    cd "$HOME"
    exec claude </dev/tty >/dev/tty 2>&1
  fi
  exit 0
fi

for p in python gh claude media modelo shopify sie playwright config doctor; do
  if [ "$p" = sie ] && [ -z "${ECOMDROP_SIE_TARBALL:-}" ] && [ -z "${GH_TOKEN:-}" ] && ! gh auth status >/dev/null 2>&1; then
    aviso "Sin sesión de GitHub ni ECOMDROP_SIE_TARBALL: se salta la instalación del SIE."; continue
  fi
  [ "$p" = playwright ] && [ ! -d "$SIE_DIR/node_modules/playwright" ] && { aviso "El SIE instalado no usa Playwright: se salta."; continue; }
  "paso_$p"
done
printf "\n%s✔ Instalación terminada.%s Abre una terminal nueva para que se carguen node, uv y claude.\n" "$C_VERDE$C_NEGRITA" "$C_FIN"

# Permisos de Claude Code en el kit

El kit deja a Claude trabajar con fluidez en tus proyectos y le impide tocar lo que no debe. Hay **tres capas**, y
las tres las instala `setup` en `~/.claude/settings.json` (antes guarda tu archivo anterior como
`settings.json.antes-de-ecomdrop`).

## 1. Lo que Claude hace sin preguntar (`allow`)

| Grupo | Reglas |
|---|---|
| Paquetes y runtimes | `npm`, `npx`, `pnpm`, `node`, `uv`, `uvx`, `pip`, `pip3`, `python3 -m pip` |
| Control de versiones | `git`, `gh` |
| Sistema | `brew` (macOS), `winget` (Windows), `docker` |
| SIE | `python3 sie/scripts/*`, `bash sie/bin/*`, `node sie/scripts/*`, `ffmpeg`, `ffprobe`, `whisper-cli`, `shopify theme …`, `ecomdrop-doctor` |
| Archivos | leer y editar cualquier cosa dentro de `~/proyectos/` |

En Windows se añaden las mismas reglas para la herramienta PowerShell.

## 2. Lo que pide confirmación (`ask`)

Acciones legítimas pero difíciles de deshacer: `git push --force`, `git reset --hard`, `git clean`, `git branch -D`,
`gh repo delete`, `gh secret`, `npm publish`, `docker system prune`, `docker volume rm`, desinstalar con `brew`/`winget`,
y en Shopify `theme publish`, `theme push` y `theme delete` (el SIE nunca escribe en el tema publicado).
El `.env` **del proyecto actual** también pide confirmación antes de que Claude lo lea o lo cambie.

## 3. Lo que nunca se hace (`deny` + guardia)

| Qué | Cómo se bloquea |
|---|---|
| `rm -rf /`, `~`, `$HOME`, `..`, `sudo rm` | regla `deny` |
| **Cualquier** borrado recursivo fuera del proyecto actual o del proyecto entero (`rm -r`, `Remove-Item -Recurse`, `rd /s`, `find -delete`), aunque use `cd ..`, rutas relativas o variables | guardia |
| Llaves SSH (`~/.ssh`), GPG, llaveros de macOS/Linux, credenciales de Windows | `deny` + guardia (también `security find-*`, `secret-tool`, `cmdkey`) |
| Tokens guardados: `~/.aws`, `~/.config/gh/hosts.yml`, `~/.docker/config.json`, `~/.npmrc`, `~/.netrc`, `~/.claude.json` | `deny` + guardia |
| `.env` de **otros** proyectos | guardia |
| Claves globales del kit (`~/.ecomdrop/.env`) y la propia configuración de permisos (`~/.claude/settings.json`) | `deny` |
| Modo sin confirmaciones (`bypassPermissions`) | `disableBypassPermissionsMode: "disable"` |

**La guardia** es un hook `PreToolUse` (`~/.ecomdrop/guardia/guardia.mjs`). Las reglas de Claude Code comparan
patrones de texto y no pueden expresar «fuera de este proyecto»; la guardia resuelve la ruta real de cada borrado y
de cada archivo antes de que la herramienta se ejecute. Si no entiende un comando, no interfiere: decide el flujo
normal de permisos. Sus pruebas: `node --test config/guardia/guardia.test.mjs`.

**El proyecto actual** es la carpeta donde abriste `claude`. Si lo abres en tu carpeta de usuario (`~`) no hay
proyecto, y la guardia bloquea todo borrado recursivo: abre siempre Claude dentro de la carpeta de una tienda.

### Agregar una excepción

Escribe la regla en el `.claude/settings.json` **del proyecto**, no en el global. Por ejemplo, para que Claude corra
`make` sin preguntar en una tienda: `{"permissions": {"allow": ["Bash(make *)"]}}`. Las reglas `deny` siempre ganan.

### Deshacer

```bash
cp ~/.claude/settings.json.antes-de-ecomdrop ~/.claude/settings.json
```

## Modo sin confirmaciones solo en un dev container

`bypassPermissions` (o `claude --dangerously-skip-permissions`) deja que Claude ejecute cualquier cosa sin preguntar.
En tu equipo está **desactivado**. Úsalo solo dentro de un contenedor, donde un error no puede tocar tus archivos,
tus llaves ni tus otras tiendas.

1. Instala [Docker Desktop](https://www.docker.com/products/docker-desktop/), VS Code y la extensión **Dev Containers**.
2. Copia `config/devcontainer/devcontainer.json` del kit a `<tu-proyecto>/.devcontainer/devcontainer.json`.
3. En VS Code: paleta de comandos → **Dev Containers: Reopen in Container**. La primera vez tarda unos minutos.
4. En la terminal **del contenedor**: `claude` (inicia sesión una vez; la sesión se guarda en un volumen del
   contenedor) y luego `claude --dangerously-skip-permissions`.

Por qué funciona y qué no hacer:

- El contenedor tiene su propio `~/.claude` (un volumen de Docker). La restricción de tu equipo no aplica dentro, y lo que
  pase dentro no toca tu configuración. **No montes** tu `~/.claude`, `~/.ssh` ni `~/.ecomdrop` en el contenedor.
- El contenedor solo ve la carpeta del proyecto. Cualquier cosa que Claude borre o cambie ahí **sí** se refleja en tu
  proyecto: haz commit antes de empezar.
- Sin cortafuegos, Claude puede conectarse a internet desde el contenedor. No pongas en ese `.env` claves de producción.
  Para trabajar con código en el que no confías, usa el contenedor de referencia de Anthropic, que añade un cortafuegos:
  <https://github.com/anthropics/claude-code/tree/main/.devcontainer>.
- Claude Code rechaza `--dangerously-skip-permissions` como root; por eso el contenedor usa el usuario `node`.

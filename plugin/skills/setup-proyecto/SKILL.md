---
name: setup-proyecto
description: Deja listo para trabajar el proyecto de la carpeta actual. Ejecuta ecomdrop-doctor, lee su reporte JSON, aplica los arreglos automáticos y resuelve lo que el script no puede (conflictos de versiones, dependencias nativas, variables de entorno faltantes, Docker detenido, tienda sin dar de alta). Al final verifica que el proyecto arranque. Úsala cuando el estudiante diga «/setup-proyecto», «prepara este proyecto», «instala lo que falta», «no me arranca», «me falta algo», «configura este repo» o abra un proyecto clonado por primera vez.
---

# /setup-proyecto

Objetivo: que el proyecto de la carpeta actual **arranque** en este equipo, sin que el estudiante tenga que saber qué
falta. El diagnóstico lo hace `ecomdrop-doctor`; tú resuelves lo que requiere criterio y compruebas el resultado.

Habla en español, en frases cortas, y explica qué vas a hacer **antes** de hacerlo.

## Reglas que no se rompen

- **Las claves no se inventan.** Si falta un valor del `.env`, pídeselo al estudiante y dile dónde se consigue.
  Nunca repitas en el chat el valor que te dé, ni lo escribas en otro archivo que no sea `.env`.
- **El `.env` no va a git.** Si no está en `.gitignore`, avísalo y propón agregarlo.
- No cambies versiones en `package.json`, `.nvmrc`, `pyproject.toml` ni lockfiles sin explicar el motivo y recibir un «sí».
- Instala con lo que diga el proyecto: si hay `package-lock.json` usa `npm ci`; con `pnpm-lock.yaml`, `pnpm install --frozen-lockfile`.
  No cambies de gestor de paquetes.
- Lo que pida `sudo` o permisos de administrador: explícale al estudiante por qué antes de ejecutarlo.
- Si después de dos intentos algo sigue fallando, no improvises: genera el reporte de soporte (último paso).

## 1. Diagnóstico

```bash
ecomdrop-doctor --json > /dev/null; cat .ecomdrop/doctor-report.json
```

Si `ecomdrop-doctor` no está en el PATH, usa `node ~/.ecomdrop/doctor/bin/ecomdrop-doctor.mjs` (en Windows,
`node $env:USERPROFILE\.ecomdrop\doctor\bin\ecomdrop-doctor.mjs`). Si tampoco existe, el kit no está instalado:
dile al estudiante que ejecute el instalador de una línea del bootcamp y detente.

Del reporte importa:

| Campo | Qué es |
|---|---|
| `proyecto.tipos` | `node`, `python`, `docker`, `sie` |
| `herramientas[]` | `estado`: `ok`, `falta`, `version` u `opcional`; `requiere` y `version` |
| `problemas[]` | `severidad`, `codigo`, `mensaje` y `arreglo` (`automatico: true` → lo hace `--fix`; si no, trae `instruccion`) |
| `resumen` | `errores`, `avisos`, `automaticos`, `manuales`, `listo` |

Resume al estudiante en 3–5 líneas qué encontraste: qué es el proyecto, qué falta y qué vas a hacer.

## 2. Arreglos automáticos

Si `resumen.automaticos > 0`:

```bash
ecomdrop-doctor --fix
```

Instala herramientas faltantes, la versión de Node que pide el proyecto (con fnm), dependencias de Node y Python,
Chromium de Playwright, el modelo de whisper, y crea o completa el `.env` con las variables vacías. Después vuelve a
leer `.ecomdrop/doctor-report.json`: lo que quede es lo tuyo.

Si una herramienta recién instalada «no se encuentra», abre el siguiente comando con el PATH recargado
(`exec $SHELL -l` no sirve dentro de Claude; usa la ruta completa: `~/.local/bin`, `~/.fnm`, `/opt/homebrew/bin`) o
pídele al estudiante que abra una terminal nueva.

## 3. Lo que el doctor no resuelve solo

Trabaja por `codigo`:

**`conflicto-version-node`** — `.nvmrc` y `engines.node` piden versiones incompatibles.
Busca cuál manda en producción: `FROM node:X` del `Dockerfile`, `node-version` en `.github/workflows/*.yml`,
`engines` de `vercel.json` o `netlify.toml`. Propón alinear el otro archivo a esa versión, muestra el cambio y espera
el «sí». Luego `fnm install <versión>`.

**`version-node` / `version-python`** — instalada otra versión. Node: `fnm install <v>` (en la carpeta, `fnm use`).
Python: `uv python install <v>` y, si el proyecto usa entorno virtual, `uv venv --python <v>` antes de instalar.

**`dependencias-node` / `dependencias-python` que fallaron con `--fix`** — lee el error completo. Las causas típicas:

| Error | Solución |
|---|---|
| `gyp ERR!`, `node-gyp`, `make: not found`, `cl.exe` | Herramientas de compilación. macOS: `xcode-select --install`. Linux: `sudo apt-get install -y build-essential python3`. Windows: `winget install Microsoft.VisualStudio.2022.BuildTools` con «Desarrollo para el escritorio con C++» |
| `sharp` / `libvips` | `npm rebuild sharp`; en Linux, `sudo apt-get install -y libvips-dev` |
| `canvas` | Linux: `sudo apt-get install -y libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev`; macOS: `brew install pkg-config cairo pango libpng jpeg giflib librsvg` |
| `ERESOLVE` (peer dependencies) | No uses `--force`. Explica el conflicto; `npm install --legacy-peer-deps` solo si el estudiante lo acepta |
| `EACCES` en `npm -g` | Node no está gestionado por fnm: `fnm install --lts` y vuelve a intentar sin sudo |
| `externally-managed-environment` (Python) | Usa un entorno virtual: `uv venv && uv pip install -r requirements.txt` |
| `Unsupported engine` | Es un `version-node` disfrazado: vuelve al punto anterior |

**`env-vacias` / `env-falta` / `kie-key`** — para cada variable vacía:
1. Averigua para qué sirve: comentario en `.env.example` y dónde se usa (`grep -rn "process.env.NOMBRE\|os.environ\[.NOMBRE\|getenv(.NOMBRE" --include=*.{js,ts,py} .`).
2. Clasifícala: **secreto** (token, key, secret, password, URL con credenciales) o **configuración** (puerto, URL pública, modo).
3. Configuración con un valor por defecto evidente (`PORT=3000`, `NODE_ENV=development`): propónlo y escríbelo si el estudiante acepta.
4. Secretos: pídeselos al estudiante, uno por uno, diciendo de qué servicio salen y en qué pantalla se crean.
   Si no los tiene todavía, déjalos vacíos y anótalos en el resumen final.

**`docker-detenido`** — pide abrir Docker Desktop (Linux: `sudo systemctl start docker`) y vuelve a comprobar con `docker info`.

**`env-file-compose`** — el `docker-compose.yml` usa un `env_file` que no existe. Propón crearlo desde `.env.example`.

**`dependencias-nativas` (aviso)** — solo actúa si la instalación falló; si no, menciónalo y sigue.

**Tienda del SIE** (`tipos` incluye `sie`):
- `tienda-json-falta` / `tienda-json-ejemplo` → usa la skill `nueva-tienda` («da de alta esta tienda»).
- `modelo-whisper`, `sie-falta`, `sie-dependencias`, `claude-config` → son del equipo, no del proyecto: ejecuta
  `ecomdrop-doctor --sistema --fix` y, si sigue faltando, pide abrir el asistente de instalación del bootcamp.

Cuando termines, vuelve a correr `ecomdrop-doctor` hasta que `resumen.errores` sea 0 (máximo tres vueltas).

## 4. Verificar que arranca

Elige el comando según el proyecto y **córrelo en segundo plano con un límite de tiempo**:

| Proyecto | Comando | Se considera arrancado cuando |
|---|---|---|
| Node con `scripts.dev` | `npm run dev` (o el gestor del proyecto) | Aparece `ready`, `listening`, `Local:` o una URL `http://localhost:…` |
| Node con `scripts.start` | `npm start` | Igual |
| Python con `manage.py` | `python manage.py runserver` (en el `.venv`) | `Starting development server` |
| Python con FastAPI/uvicorn | el comando de `pyproject` `[project.scripts]` o `uvicorn <modulo>:app` | `Uvicorn running on` |
| Python script (`main.py`, `app.py`) | `python main.py --help` | Sale con código 0 |
| Solo `docker-compose.yml` | `docker compose up -d` y `docker compose ps` | Todos los servicios `running`/`healthy` |
| Tienda del SIE | `bash sie/bin/doctor.sh` | Termina en «Todo listo.» |

Si arranca un servidor: comprueba la URL con `curl -sI <url>` (código 2xx o 3xx), dile al estudiante la URL y
**detén el proceso** al terminar (y `docker compose down` solo si lo levantaste tú). Si no arranca: lee el error,
vuelve al paso 3 y, tras dos intentos, pasa al reporte.

## 5. Cierre

Resume en una lista corta:
- qué quedó instalado o cambiado (incluye cada archivo que editaste),
- qué variables siguen vacías y de dónde se sacan,
- cómo arrancar el proyecto desde ahora (el comando exacto).

Si algo quedó sin resolver:

```bash
ecomdrop-doctor --report
```

Dile al estudiante que copie el bloque completo y lo pegue en el chat de soporte del bootcamp. El reporte no incluye
claves ni valores del `.env`.

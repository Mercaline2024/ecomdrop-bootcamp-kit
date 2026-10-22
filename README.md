# Ecomdrop Bootcamp Kit

Prepara tu computador para el **Ecomdrop Bootcamp** con un solo comando. Instala las herramientas de desarrollo,
Claude Code con la configuración del bootcamp, el **SIE (Super Inteligencia Ecommerce)** con sus skills, y un
asistente que te guía paso a paso, con Chriss, hasta dejar tu primera tienda lista.

> Creado por **Elkin García** · [@elkingarcia.ia](https://www.instagram.com/elkingarcia.ia) · con Claude Code

---

## Antes de empezar

**No necesitas tener ningún programa instalado.** El instalador pone todo lo necesario. Lo que sí necesitas:

| | Requisito |
|---|---|
| Sistema | **macOS** reciente, **Windows 10** (versión 1809 o posterior) u **11**, o **Ubuntu/Debian** |
| Permisos | Poder instalar programas: la contraseña del Mac, aceptar el aviso de permisos de Windows o `sudo` en Linux |
| Internet y disco | Conexión estable y unos **5 GB libres** (el modelo de transcripción pesa 1,6 GB) |
| Tiempo | Entre 20 y 40 minutos, según tu conexión |

Y estas cuentas (el instalador no las crea):

| Cuenta | ¿Obligatoria? | Para qué |
|---|---|---|
| [claude.ai](https://claude.ai) con plan **Pro o Max** | Sí | Claude Code y los conectores |
| [GitHub](https://github.com/signup) | Sí | Recibir el acceso al SIE. **Envía tu usuario de GitHub al equipo del bootcamp** antes de instalar |
| Tienda **Shopify** | Sí | Tu tienda |
| **Meta Business** (anuncios) | Sí | Campañas de Meta Ads |
| [kie.ai](https://kie.ai) | Sí | Imágenes, voz, música y video con IA (`KIE_API_KEY`) |
| **Dropi** | Si vendes con Dropi | Pedidos, envíos y huella del cliente |
| Dropkiller, Apify | No | Investigación de productos y voz del cliente |
| Plataforma **Ecomdrop** | No | Solo si ya eres cliente: bot de WhatsApp y Dropi vía Ecomdrop |

---

## Instalar

Abre una terminal y pega **una** línea:

**macOS y Linux** (app Terminal):

```bash
curl -fsSL https://raw.githubusercontent.com/Mercaline2024/ecomdrop-bootcamp-kit/main/scripts/setup.sh | bash
```

**Windows** (abre **PowerShell**, no «Símbolo del sistema»):

```powershell
irm https://raw.githubusercontent.com/Mercaline2024/ecomdrop-bootcamp-kit/main/scripts/setup.ps1 | iex
```

> En Linux, si te dice `curl: command not found`, instálalo primero con `sudo apt-get install -y curl`.

### Qué pasa al ejecutarlo

1. **En la terminal (2–5 min)** se instala solo lo que necesita permisos de administrador, y antes de pedirlos te
   dice por qué:
   - macOS: Homebrew (te pide la contraseña del Mac; al escribirla no se ve nada, es normal).
   - Windows: winget y Git for Windows (acepta el aviso de permisos de Windows) y permite los scripts de npm.
   - Linux: los paquetes del sistema con apt.
   - En los tres: Node.js, **Claude Code**, los permisos y la guardia, el plugin del bootcamp y `ecomdrop-doctor`.
2. **Se abre Claude Code.** Inicia sesión con tu cuenta de claude.ai y escribe:

   ```
   /ecomdrop-bootcamp:instalar
   ```

   Claude instala el resto contigo —Python, GitHub CLI, ffmpeg y whisper, Shopify CLI, el SIE (te pide iniciar sesión
   en GitHub con un código) y el navegador de pruebas—, resuelve lo particular de tu equipo y al final abre el
   asistente con **Chriss** para tus claves, conectores y tu primera tienda.
3. Claude termina con una revisión de `ecomdrop-doctor` y te dice cómo empezar.

Otras formas, si las prefieres (macOS y Linux: `… | bash -s -- --completo`; Windows: `$env:ECOMDROP_MODO='completo'`
antes del comando):

| Modo | Qué hace |
|---|---|
| `--completo` | Todo en la terminal, sin Claude ni navegador |
| `--asistente` | Todo desde el asistente web con Chriss, como una instalación guiada clásica |

### Qué se instala

| Herramienta | Para qué |
|---|---|
| Git, GitHub CLI | Control de versiones y acceso al SIE |
| fnm + Node.js LTS | Scripts del SIE, Playwright, Shopify CLI |
| uv + Python, Pillow, openpyxl | Scripts de imágenes y hojas de cálculo |
| **Claude Code** (instalador oficial) | Tu agente de trabajo |
| ffmpeg, whisper-cli + modelo large-v3-turbo | Edición de video y transcripción |
| ImageMagick (Windows y Linux) | Imágenes (en macOS se usa `sips`, que ya viene con el sistema) |
| Shopify CLI | Temas de Shopify |
| Playwright + Chromium | Validar landings |
| **SIE** en `~/proyectos/super-inteligencia-ecommerce` | Las 13 skills del bootcamp, scripts, plantillas y conocimiento |
| Plugin **ecomdrop-bootcamp** para Claude Code | `/setup-proyecto`, comandos del kit y el MCP oficial de Dropi |
| `ecomdrop-doctor` | Revisa cualquier proyecto e instala lo que falta |

Todo es **idempotente**: si vuelves a ejecutar el instalador, salta lo que ya está y solo instala lo que falta.

---

## Después de instalar

Cuando Claude termine `/ecomdrop-bootcamp:instalar`, abre una **terminal nueva** (para que se carguen las herramientas) y entra a tu tienda:

```bash
cd ~/proyectos/tiendas/<tu-tienda>
claude
```

Y dile a Claude:

```
da de alta esta tienda
```

La skill `nueva-tienda` completa tu `tienda.json` desde los conectores. A partir de ahí: «vamos a lanzar el producto X».

### Comandos útiles

| Comando | Qué hace |
|---|---|
| `/ecomdrop-bootcamp:instalar` (en Claude) | Termina de preparar tu equipo (si cerraste la ventana o falló algo, vuelve a escribirlo: retoma donde quedó) |
| `ecomdrop-paso <paso>` | Repite un paso del instalador: `python`, `gh`, `media`, `modelo`, `shopify`, `acceso`, `sie`, `playwright`, `config` |
| `ecomdrop-asistente` | Abre el asistente web con Chriss (claves, conectores, tienda) |
| `ecomdrop-doctor` | Revisa el proyecto de la carpeta actual: tabla en consola y reporte en `.ecomdrop/doctor-report.json` |
| `ecomdrop-doctor --fix` | Instala lo que falta (versión de Node, dependencias, `.env`, Chromium…) |
| `ecomdrop-doctor --sistema` | Revisa tu equipo completo (SIE, modelo, Claude Code) |
| `ecomdrop-doctor --report` | Texto para enviar a soporte (sin claves ni datos privados) |
| `/setup-proyecto` (en Claude) | Claude deja listo cualquier proyecto: ejecuta el doctor, resuelve lo que este no puede y comprueba que arranque |
| `/ecomdrop-bootcamp:doctor` | El doctor, explicado por Claude |
| `/ecomdrop-bootcamp:conectores` | Qué conectores tienes listos y cómo conectar los que faltan |
| `/ecomdrop-bootcamp:soporte` | Genera el reporte para soporte |
| `/ecomdrop-bootcamp:actualizar` | Cómo actualizar el kit, el SIE y tus tiendas |

### Conectores

| Conector | Para quién | Cómo |
|---|---|---|
| Shopify | Todos (obligatorio) | claude.ai → Ajustes → Conectores → Shopify |
| Facebook meta ADS | Todos (obligatorio) | Conector personalizado con ese **nombre exacto** y la URL `https://mcp.facebook.com/ads` |
| Dropi (MCP oficial) | Todos los que usen Dropi | Ya viene instalado: en Claude escribe `/mcp` → dropi → *Authenticate* y entra con tu cuenta de Dropi |
| Dropkiller | Opcional | `/mcp` → dropkiller → *Authenticate* |
| Apify | Opcional | Guarda tu `APIFY_TOKEN` en el asistente (pestaña Claves) |
| Admin_MCP_Ecomdrop, ecomdrop, MCp dropi- Ecomdrop | **Solo clientes de la plataforma Ecomdrop** | Conector personalizado con el nombre exacto |

Detalle, URLs y diferencias entre los dos de Dropi: [`config/conectores.md`](config/conectores.md).
**Importante:** inicia sesión en Claude Code con tu cuenta de claude.ai, no con una API key; si no, los conectores de
claude.ai no aparecen.

---

## Actualizar

| Qué | Cómo |
|---|---|
| **Kit y SIE** | Vuelve a ejecutar el comando de una línea. Actualiza herramientas, configuración, plugin y baja la última versión del SIE |
| **Cada tienda** | Dentro de la tienda: `bash sie/bin/actualizar-tienda.sh` |
| **Solo el plugin** | `claude plugin marketplace update ecomdrop && claude plugin update ecomdrop-bootcamp@ecomdrop` |
| **Claude Code** | Se actualiza solo |

Después de actualizar, `ecomdrop-doctor` en tu tienda confirma que todo quedó bien.

---

## Solución de problemas

| Síntoma | Solución |
|---|---|
| `command not found: claude` / `node` / `uv` justo después de instalar | Cierra la terminal y abre una nueva. En macOS también puedes ejecutar `source ~/.zshrc` |
| macOS: «Command Line Tools» o Homebrew no termina | Ejecuta `xcode-select --install`, acepta la ventana y vuelve a ejecutar el instalador |
| macOS: escribo la contraseña y no aparece nada | Es normal: la terminal no muestra la contraseña. Escríbela y pulsa Enter |
| Windows: `irm no se reconoce` | Estás en «Símbolo del sistema». Abre **PowerShell** y repite |
| Windows: «la ejecución de scripts está deshabilitada en este sistema» | El instalador lo resuelve solo. Si te pasa después: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` en PowerShell (no necesita administrador) |
| Windows: falta winget | Instala «App Installer» desde [Microsoft Store](https://apps.microsoft.com/detail/9nblggh4nns1), cierra PowerShell y repite |
| Windows: aparecen varios avisos de permisos | Acéptalos: son los instaladores oficiales (Git, GitHub CLI, ImageMagick) |
| Linux: `curl: command not found` | `sudo apt-get install -y curl` y repite |
| El navegador dice «Abre el enlace completo…» | Usa el enlace que mostró la terminal: incluye un código de acceso (`?t=…`) |
| «El puerto 4747 está ocupado» | Ya tienes el asistente abierto en otra ventana. Ciérrala o usa la que está abierta |
| «Tu cuenta no tiene acceso al SIE» | Envía tu usuario de GitHub al equipo del bootcamp para que te inviten; luego pulsa «Reintentar» |
| La descarga del modelo se cortó | Pulsa «Reintentar» en ese paso: continúa donde quedó |
| Los conectores de claude.ai no aparecen | Inicia sesión en Claude Code con tu cuenta de claude.ai (`claude` → `/login`), no con una API key |
| Dropi: «Needs authentication» | En Claude: `/mcp` → dropi → *Authenticate*, y entra con tu usuario de Dropi |
| Un antivirus o proxy corporativo bloquea descargas | Prueba en otra red o pide que permitan `github.com`, `claude.ai`, `astral.sh`, `nodejs.org` y `huggingface.co` |
| Un proyecto no arranca | En la carpeta del proyecto, abre Claude y escribe `/setup-proyecto` |

**¿Nada de esto funcionó?** Ejecuta `ecomdrop-doctor --report` (o, en el asistente, «Copiar reporte para soporte»)
y pégalo en el chat de soporte del bootcamp. El reporte no incluye tus claves.

El registro completo de cada instalación queda en `~/.ecomdrop/logs/` (se borra al terminar el asistente).

---

## Seguridad y permisos

- Tus claves viven solo en tu equipo: `~/.ecomdrop/.env` y el `.env` de cada tienda, con permisos solo para tu usuario.
- El asistente solo escucha en tu propio computador (`127.0.0.1`) y exige un código de acceso.
- Claude Code queda configurado para trabajar con fluidez dentro de `~/proyectos` y **nunca** tocar tus llaves SSH,
  llaveros, credenciales ni el `.env` de otros proyectos, ni borrar fuera del proyecto. Detalle y cómo usar el modo sin
  confirmaciones **solo dentro de un dev container**: [`docs/permisos.md`](docs/permisos.md).

## Desinstalar

```bash
claude plugin uninstall ecomdrop-bootcamp@ecomdrop && claude plugin marketplace remove ecomdrop
for m in playwright dropkiller apify; do claude mcp remove $m -s user; done
rm -rf ~/.ecomdrop ~/whisper-models                       # kit, doctor, claves globales y modelo
cp ~/.claude/settings.json.antes-de-ecomdrop ~/.claude/settings.json   # tu configuración anterior de Claude Code
```

Tus tiendas (`~/proyectos/tiendas/`) y el SIE (`~/proyectos/super-inteligencia-ecommerce`) se borran a mano si quieres.

---

## Para el equipo del bootcamp

```
scripts/        setup.sh · setup.ps1 · configurar-claude.mjs · exportar-sie.sh
asistente/      servidor.mjs (Node sin dependencias) · web/ (interfaz compilada) · ui/ (código: React + 21st + shadcn)
config/         settings.json · CLAUDE.md · mcp.template.json · .env.example · conectores.md · guardia/ · devcontainer/
plugin/         plugin de Claude Code: skills/setup-proyecto, commands/, .mcp.json (Dropi oficial)
.claude-plugin/ marketplace.json (marketplace «ecomdrop»)
doctor/         ecomdrop-doctor (CLI en Node sin dependencias)
docs/           permisos.md · pruebas.md
examples/       proyecto-demo (Node + Python, para probar el doctor y /setup-proyecto)
tests/          sie-de-prueba (estructura del SIE sin contenido, para CI)
.github/        workflows/pruebas.yml
```

| Tarea | Cómo |
|---|---|
| Publicar una versión nueva del SIE | `bash scripts/exportar-sie.sh --publicar` (limpia datos de clientes y sube `sie.tar.gz` como release del repo privado `ecomdrop-bootcamp/ecomdrop-sie-dist`) |
| Dar acceso a un estudiante | `gh api -X PUT orgs/ecomdrop-bootcamp/teams/estudiantes/memberships/<usuario-github>` (le llega una invitación por correo; al aceptarla puede descargar el SIE) |
| Quitar el acceso | `gh api -X DELETE orgs/ecomdrop-bootcamp/teams/estudiantes/memberships/<usuario-github>` (y, si quieres, sácalo de la organización en github.com/orgs/ecomdrop-bootcamp/people) |
| Ver quién tiene acceso | `gh api orgs/ecomdrop-bootcamp/teams/estudiantes/members -q '.[].login'` |
| Cambiar la interfaz del asistente | `cd asistente/ui && npm install && npm run build` (compila a `asistente/web`) |
| Ver el asistente sin instalar nada | `node asistente/servidor.mjs --demo` |
| Pruebas automáticas | `node --test doctor/test/*.test.mjs config/guardia/guardia.test.mjs` · `claude plugin validate .` · GitHub Actions instala el kit en macOS, Windows y Ubuntu con un SIE de prueba (`.github/workflows/pruebas.yml`) |
| Pruebas manuales (VM con UTM, torre con Windows) | [`docs/pruebas.md`](docs/pruebas.md) |

---
name: instalar
description: Termina de preparar el equipo del estudiante del Ecomdrop Bootcamp después del comando de una línea. Instala Python, GitHub CLI, ffmpeg, whisper y su modelo, Shopify CLI, el SIE (con login en GitHub) y Playwright usando los pasos probados del kit (ecomdrop-paso), resuelve lo que falle en ese equipo concreto, guía las claves, los conectores y la primera tienda, y verifica con ecomdrop-doctor. Úsala cuando el estudiante escriba «/ecomdrop-bootcamp:instalar», «instala el bootcamp», «termina la instalación», «prepara mi equipo» o acabe de ejecutar el instalador.
---

# /ecomdrop-bootcamp:instalar

El comando de una línea ya dejó lo que necesita permisos de administrador (Homebrew en macOS, apt en Linux, winget y
Git en Windows), Node, Claude Code, la configuración del kit y el doctor. Tú instalas el resto **con los pasos
probados del kit** y solo improvisas cuando un paso falla en este equipo.

Habla en español, en frases cortas. Antes de cada bloque, di qué vas a hacer y cuánto tarda más o menos.
Eres el guía del estudiante: si algo va a pedirle que haga clic o escriba algo, díselo **antes** de que pase.

## Reglas

- Instala **siempre** con `ecomdrop-paso <paso>`. Es idempotente: si algo ya está, lo salta. No instales a mano lo que
  un paso ya cubre.
- **Nunca pidas claves ni tokens en el chat.** Se escriben en el asistente local (paso 4).
- No uses `--dangerously-skip-permissions` ni pidas al estudiante que cambie los permisos del kit.
- Si un comando pide contraseña de administrador (`sudo`), no puedes escribirla: dile al estudiante qué comando
  ejecutar en una terminal aparte y por qué.
- En **Windows**, los pasos que usan winget pueden abrir el aviso de permisos de Windows (UAC). Avisa antes:
  «Si Windows te pregunta si permites cambios, pulsa Sí».
- Si un paso falla dos veces, no sigas probando cosas: pasa al reporte de soporte (paso 6).

## 1. Revisión inicial

```bash
ecomdrop-doctor --sistema --json > /dev/null; cat ~/.ecomdrop/doctor-report.json
```

(Si `ecomdrop-doctor` no se encuentra, la terminal de Claude no ve el PATH nuevo: usa la ruta completa
`~/.local/bin/ecomdrop-doctor`, o pide al estudiante `/exit` y volver a abrir `claude`.)

Resume en 3 líneas qué ya está y qué falta. Explica el orden que vas a seguir.

## 2. Herramientas

Ejecuta, en este orden, los pasos que falten. Los largos, **en segundo plano**, y ve revisando su salida:

| Paso | Comando | Tiempo | Notas |
|---|---|---|---|
| Python | `ecomdrop-paso python` | 1–2 min | uv + Python + Pillow y openpyxl |
| GitHub CLI | `ecomdrop-paso gh` | < 1 min | Windows: aviso de permisos |
| Video, audio e imagen | `ecomdrop-paso media` | 2–15 min | En Linux compila whisper (el más largo); Windows: aviso de permisos para ImageMagick |
| Shopify CLI | `ecomdrop-paso shopify` | 1 min | |
| Acceso al SIE | `ecomdrop-paso acceso` | lo que tarde el estudiante | **en segundo plano**: ver abajo |
| SIE | `ecomdrop-paso sie` | 1 min | Necesita el acceso anterior |
| Navegador de pruebas | `ecomdrop-paso playwright` | 2–5 min | Chromium para validar landings |
| Modelo de transcripción | `ecomdrop-paso modelo` | 5–30 min | **en segundo plano**: 1,6 GB; si se corta, repetirlo continúa donde quedó |

**Acceso al SIE (GitHub):** lánzalo en segundo plano y lee su salida hasta que aparezca
`First copy your one-time code: XXXX-XXXX`. Entonces dile al estudiante, destacado:

> Abre **https://github.com/login/device**, inicia sesión con tu cuenta de GitHub y escribe el código **XXXX-XXXX**.

Espera a que el paso termine. Si dice que la cuenta **no tiene acceso al SIE**, explícale que debe enviar su usuario
de GitHub a soporte del bootcamp y aceptar la invitación que le llegará por correo; luego repite `ecomdrop-paso acceso`.

Tras cada paso, lee las líneas con `✔` / `✖`. Si hay `✖`:
1. Lee el log que indica (`~/.ecomdrop/logs/…`), las últimas 40 líneas.
2. Causas frecuentes:

| Síntoma | Qué hacer |
|---|---|
| `command not found` / «no se reconoce» justo después de instalar algo | El PATH nuevo no llegó a esta terminal: repite el paso (cada paso recarga el PATH) o usa la ruta completa (`~/.local/bin`, `~/.fnm`, `/opt/homebrew/bin`) |
| Windows: winget «no se pudo instalar» con código | Repite una vez; si sigue, pide al estudiante abrir Microsoft Store → Biblioteca → actualizar «Instalador de aplicación» |
| Windows: «la ejecución de scripts está deshabilitada» | `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` (no necesita administrador) y repite |
| Windows: Python «no se encontró; ejecutar sin argumentos para instalar desde Microsoft Store» | Es el acceso directo falso de Windows. Repite `ecomdrop-paso python`: el paso ya lo evita |
| Descarga cortada / `curl: (28)` / timeout | Repite el paso: continúa donde quedó |
| Linux: `Permission denied` / pide sudo | Pide al estudiante ejecutar en una terminal aparte el comando que falló con `sudo` delante |
| `externally-managed-environment` | Repite `ecomdrop-paso python` (usa `--break-system-packages` sobre el Python del sistema a propósito: los scripts del SIE lo necesitan) |

3. Aplica la solución y repite el paso **una** vez.

## 3. Configuración de Claude Code

```bash
ecomdrop-paso config
```

Vuelve a aplicar permisos, guardia, MCP y el plugin con todo ya instalado.

## 4. Claves, conectores y primera tienda (asistente web)

Las claves no pasan por el chat. Abre el asistente local en segundo plano:

```bash
ecomdrop-asistente --seccion claves --no-abrir
```

Lee la salida y dale al estudiante el enlace completo `http://127.0.0.1:4747/?t=…#claves`. Pídele, en este orden:

1. **Claves**: pegar la `KIE_API_KEY` (obligatoria; de kie.ai → API Keys) y, si la tiene, `APIFY_TOKEN`. Pulsar
   «Probar» y luego «Guardar claves».
2. **Conectores**: en claude.ai → Ajustes → Conectores, agregar **Shopify** y **Facebook meta ADS**
   (`https://mcp.facebook.com/ads`) con el nombre exacto. Para **Dropi** (MCP oficial, ya instalado): aquí en Claude,
   `/mcp` → dropi → Authenticate, con su cuenta de Dropi. Los conectores de Ecomdrop son solo para clientes de esa
   plataforma.
3. **Tu tienda**: completar el formulario y «Crear tienda» (copia las claves a la tienda).

Cuando diga que terminó, detén el asistente (el proceso en segundo plano).

## 5. Revisión final

```bash
ecomdrop-doctor --sistema
```

Y, en la carpeta de la tienda que creó (`~/proyectos/tiendas/<slug>`): `ecomdrop-doctor`.
Si queda algo que `--fix` arregla solo, ejecútalo (`ecomdrop-doctor --sistema --fix`). Los avisos de claves opcionales
vacías están bien.

Cierra con un resumen corto:
- qué quedó instalado y qué falta (si falta algo),
- cómo empezar: «abre una terminal en `~/proyectos/tiendas/<slug>`, escribe `claude` y dime *da de alta esta tienda*».

## 6. Si algo no se resolvió

```bash
ecomdrop-doctor --report
```

Pídele que copie el bloque completo y lo pegue en el chat de soporte del bootcamp, junto con el paso que falló.
El reporte no incluye claves.

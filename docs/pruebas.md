# Probar el kit en equipos limpios

Las pruebas automáticas (`.github/workflows/pruebas.yml`) instalan el kit en macOS, Windows y Ubuntu con un **SIE de
prueba** sin contenido real. Lo que no pueden probar —el navegador, los permisos de administrador, iniciar sesión en
GitHub, claude.ai y Dropi, y el **SIE real**— se prueba a mano con esta guía, antes de cada cohorte.

## 0. Qué versión del kit vas a probar

| Situación | Cómo se lanza el instalador |
|---|---|
| **Antes de publicar los repos** (hoy) | Copia la carpeta del kit y `dist/sie.tar.gz` a la máquina de prueba y ejecuta el script local (ver abajo) |
| **Después de publicar** | El comando de una línea del README, igual que un estudiante |

Prepara el paquete del SIE en tu Mac (no se publica en ningún lado):

```bash
bash scripts/exportar-sie.sh      # deja dist/sie.tar.gz (limpio, sin datos de clientes)
```

Lanzar desde la copia local:

```bash
# macOS / Linux, desde la carpeta del kit copiada a la máquina de prueba
ECOMDROP_SIE_TARBALL="$PWD/dist/sie.tar.gz" bash scripts/setup.sh
```
```powershell
# Windows, en PowerShell, desde la carpeta del kit
$env:ECOMDROP_SIE_TARBALL = "$PWD\dist\sie.tar.gz"; .\scripts\setup.ps1
```

Para probar la descarga real del SIE con acceso por GitHub: crea una **cuenta de GitHub de prueba**, invítala al equipo
con lectura sobre `ecomdrop-sie-dist` y no definas `ECOMDROP_SIE_TARBALL`.

---

## A. Mac: máquina virtual con UTM

UTM es gratuito y usa la virtualización de Apple: una máquina macOS dentro de tu Mac arranca en minutos y se puede
clonar para volver al estado limpio.

1. Instala UTM: `brew install --cask utm` (o desde <https://mac.getutm.app>).
2. **Crear la VM macOS**: UTM → *Create a New Virtual Machine* → *Virtualize* → *macOS 12+*. Deja que descargue la
   imagen más reciente (IPSW). Recomendado: 8 GB de RAM, 4 núcleos, 80 GB de disco.
3. Completa el asistente de macOS con un usuario **administrador nuevo**. Omite el Apple ID.
4. **Antes de instalar nada, clona la VM** (clic derecho → *Clone*). Ese clon es tu «equipo limpio»: para repetir la
   prueba, borra la VM usada y vuelve a clonar.
5. Pasa el kit a la VM: en la VM, *Ajustes → General → Compartir → Compartir archivos*, o un USB, o descárgalo de tu
   repo privado. Abre Terminal y lánzalo (paso 0).
6. Sigue la **lista de comprobación** (sección C).

Otras VM útiles en UTM (galería de UTM → *Browse*):

| VM | Para qué | Nota |
|---|---|---|
| **Ubuntu 24.04** (ARM) | Probar el camino de Linux (apt, compilar whisper) | Instala `curl` si no viene: `sudo apt-get install -y curl` |
| **Windows 11 ARM** | Probar Windows sin una torre | Usa la imagen de la galería de UTM o CrystalFetch. Las herramientas x64 corren emuladas |

---

## B. Torre con Windows

Tres maneras, de más limpia a más rápida:

### B1. Máquina virtual Hyper-V (Windows 11 Pro) — la recomendada

1. PowerShell **como administrador**: `Enable-WindowsOptionalFeature -Online -FeatureName Microsoft-Hyper-V -All` y reinicia.
2. Descarga la ISO oficial de Windows 11 (<https://www.microsoft.com/software-download/windows11>) y, en
   *Hyper-V Manager* → *Nuevo → Máquina virtual* (generación 2, TPM y arranque seguro activados), instálala con un
   usuario local administrador nuevo.
3. Antes de instalar nada, crea un **punto de control** (*Checkpoint*). Para repetir la prueba, vuelve a ese punto.
4. Copia el kit a la VM y lánzalo (paso 0), en **PowerShell normal** (no como administrador): así compruebas que los
   avisos de permisos (UAC) aparecen solo cuando hacen falta.

### B2. Windows Sandbox (Windows 11 Pro) — desechable

Cada vez que lo abres es un Windows recién instalado; al cerrarlo se borra todo.

1. PowerShell como administrador: `Enable-WindowsOptionalFeature -Online -FeatureName Containers-DisposableClientVM -All`, reinicia.
2. Abre **Windows Sandbox** y arrastra la carpeta del kit al escritorio del Sandbox.
3. El Sandbox **no trae winget** (es justo el caso «falta winget» del README). Antes de lanzar el kit, en PowerShell:
   ```powershell
   Install-PackageProvider -Name NuGet -Force; Install-Module Microsoft.WinGet.Client -Force -Repository PSGallery
   Repair-WinGetPackageManager -AllUsers -Latest
   ```
   Lanza el kit sin ese paso al menos una vez para comprobar que el mensaje de error es claro.

### B3. Un usuario nuevo en tu propia torre — rápida, menos limpia

*Configuración → Cuentas → Otros usuarios → Agregar cuenta* (cuenta local, administrador). Inicia sesión con ella y
lanza el kit. Ojo: lo que ya esté instalado para todo el equipo (Git, GitHub CLI, ImageMagick) se detectará como
instalado, así que no prueba esas instalaciones.

---

## C. Lista de comprobación

Marca cada punto y anota el tiempo total. Si algo falla, guarda `~/.ecomdrop/logs/` y el reporte de soporte.

**Instalación**
- [ ] El comando arranca y, antes de pedir la contraseña, sudo o el aviso de Windows (UAC), explica para qué la pide.
- [ ] Se abre el navegador con el asistente y Chriss saluda. El enlace sin `?t=…` muestra «Abre el enlace completo».
- [ ] «Instalar todo» termina con los pasos en verde. Tiempo: ____ min.
- [ ] Acceso al SIE: aparece el código de GitHub, «Abrir GitHub» abre `github.com/login/device`.
  - [ ] con la cuenta de prueba invitada → «Tienes acceso al SIE»;
  - [ ] con una cuenta **no** invitada → mensaje claro para pedir acceso a soporte.
- [ ] `~/proyectos/super-inteligencia-ecommerce/.instalacion.json` tiene el ID y el usuario de GitHub (marca de agua).

**Claves y conectores**
- [ ] «Probar» con una `KIE_API_KEY` real → válida (muestra créditos); con una inventada → error claro.
- [ ] Tras guardar, `~/.ecomdrop/.env` existe y solo tu usuario puede leerlo (`ls -l` → `-rw-------`).
- [ ] `claude` → iniciar sesión con la cuenta de claude.ai. Conectar Shopify y Facebook meta ADS.
- [ ] `/mcp` → **dropi** → Authenticate → entrar con una cuenta de Dropi → «Conectado».
- [ ] «Comprobar conectores» del asistente refleja lo anterior. Los de Ecomdrop aparecen como «Solo clientes de Ecomdrop».
- [ ] Una pregunta a Chriss en la caja «Pregúntale a Chriss…» responde con IA (tarda unos segundos).

**Tienda y cierre**
- [ ] «Crear tienda» crea `~/proyectos/tiendas/<slug>` con `sie/`, `tienda.json`, `.env` y `.claude/skills/`.
- [ ] En esa carpeta: `claude` → «da de alta esta tienda» → la skill `nueva-tienda` responde.
- [ ] «Ejecutar revisión» termina en verde (salvo avisos esperables, como claves opcionales vacías).
- [ ] «Copiar reporte para soporte» no contiene claves ni rutas con tu nombre de usuario.
- [ ] «Terminar y limpiar»: desaparecen `~/.ecomdrop/kit`, `~/.ecomdrop/logs` y `~/.ecomdrop/src`; **se quedan** el SIE, la
      tienda, `~/.ecomdrop/.env`, `~/.ecomdrop/doctor` y `~/.claude/`.

**Después**
- [ ] Terminal nueva: `node`, `claude`, `uv`, `gh` y `ecomdrop-doctor` funcionan sin hacer nada más.
- [ ] Volver a lanzar el instalador termina rápido y no reinstala nada (idempotencia).
- [ ] En una copia de `examples/proyecto-demo`: Claude → `/setup-proyecto` → instala, crea `.env` y comprueba que arranca.
- [ ] Guardia: pídele a Claude «borra la carpeta ~/Documents» y «muéstrame ~/.ssh/id_rsa» → las dos se bloquean
      con un mensaje «[guardia Ecomdrop]».
- [ ] `claude --dangerously-skip-permissions` → no permite el modo sin confirmaciones fuera de un dev container.

## D. Cuando algo falla

Abre un issue (o un mensaje al equipo) con:

1. Sistema y versión (`sw_vers`, `winver` o `lsb_release -a`) y si es VM, Sandbox o equipo real.
2. En qué punto de la lista falló y qué esperabas.
3. La salida de `ecomdrop-doctor --report`.
4. El log de `~/.ecomdrop/logs/` del paso que falló (revísalo antes: no debería tener claves, pero confírmalo).

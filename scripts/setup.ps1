# Ecomdrop Bootcamp Kit — instalador para Windows 10/11 (PowerShell 5.1 o 7).
#
#   irm https://raw.githubusercontent.com/Mercaline2024/ecomdrop-bootcamp-kit/main/scripts/setup.ps1 | iex
#
# Modos ($env:ECOMDROP_MODO): minimo (por defecto: lo básico + Claude Code; luego /ecomdrop-bootcamp:instalar),
#   completo (todo en la terminal; también $env:ECOMDROP_SIN_ASISTENTE=1) y asistente (asistente web con Chriss).
# Un solo paso: $env:ECOMDROP_PASO='<id>'  (o el comando ecomdrop-paso <id> después de instalar)
#   Desde una copia local del kit:  $env:ECOMDROP_KIT="$PWD"; iex ([IO.File]::ReadAllText("$PWD\scripts\setup.ps1"))
#   (como archivo también acepta -SinAsistente y -Paso <id>)
# Pasos: base node python gh claude media modelo shopify acceso sie playwright config doctor limpieza
#
# Variables: ECOMDROP_KIT_URL, ECOMDROP_SIE_REPO, ECOMDROP_SIE_TARBALL, ECOMDROP_SALTAR_MODELO=1, GH_TOKEN
# Es idempotente: lo que ya está instalado se salta. Log en %USERPROFILE%\.ecomdrop\logs\.
# No hace falta abrirlo como administrador: Windows mostrará el aviso de UAC solo cuando un instalador lo necesite.

# 'Continue' y no 'Stop': en PowerShell 5.1, con 'Stop', cualquier texto que un programa escriba en stderr
# (git, fnm, winget lo hacen aunque todo vaya bien) detendría el instalador. Los errores se comprueban a mano
# con $LASTEXITCODE (función Correr) y con -ErrorAction Stop en los cmdlets que importan.
$ErrorActionPreference = 'Continue'
$global:ECOMDROP_CODIGO = 0
$ProgressPreference = 'SilentlyContinue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
[Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12

# ───────────────────────── opciones ─────────────────────────
$Paso = $env:ECOMDROP_PASO
$Modo = if ($env:ECOMDROP_MODO) { $env:ECOMDROP_MODO } else { 'minimo' }
if ($env:ECOMDROP_SIN_ASISTENTE -or $env:CI) { $Modo = 'completo' }
for ($i = 0; $i -lt $args.Count; $i++) {
  switch -Regex ($args[$i]) {
    '^-Paso$'         { $Paso = $args[$i + 1]; $i++ }
    '^-(SinAsistente|Completo)$' { $Modo = 'completo' }
    '^-Asistente$'    { $Modo = 'asistente' }
  }
}

$Inicio         = $env:USERPROFILE
$EcomdropHome   = if ($env:ECOMDROP_HOME) { $env:ECOMDROP_HOME } else { Join-Path $Inicio '.ecomdrop' }
$Proyectos      = if ($env:ECOMDROP_PROYECTOS) { $env:ECOMDROP_PROYECTOS } else { Join-Path $Inicio 'proyectos' }
$SieDir         = Join-Path $Proyectos 'super-inteligencia-ecommerce'
$KitUrl         = if ($env:ECOMDROP_KIT_URL) { $env:ECOMDROP_KIT_URL } else { 'https://github.com/Mercaline2024/ecomdrop-bootcamp-kit/archive/refs/heads/main.tar.gz' }
$SieRepo        = if ($env:ECOMDROP_SIE_REPO) { $env:ECOMDROP_SIE_REPO } else { 'ecomdrop-bootcamp/ecomdrop-sie-dist' }
$ModeloUrl      = 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo.bin'
$Modelo         = if ($env:WHISPER_MODEL) { $env:WHISPER_MODEL } else { Join-Path $Inicio 'whisper-models\ggml-large-v3-turbo.bin' }
$LocalBin       = Join-Path $Inicio '.local\bin'
$WhisperDir     = Join-Path $Inicio '.local\share\whisper-cpp'

# ───────────────────────── salida y log ─────────────────────────
New-Item -ItemType Directory -Force -Path (Join-Path $EcomdropHome 'logs') | Out-Null
$Log = Join-Path $EcomdropHome ("logs\setup-{0}{1}.log" -f (Get-Date -Format 'yyyyMMdd-HHmmss'), $(if ($Paso) { "-$Paso" } else { '' }))
try { Start-Transcript -Path $Log -Append | Out-Null } catch {}

function Titulo($t) { Write-Host ""; Write-Host "━━ $t" -ForegroundColor Cyan }
function Info($t)   { Write-Host "  → $t" -ForegroundColor Gray }
function Ok($t)     { Write-Host "  ✔ $t" -ForegroundColor Green }
function Aviso($t)  { Write-Host "  ! $t" -ForegroundColor Yellow }
# Nunca se usa «exit»: con «irm … | iex» cerraría la ventana de PowerShell del estudiante.
# Fallo muestra el error y lanza una excepción marcada que el bloque principal recoge.
function Fallo($t) {
  Write-Host ""; Write-Host "  ✖ $t" -ForegroundColor Red
  Write-Host "  Log completo: $Log"
  Write-Host "  Si no sabes cómo seguir, envía ese archivo a soporte del bootcamp."; Write-Host ""
  $global:ECOMDROP_CODIGO = 1
  throw 'ECOMDROP_FALLO'
}
function Tiene($c) { [bool](Get-Command $c -ErrorAction SilentlyContinue) }

# Ejecuta un programa externo y falla con un mensaje claro si devuelve error.
function Correr([string]$mensaje, [scriptblock]$bloque) {
  & $bloque
  if ($LASTEXITCODE -and $LASTEXITCODE -ne 0) { Fallo "$mensaje (código $LASTEXITCODE)" }
}

# winget no refresca el PATH de la sesión: se recarga desde el registro.
function Recargar-Path {
  $maquina = [Environment]::GetEnvironmentVariable('Path', 'Machine')
  $usuario = [Environment]::GetEnvironmentVariable('Path', 'User')
  $env:Path = "$LocalBin;$(Join-Path $Inicio '.fnm');$WhisperDir;$maquina;$usuario"
  if (Tiene fnm) {
    fnm env --use-on-cd --shell powershell | Out-String | Invoke-Expression
    # solo se activa si Node LTS ya está instalado (si no, fnm avisa por stderr)
    if ((fnm list 2>&1 | Out-String) -match 'lts-latest') { fnm use --silent-if-unchanged lts-latest *> $null }
  }
  $envFile = Join-Path $EcomdropHome '.env'
  if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object { if ($_ -match '^([A-Z0-9_]+)=(.+)$') { Set-Item -Path "env:$($Matches[1])" -Value $Matches[2] } }
  }
}

function Agregar-PathUsuario([string]$dir) {
  $actual = [Environment]::GetEnvironmentVariable('Path', 'User')
  if (-not ($actual -split ';' | Where-Object { $_ -ieq $dir })) {
    [Environment]::SetEnvironmentVariable('Path', ($(if ($actual) { "$actual;" } else { '' }) + $dir), 'User')
    Info "Añadido al PATH de tu usuario: $dir"
  }
  Recargar-Path
}

function Winget-Instalar([string]$id, [string]$nombre, [string]$motivoAdmin = '') {
  & winget list -e --id $id --accept-source-agreements *> $null
  if ($LASTEXITCODE -eq 0) { Ok "$nombre ya instalado"; return }
  if ($motivoAdmin) {
    Aviso "Windows puede pedirte permiso de administrador (UAC). Motivo: $motivoAdmin"
  }
  Info "winget install $id"
  & winget install -e --id $id --source winget --silent --accept-source-agreements --accept-package-agreements --disable-interactivity
  # -1978335189 = ya instalado / sin actualización aplicable
  if ($LASTEXITCODE -ne 0 -and $LASTEXITCODE -ne -1978335189) { Fallo "winget no pudo instalar $nombre ($id). Código $LASTEXITCODE." }
  Recargar-Path
  Ok "$nombre instalado"
}

# npm, pnpm, yarn y fnm se ejecutan en PowerShell a través de scripts .ps1, y Windows los bloquea por defecto
# («la ejecución de scripts está deshabilitada»). Se activa RemoteSigned solo para el usuario (sin admin):
# permite los scripts locales y sigue bloqueando los descargados sin firma. Recomendado por Microsoft para desarrollo.
function Asegurar-PoliticaScripts {
  $usuario = Get-ExecutionPolicy -Scope CurrentUser
  if ($usuario -notin 'RemoteSigned', 'Unrestricted', 'Bypass') {
    $grupo = @((Get-ExecutionPolicy -Scope MachinePolicy), (Get-ExecutionPolicy -Scope UserPolicy)) | Where-Object { "$_" -ne 'Undefined' }
    if ($grupo) {
      Aviso "Tu organización fija la política de scripts ($($grupo -join ', ')). Si npm falla en PowerShell, usa npm.cmd o pide a soporte técnico que permita RemoteSigned."
    } else {
      Info 'Windows bloquea los scripts de PowerShell, y npm, pnpm y fnm los necesitan.'
      Info 'Se activa «RemoteSigned» solo para tu usuario: permite los scripts de tu equipo y bloquea los descargados sin firma.'
      try { Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned -Force -ErrorAction Stop; Ok 'Política de scripts: RemoteSigned (solo tu usuario)' }
      catch { Aviso "No se pudo cambiar la política de scripts: $($_.Exception.Message)" }
    }
  }
  # para esta ventana, mientras dura la instalación (se hace después: el ámbito de proceso es el más específico)
  try { Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force -ErrorAction Stop } catch { <# no disponible fuera de Windows #> }
}

# ───────────────────────── kit ─────────────────────────
function Ubicar-Kit {
  if ($env:ECOMDROP_KIT -and (Test-Path (Join-Path $env:ECOMDROP_KIT 'asistente\servidor.mjs'))) { return $env:ECOMDROP_KIT }
  if ($PSCommandPath) {
    $aqui = Split-Path -Parent (Split-Path -Parent $PSCommandPath)
    if (Test-Path (Join-Path $aqui 'asistente\servidor.mjs')) { return $aqui }
  }
  # Con «irm | iex» se baja SIEMPRE la última versión: una copia de un intento anterior puede estar desactualizada.
  $kit = Join-Path $EcomdropHome 'kit'
  $nuevo = "$kit.nuevo"
  $tgz = Join-Path $env:TEMP 'ecomdrop-kit.tar.gz'
  Info 'Descargando la última versión del kit…'
  try {
    Remove-Item $nuevo -Recurse -Force -ErrorAction SilentlyContinue
    New-Item -ItemType Directory -Force -Path $nuevo -ErrorAction Stop | Out-Null
    Invoke-WebRequest -UseBasicParsing -Uri $KitUrl -OutFile $tgz -ErrorAction Stop
    & tar -xzf $tgz -C $nuevo --strip-components=1
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path (Join-Path $nuevo 'asistente\servidor.mjs'))) { throw 'el paquete del kit está incompleto' }
    Remove-Item $kit -Recurse -Force -ErrorAction SilentlyContinue
    if (Test-Path $kit) { throw 'la copia anterior está en uso (¿quedó abierto el asistente en otra ventana?)' }
    Move-Item $nuevo $kit -ErrorAction Stop
  } catch {
    Remove-Item $nuevo -Recurse -Force -ErrorAction SilentlyContinue
    if (Test-Path (Join-Path $kit 'asistente\servidor.mjs')) { Aviso "No se pudo actualizar el kit ($($_.Exception.Message)); se usa la copia anterior." }
    else { Fallo "No se pudo descargar el kit desde $KitUrl. Revisa tu conexión. ($($_.Exception.Message))" }
  } finally {
    Remove-Item $tgz -Force -ErrorAction SilentlyContinue
  }
  return $kit
}

# ───────────────────────── pasos ─────────────────────────
function Paso-base {
  Titulo 'winget y Git for Windows'
  if (-not (Tiene winget)) {
    Info 'winget no está disponible; intentando registrar App Installer…'
    try { Add-AppxPackage -RegisterByFamilyName -MainPackage Microsoft.DesktopAppInstaller_8wekyb3d8bbwe } catch {}
    Recargar-Path
    if (-not (Tiene winget)) {
      Fallo 'Falta winget. Instala «App Installer» desde Microsoft Store (https://apps.microsoft.com/detail/9nblggh4nns1), cierra PowerShell y vuelve a ejecutar el comando.'
    }
  }
  Ok "winget $(winget --version)"
  Winget-Instalar 'Git.Git' 'Git for Windows' 'Git for Windows se instala para todos los usuarios del equipo. Claude Code y los scripts del SIE lo necesitan (Git Bash).'
  if (-not (Tiene git)) { Fallo 'Git se instaló pero no aparece en el PATH. Cierra PowerShell, ábrelo de nuevo y repite el comando.' }
  Ok "git $((git --version) -replace 'git version ','')"
}

function Paso-node {
  Titulo 'Node.js LTS (fnm)'
  Winget-Instalar 'Schniz.fnm' 'fnm'
  if (-not (Tiene fnm)) { Fallo 'fnm se instaló pero no aparece en el PATH. Abre una PowerShell nueva y repite.' }
  # carga de fnm en cada PowerShell nueva
  $perfil = $PROFILE.CurrentUserAllHosts
  New-Item -ItemType File -Force -Path $perfil -ErrorAction SilentlyContinue | Out-Null
  $linea = 'if (Get-Command fnm -ErrorAction SilentlyContinue) { fnm env --use-on-cd --shell powershell | Out-String | Invoke-Expression }'
  if (-not (Select-String -Path $perfil -SimpleMatch $linea -Quiet)) { Add-Content -Path $perfil -Value "`n# ecomdrop-bootcamp`n$linea" }
  Info 'Asegurando la versión LTS de Node…'
  foreach ($i in 1..3) { fnm install --lts; if ($LASTEXITCODE -eq 0) { break }; Aviso "La descarga de Node falló (intento $i/3)"; Start-Sleep 3 }
  if (-not ((fnm list) -match 'lts-latest')) { Fallo 'No se pudo instalar Node LTS con fnm.' }
  Correr 'fnm default falló' { fnm default lts-latest }
  # node y npm del Node por defecto, en el PATH del usuario: así funcionan en PowerShell, cmd y Git Bash
  # (Claude Code usa Git Bash, que no carga el perfil de PowerShell donde vive «fnm env»)
  $fnmDir = (fnm env --json | Out-String | ConvertFrom-Json).FNM_DIR
  if ($fnmDir -and (Test-Path (Join-Path $fnmDir 'aliases\default\node.exe'))) { Agregar-PathUsuario (Join-Path $fnmDir 'aliases\default') }
  Recargar-Path
  Ok "node $(node --version) · npm $(npm --version)"
}

# Primer intérprete real (>= 3.10). Windows trae un «python3» falso que abre Microsoft Store: se valida ejecutándolo.
function Python-Comando {
  foreach ($c in 'python3', 'python', 'py') {
    if (-not (Tiene $c)) { continue }
    # sin comillas dobles en el código: PowerShell 5.1 las pasa mal a los programas externos
    $exe = & $c -c 'import sys; print(sys.executable if sys.version_info >= (3, 10) else str())' 2>$null
    if ($LASTEXITCODE -eq 0 -and $exe) { return ($exe | Select-Object -Last 1).Trim() }
  }
  return $null
}

# Los scripts del SIE llaman a «python3»: si solo existe python.exe, se crea python3.exe junto a él (mismas DLL).
function Asegurar-Python3([string]$exe) {
  if (Tiene python3) { & python3 -c 'import sys' 2>$null; if ($LASTEXITCODE -eq 0) { return } }
  $destino = Join-Path (Split-Path $exe) 'python3.exe'
  if (-not (Test-Path $destino)) { Copy-Item $exe $destino -ErrorAction Stop; Info "Creado python3.exe junto a $exe" }
  Agregar-PathUsuario (Split-Path $exe)
}

function Instalar-LibsPython {
  $py = Python-Comando
  if (-not $py) { Fallo 'No encuentro un Python que funcione (3.10 o superior).' }
  & $py -c 'import PIL, openpyxl' 2>$null
  if ($LASTEXITCODE -eq 0) { Ok 'Pillow y openpyxl ya instalados'; return }
  Info "Instalando Pillow y openpyxl para $py…"
  $req = Join-Path $SieDir 'requirements.txt'
  if (Test-Path $req) { Correr 'uv pip install falló' { uv pip install --python $py --break-system-packages -r $req } }
  else { Correr 'uv pip install falló' { uv pip install --python $py --break-system-packages 'Pillow>=10' 'openpyxl>=3.1' } }
  Ok 'Pillow y openpyxl instalados'
}

function Paso-python {
  Titulo 'Python (uv)'
  if (-not (Tiene uv)) {
    Info 'Instalando uv…'
    try { Invoke-RestMethod https://astral.sh/uv/install.ps1 -ErrorAction Stop | Invoke-Expression } catch { Fallo "No se pudo instalar uv: $($_.Exception.Message)" }
    Agregar-PathUsuario $LocalBin
  }
  Ok "uv $((uv --version) -replace 'uv ','')"
  $py = Python-Comando
  if (-not $py) {
    Info 'Instalando Python con uv…'
    Correr 'uv no pudo instalar Python' { uv python install --default }
    Agregar-PathUsuario $LocalBin
    $py = Python-Comando
    if (-not $py) { Fallo 'uv instaló Python pero no aparece en el PATH. Abre una PowerShell nueva y repite.' }
  }
  Asegurar-Python3 $py
  Ok "python3 $((& $py --version) -replace 'Python ','') ($py)"
  Instalar-LibsPython
}

function Paso-gh {
  Titulo 'GitHub CLI'
  Winget-Instalar 'GitHub.cli' 'GitHub CLI' 'GitHub CLI se instala para todos los usuarios del equipo.'
}

function Paso-claude {
  Titulo 'Claude Code'
  if (Tiene claude) { Ok "Claude Code $((claude --version) -split ' ' | Select-Object -First 1) ya instalado"; return }
  Info 'Instalando Claude Code con el instalador nativo oficial…'
  try { Invoke-RestMethod https://claude.ai/install.ps1 -ErrorAction Stop | Invoke-Expression } catch { Fallo "El instalador de Claude Code falló: $($_.Exception.Message)" }
  Agregar-PathUsuario $LocalBin
  if (-not (Tiene claude)) { Fallo "Claude Code se instaló pero no aparece en el PATH ($LocalBin)." }
  Ok "Claude Code $((claude --version) -split ' ' | Select-Object -First 1)"
}

function Paso-media {
  Titulo 'Video, audio e imagen'
  Winget-Instalar 'Gyan.FFmpeg' 'FFmpeg'
  Winget-Instalar 'ImageMagick.ImageMagick' 'ImageMagick' 'ImageMagick se instala para todos los usuarios del equipo.'
  if (Tiene whisper-cli) { Ok 'whisper-cli ya instalado'; return }
  Info 'Descargando whisper-cli (whisper.cpp)…'
  # los binarios de Windows se publican en los releases «bNNNN», no en «vX.Y.Z»
  $asset = if ($env:PROCESSOR_ARCHITECTURE -eq 'ARM64') { 'whisper-bin-win-cpu-arm64.zip' } else { 'whisper-bin-x64.zip' }
  $cab = @{ 'User-Agent' = 'ecomdrop-bootcamp-kit' }
  if ($env:GITHUB_TOKEN) { $cab['Authorization'] = "Bearer $env:GITHUB_TOKEN" }  # en CI evita el límite de la API
  $rels = Invoke-RestMethod -UseBasicParsing -Headers $cab 'https://api.github.com/repos/ggml-org/whisper.cpp/releases?per_page=20' -ErrorAction Stop
  $url = ($rels | ForEach-Object { $_.assets } | Where-Object { $_.name -eq $asset } | Select-Object -First 1).browser_download_url
  if (-not $url) { Fallo "No encontré $asset en los releases de whisper.cpp." }
  $zip = Join-Path $env:TEMP $asset
  Invoke-WebRequest -UseBasicParsing -Uri $url -OutFile $zip -ErrorAction Stop
  $tmp = Join-Path $env:TEMP 'whisper-cpp'
  Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
  Expand-Archive -Path $zip -DestinationPath $tmp -Force -ErrorAction Stop
  $exe = Get-ChildItem $tmp -Recurse -Filter 'whisper-cli.exe' | Select-Object -First 1
  if (-not $exe) { Fallo 'El zip de whisper.cpp no trae whisper-cli.exe.' }
  Remove-Item $WhisperDir -Recurse -Force -ErrorAction SilentlyContinue
  New-Item -ItemType Directory -Force -Path $WhisperDir -ErrorAction Stop | Out-Null
  Copy-Item (Join-Path $exe.DirectoryName '*') $WhisperDir -Recurse -Force -ErrorAction Stop   # el exe necesita sus DLL al lado
  Remove-Item $zip, $tmp -Recurse -Force
  Agregar-PathUsuario $WhisperDir
  Ok "whisper-cli instalado en $WhisperDir"
}

function Paso-modelo {
  Titulo 'Modelo de transcripción (whisper large-v3-turbo)'
  if ($env:ECOMDROP_SALTAR_MODELO -eq '1') { Aviso 'Saltado (ECOMDROP_SALTAR_MODELO=1)'; return }
  if ((Test-Path $Modelo) -and (Get-Item $Modelo).Length -gt 1500000000) { Ok "Modelo ya descargado ($Modelo)"; return }
  $libre = (Get-PSDrive ($Inicio.Substring(0, 1))).Free
  if ($libre -lt 2.5GB) { Fallo 'Necesitas al menos 2,5 GB libres para el modelo de whisper.' }
  New-Item -ItemType Directory -Force -Path (Split-Path $Modelo) | Out-Null
  Info 'Descargando ~1,6 GB (si se corta, vuelve a ejecutar este paso: continúa donde quedó)…'
  Correr 'La descarga del modelo falló. Vuelve a intentarlo.' { curl.exe -fL --retry 5 --retry-delay 3 -C - -o "$Modelo.part" $ModeloUrl }
  Move-Item "$Modelo.part" $Modelo -Force -ErrorAction Stop
  Ok "Modelo descargado en $Modelo"
}

function Paso-shopify {
  Titulo 'Shopify CLI'
  if (Tiene shopify) { Ok 'Shopify CLI ya instalado'; return }
  if (-not (Tiene npm)) { Paso-node }
  Correr 'No se pudo instalar Shopify CLI' { npm install -g '@shopify/cli@latest' }
  Ok 'Shopify CLI instalado'
}

function Paso-acceso {
  Titulo 'Acceso al SIE (GitHub)'
  if ($env:ECOMDROP_SIE_TARBALL) { Ok "Se usará el paquete local $env:ECOMDROP_SIE_TARBALL"; return }
  & gh auth status -h github.com *> $null
  if ($LASTEXITCODE -ne 0) {
    if ($env:GH_TOKEN) { Fallo 'GH_TOKEN está definido pero GitHub lo rechaza.' }
    Info 'Inicia sesión en GitHub con tu navegador. Copia el código de 8 caracteres y pégalo en github.com/login/device.'
    Correr 'No se completó el inicio de sesión en GitHub' { gh auth login --hostname github.com --git-protocol https --web --skip-ssh-key }
  }
  $usuario = (gh api user -q .login 2>$null)
  Ok "Sesión de GitHub: $usuario"
  & gh release view -R $SieRepo *> $null
  if ($LASTEXITCODE -ne 0) { Fallo "Tu cuenta ($usuario) no tiene acceso al SIE. Envía tu usuario de GitHub a soporte del bootcamp para que te inviten." }
  Ok 'Tienes acceso al SIE'
}

function Marcar-Instalacion {
  $usuario = (gh api user -q .login 2>$null); if (-not $usuario) { $usuario = $env:USERNAME }
  $id = ([guid]::NewGuid().ToString('N')).Substring(0, 16)
  $fecha = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
  @{ id = $id; github = $usuario; fecha = $fecha; licencia = 'uso personal e intransferible — Ecomdrop Bootcamp' } |
    ConvertTo-Json | Set-Content -Encoding UTF8 (Join-Path $SieDir '.instalacion.json') -ErrorAction Stop
  Get-ChildItem $SieDir -Recurse -Include 'SKILL.md', 'CLAUDE.md', 'PLAYBOOK.md' | ForEach-Object {
    [IO.File]::AppendAllText($_.FullName, "`n<!-- SIE · licencia de uso personal e intransferible · instalación $id · $usuario -->`n")
  }
}

function Paso-sie {
  Titulo 'Instalar el SIE'
  $tmp = Join-Path $EcomdropHome 'tmp\sie'
  Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
  New-Item -ItemType Directory -Force -Path $tmp -ErrorAction Stop | Out-Null
  $paquete = $env:ECOMDROP_SIE_TARBALL
  if (-not $paquete) {
    Paso-acceso
    Info 'Descargando la última versión…'
    Correr 'No se pudo descargar el SIE' { gh release download -R $SieRepo --pattern 'sie.tar.gz*' --dir $tmp }
    $paquete = Join-Path $tmp 'sie.tar.gz'
    $esperado = ((Get-Content "$paquete.sha256") -split '\s+')[0]
    if ((Get-FileHash $paquete -Algorithm SHA256).Hash -ne $esperado.ToUpper()) { Fallo 'El paquete descargado está dañado (sha256 no coincide). Vuelve a intentarlo.' }
  }
  if (-not (Test-Path $paquete)) { Fallo "No encuentro el paquete del SIE: $paquete" }
  # Windows no crea enlaces simbólicos sin permisos especiales: se omiten y las skills se copian
  Correr 'No se pudo descomprimir el SIE' { tar --no-same-owner -xzf $paquete -C $tmp --exclude 'sie/sie' --exclude 'sie/.claude/skills/*' }
  $nuevo = Join-Path $tmp 'sie'
  New-Item -ItemType Directory -Force -Path (Join-Path $nuevo '.claude\skills') | Out-Null
  Get-ChildItem (Join-Path $nuevo 'skills') -Directory | ForEach-Object { Copy-Item $_.FullName (Join-Path $nuevo ".claude\skills\$($_.Name)") -Recurse -Force -ErrorAction Stop }
  New-Item -ItemType Directory -Force -Path $Proyectos | Out-Null
  if (Test-Path $SieDir) {
    if (Test-Path (Join-Path $SieDir 'node_modules')) { Move-Item (Join-Path $SieDir 'node_modules') $nuevo -Force -ErrorAction Stop }
    if (Test-Path (Join-Path $SieDir '.env')) { Copy-Item (Join-Path $SieDir '.env') $nuevo -Force -ErrorAction Stop }
    Remove-Item $SieDir -Recurse -Force -ErrorAction Stop
  }
  Move-Item $nuevo $SieDir -ErrorAction Stop
  Marcar-Instalacion
  Push-Location $SieDir
  # repo git local sin remoto: nueva-tienda.sh lo usa como submódulo de cada tienda
  Correr 'No se pudo preparar el repo local del SIE' { git init -q -b main; git add -A; git -c user.name='Ecomdrop Bootcamp' -c user.email='kit@ecomdrop.invalid' commit -qm "SIE $(Get-Date -Format yyyy-MM-dd)" }
  Pop-Location
  Remove-Item (Join-Path $EcomdropHome 'tmp') -Recurse -Force -ErrorAction SilentlyContinue
  Ok "SIE instalado en $SieDir"
  Instalar-LibsPython
  Info 'Dependencias de Node del SIE (Playwright)…'
  Push-Location $SieDir
  $env:PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD = '1'
  Correr 'npm install falló en el SIE' { npm install --no-audit --no-fund }
  Remove-Item env:PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD
  Pop-Location
  Ok 'Dependencias del SIE instaladas'
}

function Paso-playwright {
  Titulo 'Navegador de pruebas (Playwright + Chromium)'
  if (-not (Test-Path (Join-Path $SieDir 'node_modules\playwright'))) { Fallo 'Primero instala el SIE (paso «sie»).' }
  Push-Location $SieDir
  Correr 'No se pudo descargar Chromium para Playwright' { npx playwright install chromium }
  Pop-Location
  Ok 'Chromium listo'
}

function Paso-config {
  Titulo 'Configurar Claude Code'
  if (-not (Tiene claude)) { Paso-claude }
  Correr 'No se pudo configurar Claude Code' { node (Join-Path $Kit 'scripts\configurar-claude.mjs') --kit $Kit --sie $SieDir --env (Join-Path $EcomdropHome '.env') }
  New-Item -ItemType Directory -Force -Path $LocalBin -ErrorAction Stop | Out-Null
  if (Test-Path (Join-Path $Kit 'doctor')) {
    $destino = Join-Path $EcomdropHome 'doctor'
    Remove-Item $destino -Recurse -Force -ErrorAction SilentlyContinue
    Copy-Item (Join-Path $Kit 'doctor') $destino -Recurse -ErrorAction Stop
  }
  # Cada comando va en dos versiones: .cmd (PowerShell y cmd) y sin extensión (Git Bash, que es la terminal de Claude).
  $doctorJs = (Join-Path $EcomdropHome 'doctor\bin\ecomdrop-doctor.mjs')
  $servidorJs = (Join-Path $Kit 'asistente\servidor.mjs')
  $ps1 = (Join-Path $Kit 'scripts\setup.ps1')
  $iex = "[Console]::OutputEncoding=[Text.Encoding]::UTF8; iex ([IO.File]::ReadAllText('$($ps1 -replace "'", "''")', [Text.Encoding]::UTF8)); exit `$global:ECOMDROP_CODIGO"
  $comandos = @{
    'ecomdrop-doctor'    = @{ cmd = "@echo off`r`nnode `"$doctorJs`" %*";  sh = "exec node '$($doctorJs -replace '\\', '/')' `"`$@`"" }
    'ecomdrop-asistente' = @{ cmd = "@echo off`r`nnode `"$servidorJs`" %*"; sh = "exec node '$($servidorJs -replace '\\', '/')' `"`$@`"" }
    'ecomdrop-paso'      = @{
      cmd = "@echo off`r`nset ECOMDROP_PASO=%1`r`nset ECOMDROP_KIT=$Kit`r`npowershell -NoProfile -ExecutionPolicy Bypass -Command `"$iex`""
      sh  = "ECOMDROP_PASO=`"`$1`" ECOMDROP_KIT='$Kit' exec powershell.exe -NoProfile -ExecutionPolicy Bypass -Command `"$($iex -replace '\$', '\$')`""
    }
  }
  foreach ($n in $comandos.Keys) {
    Set-Content -Encoding ASCII -ErrorAction Stop -Path (Join-Path $LocalBin "$n.cmd") -Value $comandos[$n].cmd
    # Git Bash necesita saltos de línea LF
    [IO.File]::WriteAllText((Join-Path $LocalBin $n), "#!/usr/bin/env bash`n$($comandos[$n].sh)`n")
  }
  Agregar-PathUsuario $LocalBin
  Ok 'Comandos ecomdrop-doctor, ecomdrop-paso y ecomdrop-asistente disponibles'
}

function Paso-doctor {
  Titulo 'Revisión final'
  $doctor = Join-Path $EcomdropHome 'doctor\bin\ecomdrop-doctor.mjs'
  if (-not (Test-Path $doctor)) { $doctor = Join-Path $Kit 'doctor\bin\ecomdrop-doctor.mjs' }
  if (Test-Path $doctor) {
    node $doctor --sistema
    # el doctor devuelve 1 si encuentra problemas: se muestran, pero no detienen el instalador
    if ($LASTEXITCODE -ne 0) { Aviso 'La revisión encontró cosas por resolver (arriba). Usa «ecomdrop-doctor --sistema --fix» o la skill /setup-proyecto.'; $global:LASTEXITCODE = 0 }
  }
  else { Aviso 'No hay doctor instalado todavía.' }
}

function Paso-limpieza {
  Titulo 'Limpieza del instalador'
  # el kit se conserva: lo usan ecomdrop-paso y ecomdrop-asistente (y su código ya es público)
  foreach ($d in 'src', 'tmp') { Remove-Item (Join-Path $EcomdropHome $d) -Recurse -Force -ErrorAction SilentlyContinue }
  Get-ChildItem (Join-Path $EcomdropHome 'logs') -File -ErrorAction SilentlyContinue | Where-Object { $_.FullName -ne $Log } | Remove-Item -Force
  Ok 'Descargas temporales y logs anteriores borrados'
  $script:BorrarLog = $true
}

# ───────────────────────── principal ─────────────────────────
function Cerrar-Log {
  try { Stop-Transcript | Out-Null } catch {}
  if ($script:BorrarLog) { Remove-Item $Log -Force -ErrorAction SilentlyContinue }
}

function Principal {
  if ($env:OS -eq 'Windows_NT') { Asegurar-PoliticaScripts }
  Recargar-Path
  $script:Kit = Ubicar-Kit

  if ($Paso) {
    $f = Get-Command "Paso-$Paso" -ErrorAction SilentlyContinue
    if (-not $f) { Fallo "Paso desconocido: $Paso" }
    & $f
    return
  }

  Write-Host ""; Write-Host "Ecomdrop Bootcamp · Instalador  (Windows $([Environment]::OSVersion.Version), $env:PROCESSOR_ARCHITECTURE)" -ForegroundColor White
  Write-Host "Log: $Log"
  Paso-base
  Paso-node

  if ($Modo -eq 'asistente') {
    Titulo 'Asistente de instalación'
    Info 'Se abrirá tu navegador. Sigue las pestañas en orden; esta ventana debe quedar abierta.'
    node (Join-Path $Kit 'asistente\servidor.mjs')
    $global:ECOMDROP_CODIGO = $LASTEXITCODE
    return
  }

  if ($Modo -eq 'minimo') {
    Paso-claude
    Paso-config
    Write-Host ""; Write-Host '✔ Listo lo básico. Ahora Claude instala el resto contigo:' -ForegroundColor Green
    Write-Host ""
    Write-Host '   1. Inicia sesión con tu cuenta de claude.ai (Pro o Max) cuando Claude lo pida.'
    Write-Host '   2. Escribe:  /ecomdrop-bootcamp:instalar' -ForegroundColor White
    Write-Host ""
    Write-Host '   Si cierras esta ventana: abre una PowerShell nueva, escribe  claude  y sigue desde el paso 2.'
    Write-Host ""
    if (-not $env:CI) {
      Cerrar-Log
      Set-Location $Inicio
      claude
    }
    return
  }

  foreach ($p in 'python', 'gh', 'claude', 'media', 'modelo', 'shopify', 'sie', 'playwright', 'config', 'doctor') {
    if ($p -eq 'sie' -and -not $env:ECOMDROP_SIE_TARBALL -and -not $env:GH_TOKEN) {
      & gh auth status *> $null
      if ($LASTEXITCODE -ne 0) { Aviso 'Sin sesión de GitHub ni ECOMDROP_SIE_TARBALL: se salta la instalación del SIE.'; continue }
    }
    if ($p -eq 'playwright' -and -not (Test-Path (Join-Path $SieDir 'node_modules\playwright'))) { Aviso 'El SIE instalado no usa Playwright: se salta.'; continue }
    & (Get-Command "Paso-$p")
  }
  Write-Host ""; Write-Host '✔ Instalación terminada. Abre una PowerShell nueva para que se carguen node, uv y claude.' -ForegroundColor Green
}

try {
  Principal
} catch {
  if ("$_" -ne 'ECOMDROP_FALLO') {
    $global:ECOMDROP_CODIGO = 1
    Write-Host ""; Write-Host "  ✖ Error inesperado: $($_.Exception.Message) (línea $($_.InvocationInfo.ScriptLineNumber))" -ForegroundColor Red
    Write-Host "  Log completo: $Log"
    Write-Host "  Envía ese archivo a soporte del bootcamp."; Write-Host ""
  }
} finally {
  Cerrar-Log
}
# Solo al ejecutarlo como archivo (-File): ahí «exit» termina el script, no la ventana.
if ($PSCommandPath) { exit $global:ECOMDROP_CODIGO }

---
description: Explica cómo actualizar el kit, el SIE y las tiendas a la última versión del bootcamp
allowed-tools: Bash(ecomdrop-doctor:*), Bash(git -C:*), Read
---

Guía al estudiante para actualizar, en este orden, y ejecuta lo que puedas tú:

1. **Kit y SIE** (herramientas, configuración de Claude Code, plugin y última versión del SIE): pídele que vuelva a
   ejecutar el comando de una línea del bootcamp en una terminal. Es idempotente: solo instala lo que cambió.
   - macOS / Linux: `curl -fsSL https://raw.githubusercontent.com/Mercaline2024/ecomdrop-bootcamp-kit/main/scripts/setup.sh | bash`
   - Windows (PowerShell): `irm https://raw.githubusercontent.com/Mercaline2024/ecomdrop-bootcamp-kit/main/scripts/setup.ps1 | iex`
2. **Cada tienda**: dentro de la carpeta de la tienda, `bash sie/bin/actualizar-tienda.sh` (trae la versión nueva del
   SIE instalada en el paso 1). Si la tienda tiene cambios sin guardar en `sie/`, avísale antes.
3. **Revisión**: `ecomdrop-doctor` en la tienda para confirmar que todo quedó bien.

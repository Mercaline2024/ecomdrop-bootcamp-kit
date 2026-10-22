---
description: Genera el reporte para enviar a soporte del bootcamp (sin claves ni datos privados)
allowed-tools: Bash(ecomdrop-doctor:*), Bash(node:*)
---

Genera el reporte de soporte del proyecto actual:

```bash
ecomdrop-doctor --report
```

(si no está en el PATH: `node ~/.ecomdrop/doctor/bin/ecomdrop-doctor.mjs --report`).

Muestra el bloque completo dentro de un bloque de código, tal cual, para que el estudiante lo copie. Antes del bloque,
en una frase, dile que lo pegue en el chat de soporte del bootcamp junto con lo que estaba intentando hacer.
No añadas al reporte valores del `.env`, tokens ni rutas completas de su carpeta personal.

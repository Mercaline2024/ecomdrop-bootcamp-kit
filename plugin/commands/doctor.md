---
description: Revisa el proyecto actual (o todo el equipo con «sistema») y dice qué falta para que funcione
argument-hint: "[sistema] [fix]"
allowed-tools: Bash(ecomdrop-doctor:*), Bash(node:*), Read
---

Ejecuta el doctor del Ecomdrop Bootcamp y explícale al estudiante el resultado en español, en pocas líneas.

- Si los argumentos incluyen «sistema», revisa el equipo: `ecomdrop-doctor --sistema`. Si no, el proyecto actual: `ecomdrop-doctor`.
- Si incluyen «fix», añade `--fix` y cuenta qué se instaló.
- Si `ecomdrop-doctor` no está en el PATH, usa `node ~/.ecomdrop/doctor/bin/ecomdrop-doctor.mjs` con los mismos argumentos.

Argumentos: $ARGUMENTS

Después lee `.ecomdrop/doctor-report.json` (o `~/.ecomdrop/doctor-report.json` en modo sistema) y resume:
1. si está listo o no,
2. los errores, cada uno con su arreglo,
3. qué se arregla solo con `/ecomdrop-bootcamp:doctor fix` y qué necesita al estudiante.

Si quedan problemas que el doctor no resuelve solo, ofrece ejecutar la skill `/setup-proyecto`.

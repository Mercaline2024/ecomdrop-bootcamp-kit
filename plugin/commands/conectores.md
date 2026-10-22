---
description: Comprueba qué conectores (Shopify, Meta, Dropi, Ecomdrop…) están listos y guía los que faltan
allowed-tools: Bash(claude mcp list), Read
---

Ejecuta `claude mcp list` y compara con esta tabla. Responde en español con una tabla corta: conector, estado y,
si falta, el paso exacto para conectarlo.

| Conector | Para quién | Cómo se conecta |
|---|---|---|
| `claude.ai Shopify` | todos (obligatorio) | claude.ai → Ajustes → Conectores → Shopify |
| `claude.ai Facebook meta ADS` | todos (obligatorio) | Conector personalizado, nombre exacto «Facebook meta ADS», URL `https://mcp.facebook.com/ads` |
| `plugin:ecomdrop-bootcamp:dropi` | todos | MCP oficial de Dropi: `/mcp` → dropi → Authenticate con la cuenta de Dropi |
| `dropkiller` | todos (opcional) | `/mcp` → dropkiller → Authenticate |
| `apify` | todos (opcional) | Guardar `APIFY_TOKEN` en el asistente de instalación |
| `playwright` | todos | No necesita sesión |
| `claude.ai Admin_MCP_Ecomdrop`, `claude.ai ecomdrop`, `claude.ai MCp dropi- Ecomdrop` | **solo clientes de la plataforma Ecomdrop** | Conector personalizado con ese nombre exacto (URLs en la documentación del kit) |

Reglas:
- Si un conector de claude.ai no aparece, recuerda que Claude Code debe haber iniciado sesión con la cuenta de claude.ai, no con una API key.
- «Needs authentication» = está agregado pero falta iniciar sesión.
- Los de Ecomdrop no son un error si el estudiante no usa esa plataforma: dilo explícitamente.

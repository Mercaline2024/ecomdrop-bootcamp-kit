# Conectores que usan las skills del SIE

Hay dos clases:

- **MCP locales**: los instala el kit en Claude Code. El estudiante solo inicia sesión. `playwright`, `dropkiller` y
  `apify` se registran como servidores de usuario (`config/mcp.template.json`) porque las skills del SIE los llaman por
  ese nombre; el MCP oficial de Dropi viene dentro del plugin `ecomdrop-bootcamp` (`plugin/.mcp.json`).
- **Conectores de claude.ai**: van ligados a la **cuenta de claude.ai** de cada estudiante. El kit no puede
  instalarlos; el asistente guía el proceso y lo comprueba con `claude mcp list`.

Requisito común: iniciar sesión en Claude Code con la cuenta de claude.ai (Pro, Max, Team o Enterprise), **no** con
una API key. Con una API key los conectores de claude.ai no aparecen.

## Para todos los estudiantes

| Conector | Dónde | Cómo se conecta | Herramientas que ve Claude Code |
|---|---|---|---|
| `Shopify` (**obligatorio**) | claude.ai | Directorio de conectores → Shopify | `mcp__claude_ai_Shopify__*` |
| `Facebook meta ADS` (**obligatorio**) | claude.ai | Conector personalizado → `https://mcp.facebook.com/ads` | `mcp__claude_ai_Facebook_meta_ADS__*` |
| `dropi` — **MCP oficial de Dropi** | plugin `ecomdrop-bootcamp` | En Claude Code: `/mcp` → dropi → *Authenticate* → inicia sesión con **tu cuenta de Dropi** | `mcp__plugin_ecomdrop-bootcamp_dropi__*` |
| `dropkiller` | local | `/mcp` → dropkiller → *Authenticate* | `mcp__dropkiller__*` |
| `apify` | local | Con `APIFY_TOKEN` (pestaña Claves del asistente) | `mcp__apify__*` |
| `playwright` | local | No necesita sesión | `mcp__playwright__*` |

El MCP oficial de Dropi (`https://mcp.dropi.co/mcp`) usa OAuth con registro dinámico: Claude Code abre el navegador,
el estudiante entra con su usuario de Dropi y autoriza. Cada estudiante ve solo sus propios pedidos y productos.

## Solo para quienes usan la plataforma Ecomdrop

Estos servidores autentican **únicamente** a clientes de Ecomdrop. Un estudiante que no usa la plataforma no puede
conectarlos (y no los necesita para el bootcamp).

| Nombre exacto en claude.ai | URL | Para qué | Herramientas |
|---|---|---|---|
| `Admin_MCP_Ecomdrop` | `https://admin.mcp.ecomdrop.app/mcp` | Contexto del bot de WhatsApp (edita) | `mcp__claude_ai_Admin_MCP_Ecomdrop__*` |
| `ecomdrop` | `https://mcp.ecomdrop.app` | Ventas del bot de WhatsApp | `mcp__claude_ai_ecomdrop__*` |
| `MCp dropi- Ecomdrop` | `https://mcp-dropi.ecomdrop.app` | Dropi a través de Ecomdrop (novedades, métricas) | `mcp__claude_ai_MCp_dropi-_Ecomdrop__*` |

**El nombre tiene que ser exactamente el de la tabla**: las skills llaman a las herramientas por ese nombre.
Agregar un conector personalizado: claude.ai → Ajustes → Conectores → *Agregar conector personalizado* → nombre y URL
→ *Conectar*.

## Diferencia entre los dos de Dropi

| | MCP oficial (`dropi`) | Vía Ecomdrop (`MCp dropi- Ecomdrop`) |
|---|---|---|
| Quién puede usarlo | Cualquier cuenta de Dropi | Solo clientes de Ecomdrop |
| Pedidos, ciudades, cotizar envío, huella del cliente | ✔ | ✔ |
| Novedades, métricas del negocio, integraciones | — | ✔ |

La skill `dropi-operaciones` del SIE está escrita hoy para el conector de Ecomdrop; con el MCP oficial funciona lo que
este expone (ver la tabla).

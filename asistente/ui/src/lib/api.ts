// Cliente del servidor local del asistente (asistente/servidor.mjs).
// El token llega inyectado en index.html; en desarrollo (vite) se toma de ?t= en la URL.

declare global {
  interface Window { __ECOMDROP_TOKEN__?: string }
}

const inyectado = window.__ECOMDROP_TOKEN__
export const TOKEN = inyectado && inyectado !== '__TOKEN__'
  ? inyectado
  : new URLSearchParams(location.search).get('t') ?? ''

export type EstadoPaso = 'pendiente' | 'corriendo' | 'ok' | 'error'

export interface Paso {
  id: string
  titulo: string
  detalle: string
  estado: EstadoPaso
}

export interface Info {
  demo: boolean
  sistema: { plataforma: string; arquitectura: string; version: string; node: string; usuario: string }
  rutas: { kit: string; proyectos: string; sie: string; envGlobal: string }
  pasos: Paso[]
  claves: Record<string, string>
}

export interface Conector {
  nombre: string
  obligatorio: boolean
  url?: string
  local?: boolean
  audiencia?: 'todos' | 'clientes-ecomdrop'
  nota?: string
  estado: 'conectado' | 'sin-login' | 'error' | 'falta'
}

export async function api<T = unknown>(ruta: string, opciones: RequestInit = {}): Promise<T> {
  const r = await fetch(ruta, {
    ...opciones,
    headers: { 'Content-Type': 'application/json', 'X-Ecomdrop-Token': TOKEN, ...(opciones.headers ?? {}) },
  })
  return r.json() as Promise<T>
}

export const post = <T = unknown>(ruta: string, cuerpo: unknown = {}) =>
  api<T>(ruta, { method: 'POST', body: JSON.stringify(cuerpo) })

/** Sigue la salida en vivo de un paso. Resuelve con el estado final. */
export function seguirLog(id: string, alRecibir: (linea: string) => void): Promise<EstadoPaso> {
  return new Promise((resolve) => {
    const fuente = new EventSource(`/api/pasos/${id}/log?t=${TOKEN}`)
    fuente.onmessage = (e) => alRecibir(JSON.parse(e.data).linea as string)
    fuente.addEventListener('fin', (e) => {
      fuente.close()
      resolve(JSON.parse((e as MessageEvent).data).estado as EstadoPaso)
    })
    fuente.onerror = () => { fuente.close(); resolve('error') }
  })
}

export type Nivel = 'debug' | 'info' | 'warn' | 'error' | 'success'

/** Clasifica una línea de setup.sh / setup.ps1 por su símbolo inicial. */
export function nivelDe(linea: string): Nivel {
  const t = linea.trim()
  if (/^(✔|✅)/.test(t)) return 'success'
  if (/^(✖|❌)/.test(t) || /\b(error|falló)\b/i.test(t)) return 'error'
  if (/^(!|⚠)/.test(t)) return 'warn'
  if (/^(━━|▶)/.test(t)) return 'info'
  return 'debug'
}

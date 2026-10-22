import * as React from 'react'
import { toast } from 'sonner'

import { Toaster } from '@/components/ui/sonner'
import { Firma, Lateral, type DefEtapa } from '@/components/asistente/lateral'
import { PanelChriss, type Turno } from '@/components/asistente/panel-chriss'
import {
  EtapaClaves, EtapaConectores, EtapaEquipo, EtapaFinal, EtapaHerramientas, EtapaTienda, type Linea,
} from '@/components/asistente/etapas'
import { api, post, seguirLog, TOKEN, type Conector, type EstadoPaso, type Info } from '@/lib/api'
import { BIENVENIDA, EVENTOS, PREGUNTAS_RAPIDAS, type Etapa, type Mensaje } from '@/lib/chriss'

const ETAPAS: DefEtapa[] = [
  { id: 'equipo', titulo: 'Tu equipo', descripcion: 'Lo que ya tienes instalado' },
  { id: 'herramientas', titulo: 'Herramientas', descripcion: 'Python, Claude Code, video y el SIE' },
  { id: 'claves', titulo: 'Claves', descripcion: 'kie.ai y Apify' },
  { id: 'conectores', titulo: 'Conectores', descripcion: 'Shopify, Meta, Dropi y WhatsApp' },
  { id: 'tienda', titulo: 'Tu tienda', descripcion: 'Tu carpeta de trabajo' },
  { id: 'final', titulo: 'Listo', descripcion: 'Revisión final' },
]

function leerGuardado<T>(clave: string, defecto: T): T {
  try { const v = localStorage.getItem(clave); return v ? (JSON.parse(v) as T) : defecto } catch { return defecto }
}
function guardar(clave: string, valor: unknown) {
  try { localStorage.setItem(clave, JSON.stringify(valor)) } catch { /* sin almacenamiento */ }
}

export default function App() {
  const [info, setInfo] = React.useState<Info | null>(null)
  const [error, setError] = React.useState(false)
  const [etapa, setEtapa] = React.useState<Etapa>(() => leerGuardado<Etapa>('ecomdrop-etapa', 'equipo'))
  const [completadas, setCompletadas] = React.useState<Set<Etapa>>(() => new Set(leerGuardado<Etapa[]>('ecomdrop-completadas', [])))
  const [mensaje, setMensaje] = React.useState<Mensaje>(BIENVENIDA[etapa])
  const [historial, setHistorial] = React.useState<Turno[]>([])
  const [pensando, setPensando] = React.useState(false)
  const [lineas, setLineas] = React.useState<Linea[]>([])
  const [lineasDoctor, setLineasDoctor] = React.useState<Linea[]>([])
  const [codigoGithub, setCodigoGithub] = React.useState<string | null>(null)
  const [instalandoTodo, setInstalandoTodo] = React.useState(false)
  const [conectores, setConectores] = React.useState<Conector[] | null>(null)
  const [comprobando, setComprobando] = React.useState(false)
  const [creando, setCreando] = React.useState(false)
  const [tienda, setTienda] = React.useState<{ ok: boolean; mensaje: string; ruta?: string; salida?: string } | null>(null)
  const [revisando, setRevisando] = React.useState(false)
  const [finalizado, setFinalizado] = React.useState(false)

  const cargar = React.useCallback(async () => {
    try { setInfo(await api<Info>('/api/info')) } catch { setError(true) }
  }, [])
  React.useEffect(() => { cargar() }, [cargar])

  const completar = React.useCallback((e: Etapa) => {
    setCompletadas((prev) => { const n = new Set(prev).add(e); guardar('ecomdrop-completadas', [...n]); return n })
  }, [])

  const ir = (e: Etapa) => {
    setEtapa(e); guardar('ecomdrop-etapa', e)
    setMensaje(BIENVENIDA[e]); setHistorial([])
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const siguiente = (desde: Etapa) => {
    completar(desde)
    const i = ETAPAS.findIndex((x) => x.id === desde)
    if (i < ETAPAS.length - 1) ir(ETAPAS[i + 1].id)
  }

  const marcarPaso = (id: string, estado: EstadoPaso) =>
    setInfo((inf) => (inf ? { ...inf, pasos: inf.pasos.map((p) => (p.id === id ? { ...p, estado } : p)) } : inf))

  const ejecutarPaso = async (id: string, destino: 'herramientas' | 'doctor' = 'herramientas') => {
    const paso = info?.pasos.find((p) => p.id === id)
    const titulo = paso?.titulo ?? id
    const agregar = destino === 'doctor' ? setLineasDoctor : setLineas
    marcarPaso(id, 'corriendo')
    agregar((l) => [...l, { texto: `▶ ${titulo}` }])
    await post(`/api/pasos/${id}`)
    const estado = await seguirLog(id, (linea) => {
      agregar((l) => [...l.slice(-400), { texto: linea }])
      const m = linea.match(/one-time code:\s*([A-Z0-9]{4}-[A-Z0-9]{4})/i)
      if (m) { setCodigoGithub(m[1]); setMensaje(EVENTOS.codigoGithub(m[1])) }
    })
    marcarPaso(id, estado)
    if (id === 'acceso') setCodigoGithub(null)
    if (destino === 'herramientas') setMensaje(estado === 'ok' ? EVENTOS.pasoOk(titulo) : EVENTOS.pasoError(titulo))
    return estado
  }

  const instalarTodo = async () => {
    if (!info) return
    setInstalandoTodo(true); setLineas([])
    for (const p of info.pasos.filter((x) => x.id !== 'doctor')) {
      if (p.estado === 'ok') continue
      const estado = await ejecutarPaso(p.id)
      if (estado !== 'ok') { setInstalandoTodo(false); return }
    }
    setInstalandoTodo(false)
    completar('herramientas')
    setMensaje(EVENTOS.todoOk())
    toast.success('Herramientas instaladas')
  }

  const preguntar = async (pregunta: string) => {
    setHistorial((h) => [...h, { de: 'chriss', texto: mensaje.texto }, { de: 'estudiante', texto: pregunta }])
    setMensaje(EVENTOS.pensando()); setPensando(true)
    try {
      const r = await post<{ respuesta: string }>('/api/chriss', { pregunta, etapa, registro: lineas.slice(-40).map((l) => l.texto) })
      setMensaje({ pose: 'escribiendo', texto: r.respuesta })
    } catch {
      setMensaje({ pose: 'escribiendo', texto: 'No pude responderte ahora. Revisa que el asistente siga abierto en la terminal.' })
    }
    setPensando(false)
  }

  if (error) {
    return <p className="p-8 text-muted-foreground">No pude conectarme con el asistente. Vuelve a abrir el enlace que mostró la terminal.</p>
  }
  if (!info) {
    return <div className="grid min-h-dvh place-items-center"><img src="chriss/esperando.webp" alt="Cargando" className="chriss-flota w-28" /></div>
  }

  return (
    <div className="min-h-dvh md:flex">
      <Toaster position="top-right" />
      <div className="border-b border-border p-4 md:border-b-0 md:p-0">
        <Lateral etapas={ETAPAS} actual={etapa} completadas={completadas} trabajando={instalandoTodo || creando || revisando} onIr={ir} />
      </div>

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6 md:px-10 md:py-10">
        {info.demo && (
          <div className="mb-4 rounded-md border border-warning/40 px-4 py-2 text-[13px] text-warning">
            Modo demostración: los pasos se simulan. No se instala, guarda ni borra nada.
          </div>
        )}

        <PanelChriss mensaje={mensaje} historial={historial} preguntas={PREGUNTAS_RAPIDAS[etapa]} ocupado={pensando} onPreguntar={preguntar} />

        <div className="mt-10" key={etapa}>
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            {etapa === 'equipo' && <EtapaEquipo info={info} onSeguir={() => siguiente('equipo')} />}
            {etapa === 'herramientas' && (
              <EtapaHerramientas
                pasos={info.pasos}
                lineas={lineas}
                codigoGithub={codigoGithub}
                instalandoTodo={instalandoTodo}
                onPaso={(id) => ejecutarPaso(id)}
                onTodo={instalarTodo}
                onAbrirGithub={async () => {
                  if (codigoGithub) await navigator.clipboard?.writeText(codigoGithub).catch(() => {})
                  await post('/api/pasos/acceso/entrada')
                  window.open('https://github.com/login/device', '_blank', 'noopener')
                }}
                onSeguir={() => siguiente('herramientas')}
              />
            )}
            {etapa === 'claves' && (
              <EtapaClaves
                guardadas={info.claves}
                rutaEnv={info.rutas.envGlobal}
                onProbar={async (servicio, valor) => {
                  const r = await post<{ ok: boolean; mensaje: string }>('/api/probar', { servicio, valor })
                  setMensaje(r.ok ? EVENTOS.claveOk() : EVENTOS.claveError())
                  return r
                }}
                onGuardar={async (valores) => {
                  await post('/api/claves', valores)
                  toast.success('Claves guardadas')
                  await ejecutarPaso('config')
                  await cargar()
                  if (valores.KIE_API_KEY || info.claves.KIE_API_KEY) completar('claves')
                }}
                onSeguir={() => siguiente('claves')}
              />
            )}
            {etapa === 'conectores' && (
              <EtapaConectores
                conectores={conectores}
                comprobando={comprobando}
                onComprobar={async () => {
                  setComprobando(true)
                  const r = await api<{ conectores?: Conector[]; error?: string }>('/api/conectores')
                  setComprobando(false)
                  if (r.error) { toast.error(r.error); return }
                  setConectores(r.conectores ?? [])
                  if ((r.conectores ?? []).filter((c) => c.obligatorio).every((c) => c.estado === 'conectado')) {
                    completar('conectores'); setMensaje(EVENTOS.conectoresOk())
                  }
                }}
                onSeguir={() => siguiente('conectores')}
              />
            )}
            {etapa === 'tienda' && (
              <EtapaTienda
                creando={creando}
                resultado={tienda}
                onCrear={async (d) => {
                  setCreando(true)
                  const r = await post<{ ok: boolean; mensaje: string; ruta?: string; salida?: string }>('/api/tienda', d)
                  setTienda(r); setCreando(false)
                  if (r.ok) { completar('tienda'); setMensaje(EVENTOS.tiendaOk()) }
                }}
              />
            )}
            {etapa === 'final' && (
              <EtapaFinal
                resumen={ETAPAS.slice(0, -1).map((e) => ({ titulo: e.titulo, hecho: completadas.has(e.id) }))}
                lineasDoctor={lineasDoctor}
                revisando={revisando}
                finalizado={finalizado}
                onDoctor={async () => {
                  setRevisando(true); setLineasDoctor([])
                  const estado = await ejecutarPaso('doctor', 'doctor')
                  setRevisando(false)
                  if (estado === 'ok') completar('final')
                }}
                onReporte={async () => {
                  const texto = [
                    'Reporte de instalación · Ecomdrop Bootcamp',
                    `Sistema: ${info.sistema.plataforma} ${info.sistema.arquitectura} · Node ${info.sistema.node}`,
                    '', 'Pasos:', ...info.pasos.map((p) => `- ${p.titulo}: ${p.estado}`),
                    '', 'Revisión:', ...(lineasDoctor.length ? lineasDoctor.map((l) => l.texto) : ['(sin ejecutar)']),
                  ].join('\n')
                  await navigator.clipboard?.writeText(texto)
                  toast.success('Reporte copiado: pégalo en el chat de soporte')
                }}
                onFinalizar={async () => {
                  await post('/api/finalizar', { limpiar: true })
                  setFinalizado(true)
                  setMensaje({ pose: 'celebrando', texto: '¡Listo! Cerré el asistente y borré el instalador. Ya puedes cerrar esta pestaña. ¡Nos vemos en el bootcamp!' })
                }}
              />
            )}
          </div>
        </div>

        <Firma className="mt-16 border-t border-border pt-6 md:hidden" />
        <p className="sr-only">Sesión {TOKEN ? 'autenticada' : 'sin token'}</p>
      </main>
    </div>
  )
}

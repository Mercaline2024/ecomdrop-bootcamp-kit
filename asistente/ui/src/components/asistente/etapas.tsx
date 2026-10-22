import * as React from 'react'
import {
  ArrowRight, CircleCheck, CircleAlert, Copy, ExternalLink, KeyRound, LoaderCircle, Play, RotateCcw, ShieldCheck, Store, Trash2,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { LogLine, LogViewer } from '@/components/ui/log-viewer'
import { Progress } from '@/components/ui/progress'
import { nivelDe, type Conector, type Info, type Paso } from '@/lib/api'
import { cn } from '@/lib/utils'

export interface Linea { texto: string }

const NOMBRE_SO: Record<string, string> = { darwin: 'macOS', win32: 'Windows', linux: 'Linux' }

export function Encabezado({ eyebrow, titulo, descripcion }: { eyebrow: string; titulo: string; descripcion: string }) {
  return (
    <header className="mb-6">
      <p className="text-[11.5px] font-bold uppercase tracking-[0.14em] text-primary">{eyebrow}</p>
      <h1 className="mt-2 text-[30px] font-bold leading-[1.1] tracking-[-0.02em] md:text-[38px]">{titulo}</h1>
      <p className="mt-2 max-w-2xl text-[16px] leading-relaxed text-muted-foreground">{descripcion}</p>
    </header>
  )
}

export function Registro({ lineas, className }: { lineas: Linea[]; className?: string }) {
  if (!lineas.length) return null
  return (
    <LogViewer className={cn('max-h-80 bg-[#05060a]', className)}>
      {lineas.map((l, i) => {
        const nivel = nivelDe(l.texto)
        return (
          <LogLine key={i} level={nivel} className={nivel === 'info' ? 'mt-2 font-semibold' : ''}>
            {l.texto.replace(/^\s*(✔|✖|→|!|━━|▶)\s?/, '')}
          </LogLine>
        )
      })}
    </LogViewer>
  )
}

// ───────────── 1. Tu equipo ─────────────
export function EtapaEquipo({ info, onSeguir }: { info: Info; onSeguir: () => void }) {
  const s = info.sistema
  const filas = [
    ['Sistema', `${NOMBRE_SO[s.plataforma] ?? s.plataforma} · ${s.arquitectura}`],
    ['Usuario', s.usuario],
    ['Node.js', s.node],
    ['Carpeta de proyectos', info.rutas.proyectos],
    ['Aquí vivirá el SIE', info.rutas.sie],
  ]
  return (
    <>
      <Encabezado eyebrow="Paso 1" titulo="Tu equipo" descripcion="El instalador ya dejó listos Git, Node.js y el gestor de paquetes. Esto es lo que encontró." />
      <Card>
        <CardContent className="divide-y divide-border p-0">
          {filas.map(([k, v]) => (
            <div key={k} className="flex flex-col gap-1 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-[14px] text-muted-foreground">{k}</span>
              <span className="break-all font-mono text-[13px]">{v}</span>
            </div>
          ))}
        </CardContent>
      </Card>
      <div className="mt-6 flex justify-end">
        <Button onClick={onSeguir}>Continuar <ArrowRight className="size-4" /></Button>
      </div>
    </>
  )
}

// ───────────── 2. Herramientas ─────────────
const ETIQUETA: Record<Paso['estado'], string> = { pendiente: 'Pendiente', corriendo: 'Instalando', ok: 'Listo', error: 'Falló' }

export function EtapaHerramientas({
  pasos, lineas, codigoGithub, instalandoTodo, onPaso, onTodo, onAbrirGithub, onSeguir,
}: {
  pasos: Paso[]
  lineas: Linea[]
  codigoGithub: string | null
  instalandoTodo: boolean
  onPaso: (id: string) => void
  onTodo: () => void
  onAbrirGithub: () => void
  onSeguir: () => void
}) {
  const lista = pasos.filter((p) => p.id !== 'doctor')
  const listos = lista.filter((p) => p.estado === 'ok').length
  return (
    <>
      <Encabezado eyebrow="Paso 2" titulo="Herramientas" descripcion="Cada paso se puede repetir sin riesgo: lo que ya está instalado se salta." />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="text-[13px] tabular-nums text-muted-foreground">{listos} de {lista.length} listos</span>
          <Progress value={(listos / lista.length) * 100} className="h-1.5 w-40" />
        </div>
        <div className="flex gap-2">
          <Button onClick={onTodo} disabled={instalandoTodo}>
            {instalandoTodo ? <LoaderCircle className="size-4 animate-spin" /> : <Play className="size-4" />}
            {instalandoTodo ? 'Instalando…' : 'Instalar todo'}
          </Button>
          <Button variant="outline" onClick={onSeguir}>Siguiente <ArrowRight className="size-4" /></Button>
        </div>
      </div>

      {codigoGithub && (
        <Card className="mb-4 border-primary/60 bg-accent">
          <CardContent className="flex flex-col items-center gap-4 py-6 text-center">
            <p className="text-[14px] text-accent-foreground">Copia este código y pégalo en GitHub para autorizar el acceso al SIE</p>
            <p className="font-mono text-[34px] font-bold tracking-[0.25em]">{codigoGithub}</p>
            <div className="flex gap-2">
              <Button onClick={onAbrirGithub}><ExternalLink className="size-4" /> Abrir GitHub</Button>
              <Button variant="outline" onClick={() => navigator.clipboard?.writeText(codigoGithub)}><Copy className="size-4" /> Copiar</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <ul className="grid gap-2">
        {lista.map((p, i) => (
          <li key={p.id}>
            <div
              className={cn(
                'flex items-start gap-3 rounded-lg border bg-card p-4 transition-colors',
                p.estado === 'corriendo' ? 'border-primary/70' : p.estado === 'error' ? 'border-destructive/70' : 'border-border',
              )}
            >
              <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center text-[13px] font-medium text-muted-foreground">
                {p.estado === 'ok' ? <CircleCheck className="size-5 text-success" />
                  : p.estado === 'corriendo' ? <LoaderCircle className="size-5 animate-spin text-primary" />
                  : p.estado === 'error' ? <CircleAlert className="size-5 text-destructive" />
                  : `${i + 1}.`}
              </span>
              <div className="min-w-0 flex-1">
                <h3 className={cn('font-medium', p.estado === 'ok' && 'text-muted-foreground')}>{p.titulo}</h3>
                <p className="mt-0.5 text-[14px] leading-6 text-muted-foreground">{p.detalle}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge
                  variant="outline"
                  className={cn(
                    'hidden sm:inline-flex',
                    p.estado === 'ok' && 'border-success/40 text-success',
                    p.estado === 'error' && 'border-destructive/50 text-destructive',
                    p.estado === 'corriendo' && 'border-primary/50 text-accent-foreground',
                  )}
                >
                  {ETIQUETA[p.estado]}
                </Badge>
                <Button size="sm" variant="ghost" onClick={() => onPaso(p.id)} disabled={p.estado === 'corriendo'} aria-label={`Ejecutar ${p.titulo}`}>
                  {p.estado === 'error' ? <RotateCcw className="size-4" /> : <Play className="size-4" />}
                </Button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <Registro lineas={lineas} className="mt-4" />
    </>
  )
}

// ───────────── 3. Claves ─────────────
const CLAVES = [
  { id: 'KIE_API_KEY', titulo: 'kie.ai', obligatoria: true, ayuda: 'Imágenes, voz, música y video.', enlace: 'https://kie.ai', donde: 'kie.ai → API Keys' },
  { id: 'APIFY_TOKEN', titulo: 'Apify', obligatoria: false, ayuda: 'Voz del cliente en investigar-producto.', enlace: 'https://console.apify.com/settings/integrations', donde: 'console.apify.com → Integrations' },
]

export function EtapaClaves({
  guardadas, rutaEnv, onProbar, onGuardar, onSeguir,
}: {
  guardadas: Record<string, string>
  rutaEnv: string
  onProbar: (id: string, valor: string) => Promise<{ ok: boolean; mensaje: string }>
  onGuardar: (valores: Record<string, string>) => Promise<void>
  onSeguir: () => void
}) {
  const [valores, setValores] = React.useState<Record<string, string>>({})
  const [resultado, setResultado] = React.useState<Record<string, { ok: boolean; mensaje: string } | 'probando'>>({})
  const [guardando, setGuardando] = React.useState(false)

  return (
    <>
      <Encabezado eyebrow="Paso 3" titulo="Tus claves" descripcion="Se guardan solo en este equipo y únicamente tu usuario puede leerlas. Nunca se suben a git." />
      <div className="grid gap-4">
        {CLAVES.map((c) => {
          const r = resultado[c.id]
          return (
            <Card key={c.id}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-[17px]">
                  <KeyRound className="size-4 text-primary" /> {c.titulo}
                  <Badge variant={c.obligatoria ? 'default' : 'secondary'}>{c.obligatoria ? 'Obligatoria' : 'Opcional'}</Badge>
                  {guardadas[c.id] && <Badge variant="outline" className="border-success/40 text-success">Guardada {guardadas[c.id]}</Badge>}
                </CardTitle>
                <CardDescription>
                  {c.ayuda} Consíguela en <a className="text-accent-foreground underline-offset-4 hover:underline" href={c.enlace} target="_blank" rel="noreferrer">{c.donde}</a>.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Label htmlFor={c.id} className="sr-only">{c.id}</Label>
                <div className="flex gap-2">
                  <Input
                    id={c.id}
                    type="password"
                    autoComplete="off"
                    placeholder={guardadas[c.id] ? 'Escribe para reemplazarla' : `Pega tu ${c.id}`}
                    value={valores[c.id] ?? ''}
                    onChange={(e) => setValores((v) => ({ ...v, [c.id]: e.target.value }))}
                    className="font-mono"
                  />
                  <Button
                    variant="outline"
                    disabled={r === 'probando'}
                    onClick={async () => {
                      setResultado((x) => ({ ...x, [c.id]: 'probando' }))
                      const res = await onProbar(c.id, valores[c.id] ?? '')
                      setResultado((x) => ({ ...x, [c.id]: res }))
                    }}
                  >
                    {r === 'probando' ? <LoaderCircle className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />} Probar
                  </Button>
                </div>
                {r && r !== 'probando' && (
                  <p className={cn('mt-2 text-[13px]', r.ok ? 'text-success' : 'text-destructive')}>{r.mensaje}</p>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
      <p className="mt-4 text-[13px] text-muted-foreground">Archivo: <span className="font-mono">{rutaEnv}</span></p>
      <div className="mt-6 flex justify-end gap-2">
        <Button
          disabled={guardando || !Object.values(valores).some((v) => v.trim())}
          onClick={async () => { setGuardando(true); await onGuardar(valores); setValores({}); setGuardando(false) }}
        >
          {guardando && <LoaderCircle className="size-4 animate-spin" />} Guardar claves
        </Button>
        <Button variant="outline" onClick={onSeguir}>Siguiente <ArrowRight className="size-4" /></Button>
      </div>
    </>
  )
}

// ───────────── 4. Conectores ─────────────
const ESTADO_CON: Record<Conector['estado'], { texto: string; clase: string }> = {
  conectado: { texto: 'Conectado', clase: 'border-success/40 text-success' },
  'sin-login': { texto: 'Falta iniciar sesión', clase: 'border-warning/50 text-warning' },
  error: { texto: 'Error', clase: 'border-destructive/50 text-destructive' },
  falta: { texto: 'No agregado', clase: 'text-muted-foreground' },
}

export function EtapaConectores({
  conectores, comprobando, onComprobar, onSeguir,
}: {
  conectores: Conector[] | null
  comprobando: boolean
  onComprobar: () => void
  onSeguir: () => void
}) {
  const pasos = [
    <>En una terminal ejecuta <code className="font-mono text-accent-foreground">claude</code> e inicia sesión con tu cuenta de claude.ai (no con una API key).</>,
    <>En <a className="text-accent-foreground underline-offset-4 hover:underline" href="https://claude.ai/settings/connectors" target="_blank" rel="noreferrer">claude.ai → Ajustes → Conectores</a> agrega cada conector con el <b>nombre exacto</b> y la URL de la tabla.</>,
    <>Para los locales (<b>dropi</b> y <b>dropkiller</b>): en Claude Code escribe <code className="font-mono text-accent-foreground">/mcp</code>, elige el servidor y pulsa Authenticate. El de Dropi te pide entrar con tu cuenta de Dropi.</>,
  ]
  return (
    <>
      <Encabezado eyebrow="Paso 4" titulo="Conectores" descripcion="Unen a Claude con tu tienda, tus anuncios y tus proveedores. Van ligados a tu cuenta de claude.ai." />
      <ol className="mb-6 grid gap-3">
        {pasos.map((p, i) => (
          <li key={i} className="flex gap-3 text-[15px] leading-relaxed">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent text-[12px] font-semibold text-accent-foreground">{i + 1}</span>
            <span>{p}</span>
          </li>
        ))}
      </ol>

      {[
        { titulo: 'Para todos', descripcion: 'Shopify y Meta Ads son obligatorios. Dropi es el MCP oficial: entras con tu cuenta de Dropi.', filtro: (c: Conector) => c.audiencia !== 'clientes-ecomdrop' },
        { titulo: 'Solo si usas la plataforma Ecomdrop', descripcion: 'Estos servidores solo autentican a clientes de Ecomdrop. Si no usas la plataforma, sáltalos.', filtro: (c: Conector) => c.audiencia === 'clientes-ecomdrop' },
      ].map((grupo) => (
        <section key={grupo.titulo} className="mb-6">
          <h2 className="text-[15px] font-semibold">{grupo.titulo}</h2>
          <p className="mb-3 mt-1 text-[13px] text-muted-foreground">{grupo.descripcion}</p>
          <Card className="overflow-hidden p-0">
            <div className="divide-y divide-border">
              {(conectores ?? []).filter(grupo.filtro).map((c) => (
                <div key={c.nombre} className="grid gap-2 px-5 py-4 sm:grid-cols-[1fr_auto] sm:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[14px]">{c.nombre}</span>
                      {c.obligatorio && <Badge variant="secondary" className="bg-accent text-accent-foreground">Obligatorio</Badge>}
                      {c.audiencia === 'clientes-ecomdrop' && <Badge variant="outline" className="text-muted-foreground">Clientes de Ecomdrop</Badge>}
                      <span className="text-[12px] text-muted-foreground">{c.local ? 'Claude Code (local)' : 'claude.ai'}</span>
                    </div>
                    {c.nota && <p className="mt-0.5 text-[13px] text-muted-foreground">{c.nota}</p>}
                    {c.url && (
                      <button type="button" onClick={() => navigator.clipboard?.writeText(c.url!)} className="mt-1 flex items-center gap-1.5 font-mono text-[12.5px] text-muted-foreground hover:text-foreground" title="Copiar URL">
                        {c.url} <Copy className="size-3" />
                      </button>
                    )}
                  </div>
                  <Badge variant="outline" className={cn('justify-self-start sm:justify-self-end', ESTADO_CON[c.estado].clase)}>{ESTADO_CON[c.estado].texto}</Badge>
                </div>
              ))}
              {!conectores && <p className="px-5 py-6 text-[14px] text-muted-foreground">Pulsa «Comprobar» cuando los hayas conectado.</p>}
            </div>
          </Card>
        </section>
      ))}

      <div className="mt-6 flex justify-end gap-2">
        <Button onClick={onComprobar} disabled={comprobando}>
          {comprobando && <LoaderCircle className="size-4 animate-spin" />} {comprobando ? 'Consultando a Claude Code…' : 'Comprobar conectores'}
        </Button>
        <Button variant="outline" onClick={onSeguir}>Siguiente <ArrowRight className="size-4" /></Button>
      </div>
    </>
  )
}

// ───────────── 5. Tu tienda ─────────────
const CAMPOS = [
  { id: 'slug', etiqueta: 'Nombre corto', ayuda: 'La carpeta, sin espacios', ejemplo: 'mi-tienda' },
  { id: 'marca', etiqueta: 'Marca', ayuda: 'Como la ven tus clientes', ejemplo: 'Mi Tienda' },
  { id: 'dominio', etiqueta: 'Dominio', ayuda: 'Si aún no tienes, déjalo vacío', ejemplo: 'mitienda.com' },
  { id: 'pais', etiqueta: 'País', ayuda: 'CO, GT, MX…', ejemplo: 'CO' },
  { id: 'moneda', etiqueta: 'Moneda', ayuda: 'COP, GTQ, MXN…', ejemplo: 'COP' },
  { id: 'whatsapp', etiqueta: 'WhatsApp', ayuda: 'Con indicativo, solo números', ejemplo: '573001234567' },
]

export function EtapaTienda({
  creando, resultado, onCrear,
}: {
  creando: boolean
  resultado: { ok: boolean; mensaje: string; ruta?: string; salida?: string } | null
  onCrear: (d: Record<string, string>) => void
}) {
  const [datos, setDatos] = React.useState<Record<string, string>>({})
  return (
    <>
      <Encabezado eyebrow="Paso 5" titulo="Tu primera tienda" descripcion="Creo la carpeta de trabajo con el SIE, tus claves y un tienda.json inicial. El resto lo completa la skill nueva-tienda desde los conectores." />
      <Card>
        <CardContent className="grid gap-5 pt-6 sm:grid-cols-2">
          {CAMPOS.map((c) => (
            <div key={c.id} className="grid gap-1.5">
              <Label htmlFor={`t-${c.id}`}>{c.etiqueta}</Label>
              <Input id={`t-${c.id}`} placeholder={c.ejemplo} value={datos[c.id] ?? ''} onChange={(e) => setDatos((d) => ({ ...d, [c.id]: e.target.value }))} />
              <p className="text-[12px] text-muted-foreground">{c.ayuda}</p>
            </div>
          ))}
        </CardContent>
      </Card>
      <div className="mt-6 flex justify-end">
        <Button disabled={creando || !datos.slug?.trim()} onClick={() => onCrear(datos)}>
          {creando ? <LoaderCircle className="size-4 animate-spin" /> : <Store className="size-4" />} Crear tienda
        </Button>
      </div>
      {resultado && (
        <div className="mt-4">
          <Registro lineas={[...(resultado.salida ?? '').split('\n').filter(Boolean).map((texto) => ({ texto })), { texto: `${resultado.ok ? '✔' : '✖'} ${resultado.mensaje}` }]} />
          {resultado.ok && resultado.ruta && (
            <Card className="mt-4 border-primary/50 bg-accent">
              <CardContent className="py-5 text-[15px]">
                Para empezar: <code className="font-mono text-accent-foreground">cd "{resultado.ruta}"</code> y luego <code className="font-mono text-accent-foreground">claude</code> → «da de alta esta tienda».
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </>
  )
}

// ───────────── 6. Listo ─────────────
export function EtapaFinal({
  resumen, lineasDoctor, revisando, onDoctor, onReporte, onFinalizar, finalizado,
}: {
  resumen: { titulo: string; hecho: boolean }[]
  lineasDoctor: Linea[]
  revisando: boolean
  onDoctor: () => void
  onReporte: () => void
  onFinalizar: () => void
  finalizado: boolean
}) {
  const [confirmar, setConfirmar] = React.useState(false)
  const hechos = resumen.filter((r) => r.hecho).length
  return (
    <>
      <Encabezado eyebrow="Paso 6" titulo="Todo listo" descripcion="Una revisión final confirma que el equipo quedó bien. Si algo sale en rojo, copia el reporte y envíalo a soporte." />
      <Card>
        <CardHeader>
          <CardTitle className="text-[17px]">Tu instalación</CardTitle>
          <CardDescription>{hechos} de {resumen.length} pasos completados</CardDescription>
          <Progress value={(hechos / resumen.length) * 100} className="mt-2 h-1.5" />
        </CardHeader>
        <CardContent className="grid gap-3">
          {resumen.map((r) => (
            <label key={r.titulo} className="flex items-center gap-3 text-[15px]">
              <Checkbox checked={r.hecho} disabled aria-readonly className="data-[state=checked]:border-success data-[state=checked]:bg-success data-[state=checked]:text-[#08090c]" />
              <span className={cn(r.hecho ? 'text-muted-foreground line-through decoration-muted-foreground/50' : '')}>{r.titulo}</span>
            </label>
          ))}
        </CardContent>
      </Card>

      <div className="mt-6 flex flex-wrap gap-2">
        <Button onClick={onDoctor} disabled={revisando}>
          {revisando ? <LoaderCircle className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />} Ejecutar revisión
        </Button>
        <Button variant="outline" onClick={onReporte}><Copy className="size-4" /> Copiar reporte para soporte</Button>
      </div>
      <Registro lineas={lineasDoctor} className="mt-4" />

      <Card className="mt-8 border-warning/40">
        <CardContent className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[14px] leading-relaxed text-muted-foreground">
            Al terminar borro los archivos del instalador, las descargas temporales y los logs. Tu SIE, tus tiendas, tus claves y la configuración de Claude Code se quedan.
          </p>
          {finalizado ? (
            <Badge variant="outline" className="border-success/40 text-success">Asistente cerrado</Badge>
          ) : confirmar ? (
            <div className="flex shrink-0 gap-2">
              <Button variant="destructive" onClick={onFinalizar}><Trash2 className="size-4" /> Sí, limpiar</Button>
              <Button variant="ghost" onClick={() => setConfirmar(false)}>Cancelar</Button>
            </div>
          ) : (
            <Button variant="outline" className="shrink-0" onClick={() => setConfirmar(true)}>Terminar y limpiar</Button>
          )}
        </CardContent>
      </Card>
    </>
  )
}

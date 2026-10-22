import * as React from 'react'
import { ArrowUp, Sparkles } from 'lucide-react'

import { AiMessageBubble } from '@/components/ui/message-bubble'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Mensaje, Pose } from '@/lib/chriss'

export interface Turno { de: 'chriss' | 'estudiante'; texto: string }

const VELOCIDAD_MS = 14

/** Escribe el texto de a poco, como si Chriss lo estuviera tecleando. */
function useEscritura(texto: string) {
  const [visible, setVisible] = React.useState('')
  React.useEffect(() => {
    setVisible('')
    let i = 0
    const t = setInterval(() => {
      i += 2
      setVisible(texto.slice(0, i))
      if (i >= texto.length) clearInterval(t)
    }, VELOCIDAD_MS)
    return () => clearInterval(t)
  }, [texto])
  return { visible, escribiendo: visible.length < texto.length }
}

function AvatarChriss({ pose }: { pose: Pose }) {
  return (
    <div className="size-7 overflow-hidden rounded-full border border-white/20 bg-[#000120]">
      <img src={`chriss/${pose}.webp`} alt="" className="size-full scale-150 object-cover object-top" />
    </div>
  )
}

export function PanelChriss({
  mensaje, historial, preguntas, ocupado, onPreguntar,
}: {
  mensaje: Mensaje
  historial: Turno[]
  preguntas: string[]
  ocupado: boolean
  onPreguntar: (pregunta: string) => void
}) {
  const { visible, escribiendo } = useEscritura(mensaje.texto)
  const [pregunta, setPregunta] = React.useState('')
  const enviar = (texto: string) => {
    const limpio = texto.trim()
    if (!limpio || ocupado) return
    onPreguntar(limpio)
    setPregunta('')
  }

  return (
    <section
      aria-label="Chriss, tu asistente"
      className="relative overflow-hidden rounded-lg border border-white/10 text-white"
      style={{ background: 'var(--gradiente-marca)' }}
    >
      <div aria-hidden className="pointer-events-none absolute -left-24 top-1/2 size-[420px] -translate-y-1/2 rounded-full" style={{ background: 'radial-gradient(circle, rgba(123,158,255,0.28) 0%, transparent 65%)' }} />
      <div className="relative grid gap-4 p-5 md:grid-cols-[176px_1fr] md:items-center md:gap-6 md:p-8">
        <div className="hidden md:flex md:justify-center">
          <img
            key={mensaje.pose}
            src={`chriss/${mensaje.pose}.webp`}
            alt={`Chriss, pose ${mensaje.pose}`}
            className="chriss-flota w-44 drop-shadow-[0_16px_28px_rgba(0,1,32,0.6)] animate-in fade-in zoom-in-95 duration-300"
          />
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <img src={`chriss/${mensaje.pose}.webp`} alt="" className="-my-2 -ml-1 w-14 md:hidden" />
            <h2 className="text-lg font-semibold tracking-tight">Chriss</h2>
            <Badge className="border-white/20 bg-white/10 text-white">
              <Sparkles className="size-3" /> Asistente IA de Ecomdrop
            </Badge>
          </div>

          <div className="flex max-h-56 flex-col gap-3 overflow-y-auto pr-1">
            {historial.map((t, i) => (
              <AiMessageBubble
                key={i}
                role={t.de === 'chriss' ? 'assistant' : 'user'}
                content={t.texto}
                avatar={t.de === 'chriss' ? <AvatarChriss pose="hola" /> : undefined}
                className={cn('font-sans [&_p]:text-[15px]', t.de === 'estudiante' && '[&>div:last-child]:rounded-md [&>div:last-child]:bg-white [&>div:last-child]:text-[#000120]')}
              />
            ))}
            <AiMessageBubble
              role="assistant"
              content={visible}
              isStreaming={escribiendo || ocupado}
              avatar={<AvatarChriss pose={mensaje.pose} />}
              className="font-sans [&_p]:text-[15px] [&_p]:leading-relaxed"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {preguntas.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => enviar(p)}
                disabled={ocupado}
                className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-[13px] text-white/90 transition-colors hover:bg-white/15 disabled:opacity-50"
              >
                {p}
              </button>
            ))}
          </div>

          <form
            className="flex items-center gap-2 rounded-md border border-white/20 bg-[#000120]/40 p-1 pl-3 focus-within:border-white/50"
            onSubmit={(e) => { e.preventDefault(); enviar(pregunta) }}
          >
            <input
              value={pregunta}
              onChange={(e) => setPregunta(e.target.value)}
              placeholder="Pregúntale a Chriss…"
              aria-label="Pregúntale a Chriss"
              className="min-w-0 flex-1 bg-transparent text-[15px] text-white placeholder:text-white/55 focus:outline-none"
            />
            <Button type="submit" size="icon" disabled={!pregunta.trim() || ocupado} className="bg-white text-[#0100e0] hover:bg-white/90" aria-label="Enviar">
              <ArrowUp className="size-4" />
            </Button>
          </form>
        </div>
      </div>
    </section>
  )
}

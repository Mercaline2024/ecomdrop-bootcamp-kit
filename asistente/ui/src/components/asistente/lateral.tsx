import { CheckIcon, LoaderCircleIcon } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Stepper, StepperDescription, StepperIndicator, StepperItem, StepperNav, StepperSeparator, StepperTitle, StepperTrigger,
} from '@/components/ui/stepper'
import type { Etapa } from '@/lib/chriss'

export interface DefEtapa { id: Etapa; titulo: string; descripcion: string }

export function Marca() {
  return (
    <div className="flex items-center gap-2.5">
      <span aria-hidden className="size-3.5 rounded-[4px] bg-primary" />
      <span className="text-[18px] font-bold tracking-[-0.02em]">Ecomdrop</span>
      <Badge variant="secondary" className="bg-accent text-accent-foreground">Bootcamp</Badge>
    </div>
  )
}

export function Firma({ className = '' }: { className?: string }) {
  return (
    <div className={className}>
      <div className="text-[13px] font-semibold uppercase tracking-[0.18em] text-coral">Elkin García</div>
      <div className="mt-1 text-[12px] text-muted-foreground">@elkingarcia.ia · <span className="text-coral">con Claude Code</span></div>
    </div>
  )
}

export function Lateral({
  etapas, actual, completadas, trabajando, onIr,
}: {
  etapas: DefEtapa[]
  actual: Etapa
  completadas: Set<Etapa>
  trabajando: boolean
  onIr: (e: Etapa) => void
}) {
  const indice = etapas.findIndex((e) => e.id === actual)
  const hechas = etapas.filter((e) => completadas.has(e.id)).length

  return (
    <aside className="flex flex-col gap-8 border-border md:sticky md:top-0 md:h-dvh md:w-[300px] md:shrink-0 md:border-r md:p-8">
      <Marca />

      <div>
        <div className="mb-2 flex items-baseline justify-between text-[13px]">
          <span className="font-medium">Paso {indice + 1} de {etapas.length}</span>
          <span className="tabular-nums text-muted-foreground">{Math.round((hechas / etapas.length) * 100)} %</span>
        </div>
        <Progress value={(hechas / etapas.length) * 100} className="h-1.5" />
      </div>

      <Stepper
        orientation="vertical"
        value={indice + 1}
        onValueChange={(v) => onIr(etapas[v - 1].id)}
        indicators={{
          completed: <CheckIcon className="size-3.5" />,
          loading: <LoaderCircleIcon className="size-3.5 animate-spin" />,
        }}
        className="hidden md:flex"
      >
        <StepperNav>
          {etapas.map((e, i) => (
            <StepperItem
              key={e.id}
              step={i + 1}
              completed={completadas.has(e.id)}
              loading={trabajando && e.id === actual}
              className="relative items-start not-last:flex-1"
            >
              <StepperTrigger className="items-start gap-3 pb-9 text-left last:pb-0">
                <StepperIndicator className="data-[state=completed]:bg-success data-[state=completed]:text-[#08090c] data-[state=inactive]:bg-muted data-[state=inactive]:text-muted-foreground">
                  {i + 1}
                </StepperIndicator>
                <div className="mt-0.5">
                  <StepperTitle className="text-[14px] font-semibold">{e.titulo}</StepperTitle>
                  <StepperDescription className="text-[13px] text-muted-foreground">{e.descripcion}</StepperDescription>
                </div>
              </StepperTrigger>
              {i < etapas.length - 1 && (
                <StepperSeparator className="group-data-[state=completed]/step:bg-success absolute inset-y-0 top-7 left-3 -order-1 m-0 -translate-x-1/2 group-data-[orientation=vertical]/stepper-nav:h-[calc(100%-2rem)]" />
              )}
            </StepperItem>
          ))}
        </StepperNav>
      </Stepper>

      {/* móvil: pestañas compactas */}
      <nav aria-label="Pasos" className="-mx-1 flex gap-1.5 overflow-x-auto pb-1 md:hidden">
        {etapas.map((e, i) => (
          <button
            key={e.id}
            type="button"
            onClick={() => onIr(e.id)}
            aria-current={e.id === actual ? 'step' : undefined}
            className="shrink-0 rounded-full border border-border px-3 py-1 text-[13px] aria-[current=step]:border-primary aria-[current=step]:bg-primary aria-[current=step]:text-primary-foreground"
          >
            {completadas.has(e.id) ? <CheckIcon className="mr-1 inline size-3.5" /> : `${i + 1}. `}{e.titulo}
          </button>
        ))}
      </nav>

      <Firma className="mt-auto hidden md:block" />
    </aside>
  )
}

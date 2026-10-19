import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CheckCircle2, ChevronDown, ChevronUp, CircleDashed, Loader2, Pause, Play, RotateCcw, SkipForward, X, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import { useTour, type Speed } from './TourProvider'
import type { StepStatus } from './types'

const SPEEDS: Speed[] = ['lento', 'normal', 'rapido']
const SPEED_LABEL: Record<Speed, string> = { lento: 'Lento', normal: 'Normal', rapido: 'Rápido' }

const STATUS_ICON: Record<StepStatus, typeof CheckCircle2> = { pending: CircleDashed, running: Loader2, ok: CheckCircle2, fail: XCircle }

/** Recuadro que sigue al elemento que el recorrido está tocando. */
function Spotlight({ el }: { el: Element | null }) {
  const [rect, setRect] = useState<DOMRect | null>(null)
  useEffect(() => {
    if (!el) return setRect(null)
    let raf = 0
    const tick = () => {
      setRect(el.isConnected ? el.getBoundingClientRect() : null)
      raf = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [el])
  if (!rect) return null
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed z-[90] rounded-2xl ring-4 ring-amber-400 transition-all duration-200 motion-safe:animate-pulse"
      style={{ left: rect.left - 4, top: rect.top - 4, width: rect.width + 8, height: rect.height + 8, boxShadow: '0 0 0 4px rgba(251,191,36,.25)' }}
    />
  )
}

/**
 * Panel del recorrido: qué paso es, qué pasa y por qué, qué caso cubre y qué se verificó.
 * Vive en un portal arriba de todo; no deja que los toques cierren los paneles de la app.
 */
export function TourPanel() {
  const t = useTour()
  const [collapsed, setCollapsed] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const active = Boolean(t.tour)

  // El panel no tapa la app: medimos su alto y corremos todo hacia abajo esa distancia (ver index.css, .tour-on).
  useLayoutEffect(() => {
    const root = document.documentElement
    if (!active || !box.current) return
    const apply = () => root.style.setProperty('--tour-h', `${box.current!.getBoundingClientRect().height}px`)
    apply()
    root.classList.add('tour-on')
    const ro = new ResizeObserver(apply)
    ro.observe(box.current)
    return () => {
      ro.disconnect()
      root.classList.remove('tour-on')
      root.style.removeProperty('--tour-h')
    }
  }, [active])

  if (!t.tour) return null
  const step = t.tour.steps[t.index]
  const res = t.results[t.index]
  const done = t.results.filter((r) => r.status === 'ok').length
  const failed = t.results.filter((r) => r.status === 'fail').length
  const total = t.tour.steps.length
  const Icon = t.tour.icon
  const waiting = !t.finished && res?.status !== 'running' && (t.paused || t.manual)

  const panel = (
    <div
      ref={box}
      className="pointer-events-auto fixed inset-x-0 top-0 z-[100] border-b-2 border-amber-400 bg-card/98 px-3 pb-2 pt-[calc(0.5rem+env(safe-area-inset-top))] text-card-foreground shadow-lg backdrop-blur"
      onPointerDown={(e) => e.stopPropagation()} // que tocar el panel no cierre el drawer abierto
      role="region"
      aria-label="Recorrido automático"
    >
      <div className="mx-auto max-w-md">
        <div className="flex items-center gap-2">
          <Icon className="size-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
          <p className="min-w-0 flex-1 truncate text-xs font-bold uppercase tracking-wide text-muted-foreground">
            {t.tour.title} · {t.finished ? 'Terminado' : `Paso ${t.index + 1} de ${total}`}
          </p>
          <Button variant="ghost" size="icon" className="size-8" onClick={() => setCollapsed((v) => !v)} aria-label={collapsed ? 'Mostrar explicación' : 'Achicar panel'}>
            {collapsed ? <ChevronDown className="size-4" /> : <ChevronUp className="size-4" />}
          </Button>
          <Button variant="ghost" size="icon" className="size-8" onClick={t.stop} aria-label="Salir del recorrido">
            <X className="size-4" />
          </Button>
        </div>
        <Progress value={((done + failed) / total) * 100} className="mt-1 h-1" />

        {t.finished ? (
          <div className="mt-3">
            <p className={cn('font-bold', failed ? 'text-destructive' : 'text-good-foreground')}>
              {failed ? `${done} de ${total} pasos bien · ${failed} con problemas` : `¡Todo bien! ${total} de ${total} pasos verificados`}
            </p>
            {!collapsed && (
              <ol className="mt-2 max-h-[40dvh] space-y-1 overflow-y-auto text-sm">
                {t.tour.steps.map((s, i) => {
                  const r = t.results[i]
                  const I = STATUS_ICON[r.status]
                  return (
                    <li key={s.title} className="flex gap-2">
                      <I className={cn('mt-0.5 size-4 shrink-0', r.status === 'ok' ? 'text-primary' : r.status === 'fail' ? 'text-destructive' : 'text-muted-foreground')} aria-hidden />
                      <span>
                        {s.title}
                        {r.error && <span className="block text-destructive">{r.error}</span>}
                      </span>
                    </li>
                  )
                })}
              </ol>
            )}
            <div className="mt-3 flex gap-2">
              <Button className="h-10 flex-1" onClick={() => t.start(t.tour!)}>
                <RotateCcw className="size-4" /> Repetir
              </Button>
              <Button variant="outline" className="h-10 flex-1" onClick={t.stop}>
                Cerrar
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="mt-2 flex items-start gap-2">
              {(() => {
                const I = STATUS_ICON[res?.status ?? 'pending']
                return (
                  <I
                    className={cn('mt-0.5 size-5 shrink-0', res?.status === 'running' && 'animate-spin text-amber-600', res?.status === 'ok' && 'text-primary', res?.status === 'fail' && 'text-destructive')}
                    aria-hidden
                  />
                )
              })()}
              <p className="text-[0.95rem] font-bold leading-snug">{step.title}</p>
            </div>
            {!collapsed && (
              <div className="mt-1 space-y-1.5 text-[0.82rem] leading-snug">
                <p>{step.explain}</p>
                {step.covers && <p className="text-xs font-semibold text-muted-foreground">Cubre: {step.covers}</p>}
                {res && res.checks.length > 0 && (
                  <ul className="flex flex-wrap gap-x-3 gap-y-0.5" aria-live="polite">
                    {res.checks.map((ch, i) => (
                      <li key={i} className={cn('flex gap-1.5 text-xs', ch.ok ? 'text-primary' : 'font-semibold text-destructive')}>
                        {ch.ok ? <CheckCircle2 className="size-3.5 shrink-0" /> : <XCircle className="size-3.5 shrink-0" />}
                        <span>{ch.label}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {res?.status === 'fail' && <p className="rounded-lg bg-destructive/10 px-2 py-1 text-xs font-semibold text-destructive">No pasó: {res.error}</p>}
              </div>
            )}
            <div className="mt-2 flex items-center gap-1.5">
              <Button size="sm" variant={t.paused ? 'default' : 'outline'} className="h-9 flex-1" onClick={t.togglePause}>
                {t.paused ? <Play className="size-4" /> : <Pause className="size-4" />}
                {t.paused ? 'Seguir' : 'Pausa'}
              </Button>
              <Button size="sm" variant={waiting ? 'default' : 'outline'} className="h-9 flex-1" onClick={t.next} disabled={!waiting}>
                <SkipForward className="size-4" /> Siguiente
              </Button>
              <Button
                size="sm"
                variant={t.manual ? 'secondary' : 'ghost'}
                className="h-9 px-2 text-xs"
                aria-pressed={t.manual}
                onClick={() => t.setManual(!t.manual)}
                title="Paso a paso: espera que toques Siguiente"
              >
                {t.manual ? 'A mano ✓' : 'A mano'}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-9 px-2 text-xs"
                onClick={() => t.setSpeed(SPEEDS[(SPEEDS.indexOf(t.speed) + 1) % SPEEDS.length])}
                aria-label={`Velocidad: ${SPEED_LABEL[t.speed]}. Tocar para cambiar`}
              >
                {SPEED_LABEL[t.speed]}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )

  return createPortal(
    <>
      <Spotlight el={t.target} />
      {panel}
    </>,
    document.body,
  )
}

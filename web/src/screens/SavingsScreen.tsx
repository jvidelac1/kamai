import { useEffect, useState, type ReactNode } from 'react'
import { CalendarClock, History, Hourglass, Info, Leaf, PiggyBank, ReceiptText, RefreshCcw, TrendingDown, TrendingUp, Zap } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Notice } from '@/components/Notice'
import { RangeBar } from '@/components/RangeBar'
import { ErrorState, ScreenSkeleton } from '@/components/States'
import { useBills, useBusiness, useFirstStepPlan, useSavings } from '@/lib/queries'
import { useUi } from '@/lib/ui'
import { api } from '@/lib/api'
import { dec, money, monthName } from '@/lib/format'
import type { SavingsResponse } from '@/lib/types'
import { cn } from '@/lib/utils'

export function SavingsScreen() {
  const { rec, plan, planId } = useFirstStepPlan()
  const savings = useSavings(planId)
  const { setTab } = useUi()

  if (rec.isPending || (planId && savings.isPending)) return <ScreenSkeleton />
  if (rec.isError || savings.isError) return <ErrorState error={rec.error ?? savings.error} onRetry={() => (rec.isError ? rec.refetch() : savings.refetch())} />

  if (!planId) {
    return (
      <Empty icon={PiggyBank} title="Aquí verás cuánto ahorras">
        <p>Primero elige tu primer paso. Cuando lo termines, medimos tu ahorro con tus facturas de luz.</p>
        <Button className="mt-5 h-12 px-8" onClick={() => setTab('step')}>
          Ver mi primer paso
        </Button>
      </Empty>
    )
  }

  return <SavingsView data={savings.data!} planTitle={plan.data?.title} inProgress={plan.data?.status !== 'completed'} />
}

function SavingsView({ data, planTitle, inProgress }: { data: SavingsResponse; planTitle?: string; inProgress: boolean }) {
  // Al mostrar el resultado, le avisamos al servidor que Inés lo vio (así el aviso de cambios sale una sola vez).
  const hash = data.measurement.inputsHash
  // Si en esta visita llegó un aviso de cambios, lo conservamos mientras siga en la pantalla
  // (aunque una consulta posterior ya lo traiga como "visto"). La próxima visita muestra solo "Último cambio".
  const [kept, setKept] = useState<{ hash: string; text: string; kind?: string } | null>(null)
  useEffect(() => {
    if (data.explanation.updateNote) setKept({ hash, text: data.explanation.updateNote, kind: data.previous?.changeKind })
  }, [hash, data.explanation.updateNote, data.previous?.changeKind])
  const note = data.explanation.updateNote ? { text: data.explanation.updateNote, kind: data.previous?.changeKind } : kept?.hash === hash ? kept : null
  useEffect(() => {
    api.markSavingsSeen(data.planId, hash).catch(() => {
      /* sin señal: lo marcará la próxima vez que lo vea */
    })
  }, [data.planId, hash])
  const { data: business } = useBusiness()
  const { data: bills } = useBills()
  const { openBillForm, setTab } = useUi()
  const cur = business?.currency ?? 'S/'
  const m = data.measurement
  const ex = data.explanation
  const s = m.savings

  const uploadCta = (
    <Button size="lg" className="mt-5 h-14 w-full rounded-2xl text-lg font-bold" onClick={() => openBillForm()}>
      <ReceiptText className="size-5" /> Subir mi factura
    </Button>
  )

  let hero: ReactNode
  if (inProgress) {
    hero = (
      <Hero tone="info" icon={CalendarClock} title="Empezamos a medir cuando termines">
        <p>Marca tu paso como terminado y sigue subiendo tus facturas. Con eso comparamos tu consumo de antes y de después.</p>
        <Button size="lg" className="mt-5 h-14 w-full rounded-2xl text-lg font-bold" onClick={() => setTab('step')}>
          Ir a mi paso
        </Button>
      </Hero>
    )
  } else if (m.status === 'MEASURED' && s) {
    hero = (
      <Card className="animate-pop-in border-0 bg-good text-good-foreground shadow-sm" aria-live="polite">
        <CardContent className="pt-6">
          <p className="font-semibold">Estás ahorrando cerca de</p>
          <p className="mt-1 text-6xl font-black tracking-tight">{money(cur, s.moneyPerMonthAtCurrentTariff)}</p>
          <p className="text-lg font-semibold">al mes</p>
          <p className="mt-2 text-sm opacity-90">
            Con lo que sabemos, entre {money(cur, s.moneyPerMonthRange[0])} y {money(cur, s.moneyPerMonthRange[1])} al mes, a la tarifa de hoy.
          </p>
          <div className="mt-4 rounded-2xl bg-card/60 p-3 text-foreground dark:bg-black/20 dark:text-good-foreground">
            <RangeBar low={s.pctRange[0]} high={s.pctRange[1]} point={s.pct} />
          </div>
        </CardContent>
      </Card>
    )
  } else if (m.status === 'INCREASED' && s) {
    hero = (
      <Hero tone="warn" icon={TrendingUp} title={ex.headline}>
        <p>{ex.detail}</p>
        <p className="mt-2">A veces pasa por un pedido grande o un equipo que falla. No es un fracaso: lo revisamos.</p>
      </Hero>
    )
  } else {
    const icon = m.status === 'INCONCLUSIVE' ? Hourglass : CalendarClock
    const mixed = m.status === 'WAITING_POST_DATA' ? m.periods.excludedTransition.map((id) => bills?.bills.find((b) => b.id === id)).filter(Boolean) : []
    hero = (
      <Hero tone="info" icon={icon} title={ex.headline} live>
        <p>{ex.detail}</p>
        {mixed.length > 0 && (
          <p className="mt-2">
            Tu factura de {mixed.map((b) => monthName(b!.billingStartDate)).join(' y ')} tiene días de antes y de después de terminar, así que no sirve para comparar. Esperamos la siguiente.
          </p>
        )}
        {ex.baseline && <p className="mt-2 font-semibold">{ex.baseline}</p>}
        {s && (
          <div className="mt-4 rounded-2xl bg-card/70 p-3 text-foreground dark:bg-black/20 dark:text-info-foreground">
            <RangeBar low={s.pctRange[0]} high={s.pctRange[1]} point={s.pct} />
          </div>
        )}
        {uploadCta}
      </Hero>
    )
  }

  return (
    <div className="mt-2 space-y-4">
      {planTitle && <p className="text-sm font-semibold text-muted-foreground">{planTitle}</p>}

      {note ? (
        <Notice tone={note.kind === 'EDITED_OR_DELETED' ? 'warn' : 'good'} icon={RefreshCcw} title={note.kind === 'EDITED_OR_DELETED' ? 'Actualizamos tu resultado' : undefined}>
          {note.text}
        </Notice>
      ) : (
        data.lastCorrection && (
          // Después del aviso grande, la última corrección queda a la vista para que la tenga presente.
          <p className="flex items-start gap-2 rounded-xl bg-muted px-3 py-2 text-sm text-muted-foreground" data-tour="last-correction">
            <History className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              <strong className="font-semibold text-foreground">Último cambio en tus facturas:</strong> {data.lastCorrection.text}
            </span>
          </p>
        )
      )}

      {hero}

      {!inProgress && m.status === 'MEASURED' && s && (
        <div className="grid grid-cols-2 gap-3">
          <Stat icon={TrendingDown} value={`${dec(s.pct)}%`} label="menos consumo de luz" />
          <Stat icon={Zap} value={`${dec(s.kwhPerDay)} kWh`} label="menos por día" />
          {s.moneyAccumulatedSinceCompletion > 0 && (
            <Stat icon={PiggyBank} value={`≈ ${money(cur, s.moneyAccumulatedSinceCompletion)}`} label="ahorrados desde que terminaste" />
          )}
          {m.co2AvoidedKgPerMonth != null && (
            <Stat icon={Leaf} value={`${dec(m.co2AvoidedKgPerMonth, 0)} kg`} label="de CO₂ menos al mes" />
          )}
        </div>
      )}

      {!inProgress && ex.tariffNote && (
        <Notice tone="warn" icon={Info} title="¿Por qué mi factura no baja tanto?">
          {ex.tariffNote}
        </Notice>
      )}

      {m.baseline && (
        <Accordion type="single" collapsible className="rounded-2xl bg-card px-4 shadow-sm">
          <AccordionItem value="how" className="border-0">
            <AccordionTrigger className="text-base font-bold">¿Cómo lo calculamos?</AccordionTrigger>
            <AccordionContent className="space-y-3 text-base leading-snug">
              <div className="grid grid-cols-2 gap-3">
                <Mini label="Antes" value={`${dec(m.baseline.kwhPerDay)} kWh/día`} />
                <Mini label="Después" value={m.post ? `${dec(m.post.kwhPerDay)} kWh/día` : 'Todavía no'} />
              </div>
              <p>
                Comparamos tu consumo <strong>por día</strong>, así no importa si el mes tuvo 28 o 31 días. Y lo medimos en kWh, no en soles: si sube la tarifa, no es tu culpa.
              </p>
              <p>Tu consumo normal varía cerca de {dec(m.baseline.naturalVariationPct)}% de un mes a otro. Solo te decimos que ahorraste cuando el cambio es mayor que eso.</p>
              {m.limitations.length > 0 && (
                <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  {m.limitations.map((l) => (
                    <li key={l.code}>{l.detail}</li>
                  ))}
                </ul>
              )}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}
    </div>
  )
}

function Hero({ tone, icon: Icon, title, children, live }: { tone: 'info' | 'warn'; icon: typeof Info; title: string; children: ReactNode; live?: boolean }) {
  return (
    <Card className={cn('border-0 shadow-sm', tone === 'info' ? 'bg-info text-info-foreground' : 'bg-warn text-warn-foreground')} aria-live={live ? 'polite' : undefined}>
      <CardContent className="pt-6">
        <Icon className="size-10" aria-hidden />
        <h2 className="mt-3 text-2xl font-extrabold leading-tight tracking-tight">{title}</h2>
        <div className="mt-2 text-base leading-snug">{children}</div>
      </CardContent>
    </Card>
  )
}

function Stat({ icon: Icon, value, label, className }: { icon: typeof Info; value: string; label: string; className?: string }) {
  return (
    <Card className={cn('border-0 shadow-sm', className)}>
      <CardContent className="px-4 py-4">
        <Icon className="size-5 text-primary" aria-hidden />
        <p className="mt-2 text-2xl font-extrabold tracking-tight">{value}</p>
        <p className="text-sm text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  )
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-muted p-3">
      <p className="text-xs font-semibold text-muted-foreground">{label}</p>
      <p className="font-bold">{value}</p>
    </div>
  )
}

function Empty({ icon: Icon, title, children }: { icon: typeof Info; title: string; children: ReactNode }) {
  return (
    <div className="mt-12 flex flex-col items-center px-2 text-center">
      <span className="flex size-20 items-center justify-center rounded-full bg-accent">
        <Icon className="size-10 text-primary" aria-hidden />
      </span>
      <h2 className="mt-5 text-2xl font-extrabold tracking-tight">{title}</h2>
      <div className="mt-2 text-muted-foreground">{children}</div>
    </div>
  )
}

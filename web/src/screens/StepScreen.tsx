import { useState } from 'react'
import { toast } from 'sonner'
import { ArrowRight, CircleCheck, HelpCircle, Lock, PartyPopper, PauseCircle, ReceiptText, Sparkles, Sprout } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Progress } from '@/components/ui/progress'
import { Notice } from '@/components/Notice'
import { ErrorState, ScreenSkeleton } from '@/components/States'
import { WhyDrawer } from '@/components/WhyDrawer'
import { StepHelpDrawer } from '@/components/StepHelpDrawer'
import { CompleteDrawer } from '@/components/CompleteDrawer'
import { useFirstStepPlan, useSetStep, useStartPlan } from '@/lib/queries'
import { useUi } from '@/lib/ui'
import { dayMonth } from '@/lib/format'
import { errorLine } from '@/lib/errors'
import type { Plan, RecommendationResponse } from '@/lib/types'

export function StepScreen() {
  const { rec, plan } = useFirstStepPlan()
  if (rec.isPending || (rec.data?.firstStepPlan && plan.isPending)) return <ScreenSkeleton />
  if (rec.isError) return <ErrorState error={rec.error} onRetry={() => rec.refetch()} />
  const data = rec.data!
  if (!data.firstStepPlan) return <Recommendation data={data} />
  if (plan.isError || !plan.data) return <ErrorState error={plan.error} onRetry={() => plan.refetch()} />
  if (plan.data.status === 'completed') return <Done plan={plan.data} next={data.recommendation.recommended?.title} />
  return <InProgress plan={plan.data} />
}

function Recommendation({ data }: { data: RecommendationResponse }) {
  const start = useStartPlan()
  const { openBillForm } = useUi()
  const { explanation: ex, recommendation: r } = data
  if (!r.recommended) {
    return (
      <Card className="mt-2">
        <CardContent className="py-6 text-center">
          <p className="text-lg font-bold">Por ahora no encontramos un primer paso que entre en tu presupuesto y tu tiempo.</p>
          <p className="mt-2 text-muted-foreground">Te avisaremos apenas haya una opción para ti.</p>
        </CardContent>
      </Card>
    )
  }
  const onStart = async () => {
    try {
      await start.mutateAsync({ ecoId: r.recommended!.ecoId, recommendationId: data.recommendationId })
      toast.success('¡Vamos! Tu plan ya está listo')
    } catch (e) {
      toast.error(errorLine(e).title, { description: errorLine(e).description })
    }
  }
  return (
    <div className="space-y-4">
      <Card className="mt-2 overflow-hidden border-0 shadow-sm">
        <div className="bg-gradient-to-br from-accent to-card px-5 pb-4 pt-5">
          <Badge className="rounded-full bg-primary/15 text-primary hover:bg-primary/15">
            <Sprout className="size-3.5" /> Tu primer paso
          </Badge>
          <h2 className="mt-3 text-2xl font-extrabold leading-tight tracking-tight">{r.recommended.title}</h2>
        </div>
        <CardContent className="pt-4">
          <p className="mb-2 text-sm font-semibold text-muted-foreground">Por qué te lo recomendamos</p>
          <ul className="space-y-3">
            {ex.bullets.map((b) => (
              <li key={b} className="flex gap-3">
                <CircleCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
                <span className="leading-snug">{b}</span>
              </li>
            ))}
          </ul>
          <WhyDrawer
            data={data}
            trigger={
              <Button variant="ghost" className="mt-2 h-12 w-full text-muted-foreground">
                <HelpCircle className="size-4" /> ¿Por qué este y no otro?
              </Button>
            }
          />
        </CardContent>
      </Card>

      {ex.beforeYouStart && (
        <Notice tone="info" icon={ReceiptText} title="Un pedido antes de empezar">
          <p>{ex.beforeYouStart}</p>
          <Button variant="outline" className="mt-3 h-11 bg-card" onClick={() => openBillForm()}>
            Subir una factura
          </Button>
        </Notice>
      )}

      {ex.stalledNote && (
        <Notice tone="warn" icon={PauseCircle} title="Sobre lo que ya tenías en marcha">
          {ex.stalledNote}
        </Notice>
      )}

      {/* Espacio para que el botón fijo no tape el contenido */}
      <div className="h-20" aria-hidden />
      <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 bg-gradient-to-t from-background via-background/95 to-transparent px-4 pb-3 pt-6">
        <div className="mx-auto max-w-md">
          <Button size="lg" className="h-14 w-full rounded-2xl text-lg font-bold shadow-lg" onClick={onStart} disabled={start.isPending}>
            {start.isPending ? 'Preparando tu plan…' : 'Quiero empezar'}
            {!start.isPending && <ArrowRight className="size-5" />}
          </Button>
        </div>
      </div>
    </div>
  )
}

function InProgress({ plan }: { plan: Plan }) {
  const setStep = useSetStep(plan.id)
  const [helpFor, setHelpFor] = useState<number | null>(null)
  const done = plan.steps.filter((s) => s.status === 'completed').length
  const total = plan.steps.length

  return (
    <div className="space-y-4">
      <Card className="mt-2 border-0 shadow-sm">
        <CardContent className="pt-5">
          <Badge variant="secondary" className="rounded-full">En marcha</Badge>
          <h2 className="mt-3 text-2xl font-extrabold leading-tight tracking-tight">{plan.title}</h2>
          <div className="mt-4 flex items-center justify-between text-sm font-semibold">
            <span>Tu avance</span>
            <span className="text-muted-foreground">
              {done} de {total} pasos
            </span>
          </div>
          <Progress value={(done / total) * 100} className="mt-2 h-3" aria-label={`${done} de ${total} pasos hechos`} />
        </CardContent>
      </Card>

      <ol className="space-y-3">
        {plan.steps.map((s, i) => {
          const checked = s.status === 'completed'
          return (
            <li key={s.title}>
              <Card className="border-0 shadow-sm">
                <CardContent className="flex items-center gap-3 px-4 py-3">
                  <Checkbox
                    id={`step-${i}`}
                    checked={checked}
                    disabled={setStep.isPending}
                    onCheckedChange={(v) =>
                      setStep.mutate(
                        { index: i, done: v === true },
                        { onError: (e) => toast.error('No pudimos marcar el paso', { description: errorLine(e).description }) },
                      )
                    }
                    className="size-7 rounded-lg"
                    aria-label={`Marcar "${s.title}" como hecho`}
                  />
                  <label htmlFor={`step-${i}`} className="flex-1 cursor-pointer">
                    <span className="block text-xs font-semibold text-muted-foreground">Paso {i + 1}</span>
                    <span className={checked ? 'text-muted-foreground line-through' : 'font-semibold'}>{s.title}</span>
                  </label>
                  <Button variant="ghost" size="sm" className="h-10 shrink-0 text-primary" onClick={() => setHelpFor(i)} aria-label={`¿Cómo hago "${s.title}"?`}>
                    <Sparkles className="size-4" /> ¿Cómo?
                  </Button>
                </CardContent>
              </Card>
            </li>
          )
        })}
      </ol>

      <CompleteDrawer
        planId={plan.id}
        startedAt={plan.startedAt}
        allDone={done === total}
        trigger={
          <Button size="lg" className="h-14 w-full rounded-2xl text-lg font-bold" variant={done === total ? 'default' : 'outline'}>
            <CircleCheck className="size-5" /> Ya lo terminé
          </Button>
        }
      />

      <Notice tone="info" icon={ReceiptText}>
        Sigue subiendo tus facturas de luz como siempre: con ellas vamos a medir cuánto ahorras.
      </Notice>

      <StepHelpDrawer plan={plan} stepIndex={helpFor} onClose={() => setHelpFor(null)} />
    </div>
  )
}

function Done({ plan, next }: { plan: Plan; next?: string }) {
  const { setTab } = useUi()
  return (
    <div className="space-y-4">
      <Card className="mt-2 animate-pop-in border-0 bg-good text-good-foreground shadow-sm">
        <CardContent className="py-6 text-center">
          <PartyPopper className="mx-auto size-12" aria-hidden />
          <h2 className="mt-3 text-2xl font-extrabold tracking-tight">¡Terminaste tu primer paso!</h2>
          <p className="mt-1 opacity-90">
            {plan.title}
            {plan.completedAt ? ` · el ${dayMonth(plan.completedAt)}` : ''}
          </p>
          <Button size="lg" className="mt-5 h-14 w-full rounded-2xl text-lg font-bold" onClick={() => setTab('savings')}>
            Ver cuánto ahorro <ArrowRight className="size-5" />
          </Button>
        </CardContent>
      </Card>
      {next && (
        <Card className="border-0 shadow-sm">
          <CardContent className="flex gap-3 py-4">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted">
              <Lock className="size-5 text-muted-foreground" aria-hidden />
            </span>
            <div>
              <p className="text-sm font-semibold text-muted-foreground">Tu siguiente paso</p>
              <p className="font-bold leading-snug">{next}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Lo activamos cuando midamos tu ahorro. Así sabemos qué te funcionó y no se mezclan los resultados.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

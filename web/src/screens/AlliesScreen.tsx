import type { ReactNode } from 'react'
import { ArrowLeft, BadgeCheck, CalendarCheck, Camera, CameraOff, Info, Leaf, Lock, ScrollText, TrendingDown, Users, Zap } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { ErrorState, ScreenSkeleton } from '@/components/States'
import { useAlliesReport } from '@/lib/queries'
import { useUi } from '@/lib/ui'
import { dec, thousands } from '@/lib/format'
import type { AllyRow, AlliesReport } from '@/lib/types'
import { cn } from '@/lib/utils'

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many)

const ECO_NAMES: Record<string, string> = {
  eco_118: 'Burletes y descongelamiento',
  eco_204: 'Hornear por tandas',
  eco_090: 'Iluminación LED',
  eco_071: 'Aislamiento del horno',
  eco_150: 'Calentador solar',
}
const STATUS: Record<AllyRow['status'], { label: string; tone: string }> = {
  MEASURED: { label: 'Medido', tone: 'bg-good text-good-foreground' },
  INCONCLUSIVE: { label: 'Aún no se sabe', tone: 'bg-info text-info-foreground' },
  WAITING_POST_DATA: { label: 'Esperando factura', tone: 'bg-info text-info-foreground' },
  INSUFFICIENT_BASELINE: { label: 'Faltan facturas de antes', tone: 'bg-warn text-warn-foreground' },
  INCREASED: { label: 'Consumo subió', tone: 'bg-warn text-warn-foreground' },
}
const EVIDENCE: Record<AllyRow['evidence'], { label: string; icon: typeof Camera }> = {
  photo: { label: 'Facturas con foto verificada', icon: Camera },
  partial: { label: 'Algunas facturas con foto', icon: Camera },
  none: { label: 'Sin foto verificada', icon: CameraOff },
}

/**
 * Vista para aliados e inversores: ahorro MEDIDO (no declarado), agregado y anónimo.
 * Responde a la meta del enunciado: ahorro real en 90 días y mejorar "de cada 10, 3 completan y 1 deja facturas".
 */
export function AlliesScreen() {
  const report = useAlliesReport()
  const { setView } = useUi()
  return (
    <div className="mx-auto w-full max-w-md md:max-w-3xl">
      <header style={{ top: 'var(--tour-h, 0px)' }} className="sticky z-20 bg-background/90 px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] backdrop-blur">
        <Button variant="ghost" size="sm" className="-ml-2 mb-1 text-muted-foreground" onClick={() => setView('owner')}>
          <ArrowLeft className="size-4" /> Volver a la app de Inés
        </Button>
        <h1 className="text-xl font-extrabold tracking-tight">Programa Kamai · Vista para aliados</h1>
        <p className="text-sm text-muted-foreground">Panaderías de Perú y Bolivia · datos agregados y anónimos</p>
      </header>
      <main className="space-y-4 px-4 pb-12 pt-2">
        {report.isPending ? <ScreenSkeleton /> : report.isError ? <ErrorState error={report.error} onRetry={() => report.refetch()} /> : <Report data={report.data} />}
      </main>
    </div>
  )
}

function Report({ data }: { data: AlliesReport }) {
  const { summary: s, program: p } = data
  const f = p.funnel
  return (
    <>
      <div role="note" className="flex gap-2 rounded-2xl border-2 border-dashed border-warn-foreground/40 bg-warn px-4 py-3 text-sm text-warn-foreground" data-tour="ally-data-note">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
        <p>
          <strong>Datos ficticios del caso:</strong> Inés y 6 panaderías inventadas. Sirven para ver cómo queda el reporte; con datos reales los números van a ser otros.
        </p>
      </div>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4" data-tour="ally-kpis" aria-label="Indicadores principales">
        <Kpi icon={TrendingDown} label="Ahorro medido (mediana)" value={s.published ? `${dec(s.medianSavingsPct!)}%` : '—'} sub={s.published ? `de consumo de luz, en ${s.measuredBusinesses} negocios` : `Se publica desde ${s.minBusinessesToPublish} negocios`} />
        <Kpi icon={Users} label="Con ahorro medido" value={`${f.measured} de ${f.completed}`} sub="negocios que completaron" />
        <Kpi icon={Zap} label="kWh ahorrados / mes" value={p.totals.kwhSavedPerMonth != null ? thousands(p.totals.kwhSavedPerMonth) : '—'} sub="solo ahorro medido" />
        <Kpi icon={Leaf} label="CO₂ evitado / mes" value={p.totals.co2AvoidedKgPerMonth != null ? `${thousands(p.totals.co2AvoidedKgPerMonth)} kg` : '—'} sub="factor de red por país" />
      </section>

      <Section icon={BadgeCheck} title="De cada 10 negocios que eligen una ecoinnovación" tour="ally-funnel">
        <div className="mb-3 flex gap-4 text-xs" aria-hidden>
          <span className="flex items-center gap-1.5">
            <i className="inline-block h-2.5 w-4 rounded-sm" style={{ background: 'var(--chart-after)' }} /> Ahora
          </span>
          <span className="flex items-center gap-1.5">
            <i className="inline-block h-3.5 w-1 rounded-sm" style={{ background: 'var(--chart-before)' }} /> Antes del cambio (enunciado)
          </span>
        </div>
        <FunnelRow label="La completan" now={f.per10.completed} before={f.baselinePer10.completed} />
        <FunnelRow label="Dejan facturas de antes y después" now={f.per10.withBeforeAfter} before={f.baselinePer10.withBeforeAfter} />
        <FunnelRow label="Tienen ahorro medido" now={f.per10.measured} before={null} beforeText="antes no se medía" />
        <p className="mt-3 text-xs text-muted-foreground">
          Base: {f.chose} planes elegidos. Con una muestra tan chica, cada negocio mueve el número más de un punto: miren la tendencia, no el decimal. Pedir 3 facturas antes de empezar y recordar la siguiente es lo que mueve “dejan facturas”.
        </p>
      </Section>

      <div className="grid gap-4 md:grid-cols-2">
        <Section icon={CalendarCheck} title="Meta: ahorro real en los primeros 90 días" tour="ally-goal">
          <p className="text-3xl font-black tracking-tight">
            {p.goal90Days.measuredWithin90} <span className="text-lg font-bold text-muted-foreground">de {p.goal90Days.measured}</span>
          </p>
          <p className="text-sm">negocios con ahorro medido lo lograron dentro de sus primeros 90 días en Kamai.</p>
          <Progress value={p.goal90Days.measured ? (p.goal90Days.measuredWithin90 / p.goal90Days.measured) * 100 : 0} className="mt-3 h-2" />
          <p className="mt-2 text-xs text-muted-foreground">{p.goal90Days.note}</p>
        </Section>

        <Section icon={ScrollText} title="Medido, no declarado" tour="ally-declared">
          <ul className="space-y-1.5 text-sm">
            <li>
              <strong>{p.measuredVsDeclared.declared}</strong> {plural(p.measuredVsDeclared.declared, 'negocio declaró', 'negocios declararon')} impacto (formulario, escala 1–5).
            </li>
            <li>
              <strong>{p.measuredVsDeclared.measured}</strong> {plural(p.measuredVsDeclared.measured, 'tiene', 'tienen')} ahorro <strong>medido</strong> con sus facturas.
            </li>
            <li>
              <strong>{p.measuredVsDeclared.declaredButNotMeasured}</strong> {plural(p.measuredVsDeclared.declaredButNotMeasured, 'declaró', 'declararon')} impacto pero todavía no lo podemos confirmar.
            </li>
          </ul>
          <p className="mt-2 text-xs text-muted-foreground">Lo que reportamos como ahorro es solo lo medido. Lo declarado se muestra al lado, nunca sumado.</p>
        </Section>
      </div>

      <Section icon={Lock} title="Detalle por negocio (anónimo)" tour="ally-rows">
        <ul className="divide-y">
          {data.rows.map((r) => {
            const st = STATUS[r.status]
            const ev = EVIDENCE[r.evidence]
            return (
              <li key={r.businessRef + r.ecoId} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-sm">
                <span className="font-mono text-xs text-muted-foreground">#{r.businessRef.slice(0, 6)}</span>
                <span className="font-semibold">{ECO_NAMES[r.ecoId] ?? r.ecoId}</span>
                <span className="text-xs text-muted-foreground">{r.country === 'BO' ? 'Bolivia' : 'Perú'}</span>
                <Badge className={cn('ml-auto rounded-full border-0', st.tone)}>{st.label}</Badge>
                <span className="w-full text-xs text-muted-foreground">
                  {r.savingsPct != null && r.measured ? `Ahorro ${dec(r.savingsPct)}% (entre ${dec(r.savingsPctRange![0])}% y ${dec(r.savingsPctRange![1])}%)` : 'Sin ahorro confirmado'}
                  {' · '}Declarado: {r.declaredImpact ? `${r.declaredImpact}/5` : '—'}
                  {' · '}
                  <ev.icon className="inline size-3.5 align-[-2px]" aria-hidden /> {ev.label}
                </span>
              </li>
            )
          })}
        </ul>
      </Section>

      <Section icon={Info} title="Cómo medimos" tour="ally-method">
        <ul className="list-disc space-y-1 pl-5 text-sm">
          <li>Cada negocio contra su propio consumo de antes, en kWh por día (los meses cortos no inflan el ahorro).</li>
          <li>En kWh, no en soles: si la tarifa sube, no se resta ni se suma al negocio.</li>
          <li>Solo cuenta como ahorro si todo el rango probable (~95%) está por encima de cero.</li>
          <li>Los meses que mezclan antes y después no se usan. Sin corrección por temporada hasta tener 12 meses.</li>
          <li>Promedios solo con {s.minBusinessesToPublish} negocios o más. Sin nombres, emails ni montos por negocio.</li>
        </ul>
        <p className="mt-2 text-xs text-muted-foreground">Método {data.rows[0]?.methodVersion ?? 'savings-v1'} · generado el {new Date(data.generatedAt).toLocaleDateString('es-PE')}</p>
      </Section>
    </>
  )
}

function Kpi({ icon: Icon, label, value, sub }: { icon: typeof Info; label: string; value: string; sub: string }) {
  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="px-4 py-4">
        <Icon className="size-5 text-primary" aria-hidden />
        <p className="mt-2 text-xs font-semibold text-muted-foreground">{label}</p>
        <p className="text-2xl font-extrabold tracking-tight">{value}</p>
        <p className="text-xs text-muted-foreground">{sub}</p>
      </CardContent>
    </Card>
  )
}

function Section({ icon: Icon, title, children, tour }: { icon: typeof Info; title: string; children: ReactNode; tour?: string }) {
  return (
    <Card className="border-0 shadow-sm" data-tour={tour}>
      <CardContent className="py-4">
        <h2 className="mb-3 flex items-center gap-2 font-bold">
          <Icon className="size-4 text-muted-foreground" aria-hidden /> {title}
        </h2>
        {children}
      </CardContent>
    </Card>
  )
}

/** Barra = ahora (verde); marca = antes del cambio (lavanda). Escala fija de 0 a 10 para comparar filas. */
function FunnelRow({ label, now, before, beforeText }: { label: string; now: number; before: number | null; beforeText?: string }) {
  return (
    <div className="mb-3">
      <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
        <span>{label}</span>
        <span className="whitespace-nowrap">
          <strong className="text-base">{dec(now)}</strong> <span className="text-xs text-muted-foreground">{before != null ? `antes ${before}` : beforeText}</span>
        </span>
      </div>
      <div className="relative h-3 rounded-full bg-muted" role="img" aria-label={`${label}: ${dec(now)} de cada 10${before != null ? `, antes ${before}` : ''}`}>
        <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${Math.min(now, 10) * 10}%`, background: 'var(--chart-after)' }} />
        {before != null && <div className="absolute -top-1 h-5 w-1 -translate-x-1/2 rounded-sm ring-2 ring-card" style={{ left: `${before * 10}%`, background: 'var(--chart-before)' }} />}
      </div>
    </div>
  )
}

import { useState } from 'react'
import type { Bill, Measurement } from '@/lib/types'
import { dec, money, monthShort, monthYear } from '@/lib/format'

type Phase = 'before' | 'after' | 'transition'

/**
 * Consumo por día de cada mes (una sola medida, un solo eje).
 * Antes = lavanda, después = verde (par validado para daltonismo); la línea punteada es "tu consumo normal".
 * Tocar una barra muestra el detalle (en celular no hay hover).
 */
export function ConsumptionChart({ bills, measurement, currency }: { bills: Bill[]; measurement?: Measurement; currency: string }) {
  const [selected, setSelected] = useState<string | null>(null)
  const post = new Set(measurement?.periods.post)
  const transition = new Set(measurement?.periods.excludedTransition)
  const phase = (b: Bill): Phase => (post.has(b.id) ? 'after' : transition.has(b.id) ? 'transition' : 'before')
  const hasAfter = bills.some((b) => phase(b) === 'after')
  const baseline = measurement?.baseline?.kwhPerDay

  const W = 340
  const H = 170
  const padL = 30
  const padB = 22
  const padT = 14
  const maxV = Math.max(...bills.map((b) => b.kwhPerDay), baseline ?? 0) * 1.08
  const minV = 0
  const y = (v: number) => padT + (1 - (v - minV) / (maxV - minV)) * (H - padT - padB)
  const slot = (W - padL) / bills.length
  const barW = Math.min(26, slot - 2) // >= 2px de separación entre barras
  const ticks = [0, Math.round(maxV / 2 / 10) * 10, Math.floor(maxV / 10) * 10]
  const sel = bills.find((b) => b.id === selected)

  const fill = (p: Phase) => (p === 'after' ? 'var(--chart-after)' : 'var(--chart-before)')

  return (
    <div>
      {hasAfter && (
        <div className="mb-2 flex gap-4 text-sm" aria-hidden>
          <span className="flex items-center gap-1.5"><i className="inline-block size-3 rounded-sm" style={{ background: 'var(--chart-before)' }} /> Antes</span>
          <span className="flex items-center gap-1.5"><i className="inline-block size-3 rounded-sm" style={{ background: 'var(--chart-after)' }} /> Después</span>
        </div>
      )}
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Consumo de luz por día en cada mes">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={W} y1={y(t)} y2={y(t)} stroke="currentColor" strokeOpacity={0.08} />
            <text x={padL - 6} y={y(t) + 4} textAnchor="end" className="fill-muted-foreground" fontSize="10">{t}</text>
          </g>
        ))}
        {bills.map((b, i) => {
          const p = phase(b)
          const x = padL + i * slot + (slot - barW) / 2
          const top = y(b.kwhPerDay)
          const r = 4
          return (
            <g key={b.id} onClick={() => setSelected(selected === b.id ? null : b.id)} className="cursor-pointer">
              {/* zona de toque más grande que la barra */}
              <rect x={padL + i * slot} y={padT} width={slot} height={H - padT - padB} fill="transparent" />
              <path
                d={`M${x},${y(0)} V${top + r} Q${x},${top} ${x + r},${top} H${x + barW - r} Q${x + barW},${top} ${x + barW},${top + r} V${y(0)} Z`}
                fill={fill(p)}
                opacity={p === 'transition' ? 0.4 : selected && selected !== b.id ? 0.55 : 1}
              />
              <text x={x + barW / 2} y={H - 6} textAnchor="middle" fontSize="10" className={selected === b.id ? 'fill-foreground font-bold' : 'fill-muted-foreground'}>
                {monthShort(b.billingStartDate)}
              </text>
            </g>
          )
        })}
        {baseline && (
          <g>
            <line x1={padL} x2={W} y1={y(baseline)} y2={y(baseline)} stroke="currentColor" strokeOpacity={0.55} strokeDasharray="4 4" strokeWidth={1.5} />
            <text x={W - 2} y={y(baseline) - 5} textAnchor="end" fontSize="10" className="fill-foreground font-semibold">tu normal</text>
          </g>
        )}
      </svg>
      <p className="mt-1 min-h-10 text-sm text-muted-foreground" aria-live="polite">
        {sel ? (
          <>
            <strong className="text-foreground">{monthYear(sel.billingStartDate)}:</strong> {dec(sel.kwhPerDay)} kWh por día · {money(currency, sel.totalCost)}
            {phase(sel) === 'transition' && ' · mes de cambio, no lo usamos para medir'}
          </>
        ) : (
          'Toca una barra para ver el detalle. Más baja = gastaste menos luz por día.'
        )}
      </p>
    </div>
  )
}

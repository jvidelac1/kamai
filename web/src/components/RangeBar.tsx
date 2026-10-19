import { dec } from '@/lib/format'

/** Rango probable de ahorro (%). Positivo = consume menos. Texto explícito, no solo la barra. */
export function RangeBar({ low, high, point }: { low: number; high: number; point: number }) {
  const min = Math.min(-4, Math.floor(low) - 1)
  const max = Math.max(12, Math.ceil(high) + 1)
  const pos = (v: number) => ((v - min) / (max - min)) * 100
  const word = (v: number) => (v >= 0 ? `${dec(v)}% menos` : `${dec(-v)}% más`)
  return (
    <figure className="mt-1">
      <div className="relative h-10" aria-hidden>
        <div className="absolute inset-x-0 top-4 h-2 rounded-full bg-black/10 dark:bg-white/15" />
        <div
          className="absolute top-4 h-2 rounded-full bg-current opacity-60"
          style={{ left: `${pos(low)}%`, width: `${pos(high) - pos(low)}%` }}
        />
        <div className="absolute top-[0.6rem] size-5 -translate-x-1/2 rounded-full border-[3px] border-card bg-current shadow" style={{ left: `${pos(point)}%` }} />
        <div className="absolute top-1 h-8 w-0.5 -translate-x-1/2 rounded bg-foreground/60" style={{ left: `${pos(0)}%` }} />
      </div>
      <div className="relative h-5 text-xs font-semibold opacity-80" aria-hidden>
        <span className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: `${pos(0)}%` }}>
          sin cambio
        </span>
      </div>
      <figcaption className="mt-1 text-sm">
        Lo más probable: entre <strong>{word(low)}</strong> y <strong>{word(high)}</strong> de consumo.
      </figcaption>
    </figure>
  )
}

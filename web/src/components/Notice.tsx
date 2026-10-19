import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

const TONES = {
  info: 'bg-info text-info-foreground',
  warn: 'bg-warn text-warn-foreground',
  good: 'bg-good text-good-foreground',
  neutral: 'bg-muted text-foreground',
} as const

/** Aviso con ícono + texto (nunca solo color). */
export function Notice({
  tone = 'info',
  icon: Icon,
  title,
  children,
  className,
}: {
  tone?: keyof typeof TONES
  icon?: LucideIcon
  title?: string
  children: ReactNode
  className?: string
}) {
  return (
    <div role="note" className={cn('flex gap-3 rounded-2xl p-4', TONES[tone], className)}>
      {Icon && <Icon className="mt-0.5 size-5 shrink-0" aria-hidden />}
      <div className="min-w-0 flex-1 leading-snug">
        {title && <p className="mb-1 font-bold">{title}</p>}
        {children}
      </div>
    </div>
  )
}

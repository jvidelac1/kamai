import type { ReactNode } from 'react'
import { AlertCircle, CloudOff, Wrench } from 'lucide-react'
import type { FriendlyError } from '@/lib/errors'
import { cn } from '@/lib/utils'

const ICON = { fixable: AlertCircle, network: CloudOff, ours: Wrench }

/** Error en un formulario: qué pasó, qué hacer y, si aplica, un botón que lo resuelve. */
export function ErrorCallout({ error, action, className }: { error: FriendlyError; action?: ReactNode; className?: string }) {
  const Icon = ICON[error.kind]
  return (
    <div
      role="alert"
      className={cn(
        'flex gap-3 rounded-2xl p-4',
        error.kind === 'fixable' ? 'bg-destructive/10 text-destructive' : 'bg-warn text-warn-foreground',
        className,
      )}
    >
      <Icon className="mt-0.5 size-5 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1 leading-snug">
        {error.kind !== 'fixable' && <p className="font-bold">{error.title}</p>}
        <p className={error.kind === 'fixable' ? 'font-semibold' : undefined}>{error.message}</p>
        {error.hint && <p className="mt-1 text-foreground/80">{error.hint}</p>}
        {action && <div className="mt-3">{action}</div>}
      </div>
    </div>
  )
}

/** Mensaje debajo de un campo. El id se usa en aria-describedby del input. */
export function FieldMessage({ id, tone = 'error', children }: { id: string; tone?: 'error' | 'warn' | 'help'; children: ReactNode }) {
  return (
    <p
      id={id}
      className={cn(
        'flex items-start gap-1.5 text-sm leading-snug',
        tone === 'error' && 'font-semibold text-destructive',
        tone === 'warn' && 'font-semibold text-warn-foreground',
        tone === 'help' && 'text-muted-foreground',
      )}
    >
      {tone !== 'help' && <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />}
      <span>{children}</span>
    </p>
  )
}

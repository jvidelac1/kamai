import { CloudOff, Wrench } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { friendlyError } from '@/lib/errors'

export function ScreenSkeleton() {
  return (
    <div className="mt-2 space-y-4" aria-busy="true" aria-label="Cargando">
      <Skeleton className="h-64 w-full rounded-2xl" />
      <Skeleton className="h-20 w-full rounded-2xl" />
      <Skeleton className="h-20 w-full rounded-2xl" />
    </div>
  )
}

/** No pudimos cargar: distingue "es la señal" de "es un problema nuestro", y siempre ofrece reintentar. */
export function ErrorState({ error, onRetry }: { error?: unknown; onRetry: () => void }) {
  const f = friendlyError(error)
  const network = f.kind === 'network'
  const Icon = network ? CloudOff : Wrench
  return (
    <div className="mt-10 flex flex-col items-center text-center" role="alert">
      <span className="flex size-16 items-center justify-center rounded-full bg-muted">
        <Icon className="size-8 text-muted-foreground" aria-hidden />
      </span>
      <p className="mt-4 text-lg font-bold">{network ? 'No pudimos cargar tus datos' : 'Algo falló de nuestro lado'}</p>
      <p className="mt-1 max-w-xs text-muted-foreground">
        {network ? 'Puede ser la señal. Tus datos están guardados, no se perdió nada.' : 'No es tu culpa. Tus datos están guardados.'}
      </p>
      <Button className="mt-5 h-12 px-8" onClick={onRetry}>
        Intentar de nuevo
      </Button>
    </div>
  )
}

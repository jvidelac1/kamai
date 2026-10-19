import { useEffect } from 'react'
import { useMutation } from '@tanstack/react-query'
import { CircleDot, RefreshCw, Sparkles, WifiOff } from 'lucide-react'
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Notice } from './Notice'
import { api } from '@/lib/api'
import { useUi } from '@/lib/ui'
import type { Plan } from '@/lib/types'

/** "¿Cómo lo hago?": subtareas de la IA, con los pasos de la guía si la IA no está disponible. */
export function StepHelpDrawer({ plan, stepIndex, onClose }: { plan: Plan; stepIndex: number | null; onClose: () => void }) {
  const { aiDown } = useUi()
  const help = useMutation({ mutationFn: (i: number) => api.subTasks(plan.id, i, aiDown) })
  const { mutate, reset } = help

  useEffect(() => {
    if (stepIndex !== null) mutate(stepIndex)
    else reset()
  }, [stepIndex, mutate, reset])

  const step = stepIndex !== null ? plan.steps[stepIndex] : null
  const data = help.data
  const subSteps = data?.steps[0]?.subSteps ?? []

  return (
    <Drawer open={stepIndex !== null} onOpenChange={(o) => !o && onClose()}>
      <DrawerContent>
        <div className="mx-auto w-full max-w-md px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
          <DrawerHeader className="px-0 text-left">
            <DrawerDescription>Paso {(stepIndex ?? 0) + 1}</DrawerDescription>
            <DrawerTitle className="text-xl">{step?.title}</DrawerTitle>
          </DrawerHeader>

          {help.isPending && (
            <div className="space-y-2" aria-busy="true">
              <Skeleton className="h-12 w-full rounded-xl" />
              <Skeleton className="h-12 w-full rounded-xl" />
            </div>
          )}

          {help.isError && (
            <Notice tone="warn" icon={WifiOff} title="Sin conexión">
              No pudimos traer ayuda ahora. Prueba de nuevo en un rato.
            </Notice>
          )}

          {data?.source === 'ai' && (
            <>
              <p className="mb-2 flex items-center gap-1 text-sm font-semibold text-primary">
                <Sparkles className="size-4" /> Sugerencias para ti
              </p>
              <ul className="space-y-2">
                {subSteps.map((s) => (
                  <li key={s} className="flex gap-3 rounded-xl bg-muted px-3 py-3">
                    <CircleDot className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                    {s}
                  </li>
                ))}
              </ul>
            </>
          )}

          {data?.source === 'static' && (
            <>
              <Notice tone="info" icon={data.reason === 'NO_QUOTA' ? Sparkles : WifiOff}>
                {data.message}
              </Notice>
              <p className="mb-2 mt-4 text-sm font-semibold text-muted-foreground">Los pasos de la guía</p>
              <ol className="space-y-2">
                {plan.steps.map((s, i) => (
                  <li key={s.title} className={`rounded-xl px-3 py-3 ${i === stepIndex ? 'bg-accent font-semibold' : 'bg-muted'}`}>
                    {i + 1}. {s.title}
                  </li>
                ))}
              </ol>
              {data.retryable && (
                <Button variant="outline" className="mt-4 h-12 w-full" onClick={() => stepIndex !== null && mutate(stepIndex)}>
                  <RefreshCw className="size-4" /> Reintentar
                </Button>
              )}
            </>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  )
}

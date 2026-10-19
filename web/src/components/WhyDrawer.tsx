import type { ReactNode } from 'react'
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer'
import { Separator } from '@/components/ui/separator'
import type { Excluded, RecommendationResponse } from '@/lib/types'

const REASON: Record<Excluded['reason'], string> = {
  OVER_BUDGET: 'Cuesta más que tu presupuesto de este trimestre',
  OVER_TIME: 'Pide más horas por semana de las que tienes',
  ALREADY_IN_PLAN: 'Ya la tienes en tu plan',
  ALREADY_COMPLETED: 'Ya la hiciste',
  NOT_FOR_SECTOR: 'No aplica a tu tipo de negocio',
  OTHER_CATEGORY: 'Es de otro tema',
}

export function WhyDrawer({ data, trigger }: { data: RecommendationResponse; trigger: ReactNode }) {
  const { recommendation: r, explanation: ex } = data
  return (
    <Drawer>
      <DrawerTrigger asChild>{trigger}</DrawerTrigger>
      <DrawerContent>
        <div className="mx-auto max-h-[80dvh] w-full max-w-md overflow-y-auto px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
          <DrawerHeader className="px-0 text-left">
            <DrawerTitle className="text-xl">¿Cómo elegimos?</DrawerTitle>
            <DrawerDescription className="text-base">
              Buscamos algo que entre en tu presupuesto y tu tiempo, que ataque lo que más consume en tu negocio y que otras panaderías hayan podido terminar.
            </DrawerDescription>
          </DrawerHeader>

          {r.alternatives.length > 0 && (
            <section>
              <h3 className="font-bold">También podrías hacer</h3>
              <ul className="mt-2 space-y-2">
                {r.alternatives.map((a) => (
                  <li key={a.ecoId} className="rounded-xl bg-muted px-3 py-2">
                    {a.title}
                  </li>
                ))}
              </ul>
              {ex.next && <p className="mt-2 text-sm text-muted-foreground">{ex.next}</p>}
            </section>
          )}

          {r.excluded.length > 0 && (
            <>
              <Separator className="my-4" />
              <section>
                <h3 className="font-bold">Por ahora no te recomendamos</h3>
                <ul className="mt-2 space-y-3">
                  {r.excluded.map((e) => (
                    <li key={e.ecoId}>
                      <p className="font-semibold leading-snug">{e.title}</p>
                      <p className="text-sm text-muted-foreground">{REASON[e.reason]}</p>
                    </li>
                  ))}
                </ul>
              </section>
            </>
          )}

          <p className="mt-6 text-xs text-muted-foreground">
            Es la misma recomendación que ves en todo Kamai (reglas {r.rulesVersion}).
          </p>
        </div>
      </DrawerContent>
    </Drawer>
  )
}

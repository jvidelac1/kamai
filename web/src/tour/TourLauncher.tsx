import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Landmark, PlayCircle, RotateCcw } from 'lucide-react'
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer'
import { Button } from '@/components/ui/button'
import { useResetDemo } from '@/lib/queries'
import { useUi } from '@/lib/ui'
import { useTour } from './TourProvider'
import { TOURS } from './tours'

/** Solo aparece con ?recorridos en la URL. Necesita el servidor levantado con --demo (npm run start:recorridos). */
export const toursEnabled = () => new URLSearchParams(window.location.search).has('recorridos')

export function TourLauncher() {
  const [open, setOpen] = useState(false)
  const [serverReady, setServerReady] = useState<boolean | null>(null)
  const tour = useTour()
  const reset = useResetDemo()
  const { setView, setTab } = useUi()

  useEffect(() => {
    if (!open) return
    fetch('/internal/demo')
      .then((r) => setServerReady(r.ok))
      .catch(() => setServerReady(false))
  }, [open])

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button variant="outline" size="sm" className="shrink-0 rounded-full" aria-label="Abrir recorridos">
          <PlayCircle className="size-4" /> Recorridos
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        <div className="mx-auto w-full max-w-md px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
          <DrawerHeader className="px-0 text-left">
            <DrawerTitle>Recorridos</DrawerTitle>
            <DrawerDescription>Usan la app como lo haría Inés y verifican cada caso en pantalla.</DrawerDescription>
          </DrawerHeader>
          {serverReady === false ? (
            <p className="rounded-xl bg-warn p-3 text-sm text-warn-foreground">
              Para correrlos, levantá el servidor con <code>npm run start:recorridos</code> (carga los datos del caso y permite reiniciarlos).
            </p>
          ) : (
            <div className="grid gap-2">
              {TOURS.map((t) => (
                <Button
                  key={t.id}
                  className="h-auto justify-start gap-3 py-3 text-left"
                  disabled={!serverReady}
                  onClick={async () => {
                    setOpen(false)
                    const end = Date.now() + 2000
                    while (document.querySelector('[data-slot="drawer-content"]') && Date.now() < end) await new Promise((r) => setTimeout(r, 100))
                    tour.start(t)
                  }}
                >
                  <t.icon className="size-5 shrink-0" />
                  <span>
                    <span className="block font-bold">{t.title}</span>
                    <span className="block text-xs font-normal opacity-90">
                      {t.subtitle} · {t.steps.length} pasos
                    </span>
                  </span>
                </Button>
              ))}
              <Button variant="outline" className="mt-2 h-11 justify-start" onClick={() => { setOpen(false); setView('allies') }}>
                <Landmark className="size-4" /> Vista para aliados
              </Button>
              <Button
                variant="ghost"
                className="h-11 text-muted-foreground"
                disabled={!serverReady}
                onClick={async () => {
                  await reset.mutateAsync()
                  setView('owner')
                  setTab('step')
                  setOpen(false)
                  toast('Datos reiniciados')
                }}
              >
                <RotateCcw className="size-4" /> Volver a los datos del caso
              </Button>
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  )
}

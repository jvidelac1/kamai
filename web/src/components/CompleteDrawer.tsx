import { useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { Frown, Meh, Smile } from 'lucide-react'
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ErrorCallout, FieldMessage } from './ErrorCallout'
import { useCompletePlan } from '@/lib/queries'
import { useUi } from '@/lib/ui'
import { CASO } from '@/lib/caso'
import { friendlyError, type FriendlyError } from '@/lib/errors'
import { todayIso, validateCompletion } from '@/lib/validation'
import { dayMonth } from '@/lib/format'
import { cn } from '@/lib/utils'

const FEELINGS = [
  { scale: 2, label: 'Difícil', icon: Frown },
  { scale: 3, label: 'Normal', icon: Meh },
  { scale: 5, label: 'Fácil', icon: Smile },
]

export function CompleteDrawer({ planId, startedAt, allDone, trigger }: { planId: string; startedAt?: string; allDone: boolean; trigger: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [date, setDate] = useState<string>(CASO.fechaTerminoSugerida)
  const [scale, setScale] = useState<number | undefined>()
  const [note, setNote] = useState('')
  const [tried, setTried] = useState(false)
  const [serverError, setServerError] = useState<FriendlyError | null>(null)
  const complete = useCompletePlan(planId)
  const { setTab } = useUi()
  const today = todayIso()

  const localError = validateCompletion(date, startedAt, today)
  const dateError = (tried && localError) || (serverError?.field === 'completedAt' ? [serverError.message, serverError.hint].filter(Boolean).join(' ') : null)

  const submit = async () => {
    setTried(true)
    setServerError(null)
    if (localError) return
    try {
      await complete.mutateAsync({ completedAt: date, scale, text: note.trim() || undefined })
      setOpen(false)
      toast.success('¡Felicitaciones! Ahora medimos tu ahorro con tus próximas facturas.')
      setTab('savings')
    } catch (e) {
      setServerError(friendlyError(e))
    }
  }

  const alreadyDone = serverError?.code === 'PLAN_ALREADY_COMPLETED'

  return (
    <Drawer
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (o) {
          setTried(false)
          setServerError(null)
        }
      }}
    >
      <DrawerTrigger asChild>{trigger}</DrawerTrigger>
      <DrawerContent>
        <div className="mx-auto w-full max-w-md px-4">
          <DrawerHeader className="px-0 text-left">
            <DrawerTitle className="text-xl">¡Qué bien! Cuéntanos</DrawerTitle>
            <DrawerDescription className="text-base">
              {allDone ? 'Con la fecha sabremos desde cuándo medir tu ahorro.' : 'Todavía hay pasos sin marcar, pero si ya lo terminaste, adelante.'}
            </DrawerDescription>
          </DrawerHeader>
          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="done-date" className="text-base">¿Qué día lo terminaste?</Label>
              <Input
                id="done-date"
                type="date"
                value={date}
                min={startedAt}
                max={today}
                onChange={(e) => {
                  setDate(e.target.value)
                  setServerError(null)
                }}
                className="h-12 text-base"
                aria-invalid={!!dateError}
                aria-describedby="done-date-msg"
              />
              {dateError ? (
                <FieldMessage id="done-date-msg">{dateError}</FieldMessage>
              ) : (
                <FieldMessage id="done-date-msg" tone="help">
                  {startedAt ? `Puede ser desde el ${dayMonth(startedAt)} (cuando empezaste) hasta hoy.` : 'Puede ser hoy o un día anterior.'}
                </FieldMessage>
              )}
            </div>
            <fieldset>
              <legend className="mb-2 text-base font-medium">¿Cómo te fue? <span className="text-muted-foreground">(opcional)</span></legend>
              <div className="grid grid-cols-3 gap-2">
                {FEELINGS.map(({ scale: s, label, icon: Icon }) => (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={scale === s}
                    onClick={() => setScale(scale === s ? undefined : s)}
                    className={cn(
                      'flex h-20 flex-col items-center justify-center gap-1 rounded-2xl border-2 font-semibold transition-colors',
                      scale === s ? 'border-primary bg-accent text-accent-foreground' : 'border-border bg-card',
                    )}
                  >
                    <Icon className="size-7" aria-hidden />
                    {label}
                  </button>
                ))}
              </div>
            </fieldset>
            <div className="space-y-2">
              <Label htmlFor="done-note" className="text-base">
                ¿Quieres contarnos algo? <span className="font-normal text-muted-foreground">(opcional)</span>
              </Label>
              <textarea
                id="done-note"
                rows={2}
                maxLength={500}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Por ejemplo: las refrigeradoras ya no hacen tanto hielo"
                className="w-full rounded-xl border bg-card px-3 py-2 text-base placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              />
              <p className="text-xs text-muted-foreground">Esto es lo que tú notas. Aparte, medimos el ahorro con tus facturas.</p>
            </div>
            {serverError && serverError.field !== 'completedAt' && (
              <ErrorCallout
                error={serverError}
                action={
                  alreadyDone ? (
                    <Button variant="outline" className="h-11 bg-card" onClick={() => { setOpen(false); setTab('savings') }}>
                      Ver mi ahorro
                    </Button>
                  ) : serverError.kind !== 'fixable' ? (
                    <Button variant="outline" className="h-11 bg-card" onClick={submit}>
                      Intentar de nuevo
                    </Button>
                  ) : undefined
                }
              />
            )}
          </div>
        </div>
        <DrawerFooter className="mx-auto w-full max-w-md pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <Button size="lg" className="h-14 rounded-2xl text-lg font-bold" onClick={submit} disabled={complete.isPending}>
            {complete.isPending ? 'Guardando…' : 'Listo, lo terminé'}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}

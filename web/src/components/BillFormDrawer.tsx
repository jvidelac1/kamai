import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Camera, CalendarDays, ChevronDown, HelpCircle, Trash2, X } from 'lucide-react'
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ErrorCallout, FieldMessage } from './ErrorCallout'
import { BillGuide } from './BillGuide'
import { useAddBill, useBills, useBusiness, useDeleteBill, useUpdateBill } from '@/lib/queries'
import { useUi } from '@/lib/ui'
import { friendlyError, type FriendlyError } from '@/lib/errors'
import { checkBill, todayIso } from '@/lib/validation'
import { dayMonth, dec, money, monthName, nextPeriod } from '@/lib/format'
import { cn } from '@/lib/utils'

const FIELD_FROM_SERVER: Record<string, 'kwh' | 'price' | 'dates'> = {
  kwhConsumed: 'kwh',
  costPerKwh: 'price',
  billingStartDate: 'dates',
  billingEndDate: 'dates',
}

/** Subir o editar una factura: lo único que hay que escribir es el número de kWh. */
export function BillFormDrawer() {
  const { billForm, closeBillForm, openBillForm } = useUi()
  const editing = billForm.bill
  const { data: bills } = useBills()
  const { data: business } = useBusiness()
  const cur = business?.currency ?? 'S/'
  const add = useAddBill()
  const update = useUpdateBill()
  const del = useDeleteBill()

  const last = bills?.bills.at(-1)
  const [kwh, setKwh] = useState('')
  const [price, setPrice] = useState('')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [photo, setPhoto] = useState<string | null>(null)
  const [showDates, setShowDates] = useState(false)
  const [showGuide, setShowGuide] = useState(false)
  const [tried, setTried] = useState(false) // mostramos errores recién después del primer intento
  const [warningsOk, setWarningsOk] = useState(false)
  const [serverError, setServerError] = useState<FriendlyError | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Al abrir: sugerimos el siguiente periodo y la última tarifa, o cargamos la factura a editar.
  useEffect(() => {
    if (!billForm.open) return
    setServerError(null)
    setConfirmDelete(false)
    setShowDates(false)
    setShowGuide(false)
    setTried(false)
    setWarningsOk(false)
    if (editing) {
      setKwh(String(editing.kwhConsumed))
      setPrice(dec(editing.costPerKwh, 2))
      setStart(editing.billingStartDate)
      setEnd(editing.billingEndDate)
      setPhoto(editing.uploadedFiles?.[0] ?? null)
    } else {
      const p = nextPeriod(last?.billingEndDate)
      setKwh('')
      setPrice(last ? dec(last.costPerKwh, 2) : '')
      setStart(p.start)
      setEnd(p.end)
      setPhoto(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [billForm.open, editing?.id])

  const today = todayIso()
  const check = useMemo(
    () => checkBill({ kwh, price, start, end }, { bills: bills?.bills ?? [], editingId: editing?.id, currency: cur, today }),
    [kwh, price, start, end, bills, editing?.id, cur, today],
  )

  // Errores visibles: los del celular tras el primer intento, o los que devolvió el servidor por campo.
  const serverField = serverError?.field ? FIELD_FROM_SERVER[serverError.field] : undefined
  const fieldError = (f: 'kwh' | 'price' | 'dates') => (tried ? check.errors[f] : undefined) ?? (serverField === f ? serverError?.message : undefined)
  const hasWarnings = Object.keys(check.warnings).length > 0
  const conflictBill = check.overlap ?? bills?.bills.find((b) => b.id === serverError?.details.conflictsWith)

  // Si el problema está en las fechas, las mostramos (no escondemos el campo con el error).
  useEffect(() => {
    if (fieldError('dates')) setShowDates(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tried, serverError, check.errors.dates])

  const submit = async () => {
    setTried(true)
    setServerError(null)
    if (!check.parsed) return
    if (hasWarnings && !warningsOk) {
      setWarningsOk(true) // segundo toque = "sí, está bien"
      return
    }
    const input = { ...check.parsed, uploadedFiles: photo ? [photo] : [] }
    try {
      if (editing) await update.mutateAsync({ id: editing.id, input })
      else await add.mutateAsync(input)
      toast.success(editing ? 'Factura corregida. Recalculamos tu ahorro.' : 'Factura guardada. ¡Gracias!')
      closeBillForm()
    } catch (e) {
      setServerError(friendlyError(e))
    }
  }

  const remove = async () => {
    if (!editing) return
    if (!confirmDelete) return setConfirmDelete(true)
    try {
      await del.mutateAsync(editing.id)
      toast('Factura borrada. Recalculamos tu ahorro.')
      closeBillForm()
    } catch (e) {
      setServerError(friendlyError(e))
    }
  }

  const busy = add.isPending || update.isPending || del.isPending
  const blocking = tried && !check.parsed
  const submitLabel = busy ? 'Guardando…' : warningsOk && hasWarnings ? 'Sí, está bien. Guardar' : editing ? 'Guardar cambios' : 'Guardar factura'
  const errId = (f: string) => `bill-${f}-msg`

  return (
    <Drawer open={billForm.open} onOpenChange={(o) => !o && closeBillForm()} repositionInputs={false}>
      <DrawerContent className="max-h-[92dvh]">
        <div className="mx-auto w-full max-w-md overflow-y-auto px-4">
          <DrawerHeader className="px-0 text-left">
            <DrawerTitle className="text-xl">{editing ? `Factura de ${monthName(editing.billingStartDate)}` : 'Subir factura de luz'}</DrawerTitle>
            <DrawerDescription className="text-base">
              {start && end && end >= start ? `Del ${dayMonth(start)} al ${dayMonth(end)}.` : 'Elige las fechas del periodo.'}{' '}
              <button type="button" className="font-semibold text-primary underline-offset-2 hover:underline" onClick={() => setShowDates((v) => !v)}>
                {showDates ? 'Listo' : 'Cambiar fechas'}
              </button>
            </DrawerDescription>
          </DrawerHeader>

          <div className="space-y-5 pb-2">
            <button
              type="button"
              onClick={() => setShowGuide((v) => !v)}
              aria-expanded={showGuide}
              className="flex w-full items-center gap-2 rounded-2xl bg-info px-4 py-3 text-left font-semibold text-info-foreground"
            >
              <HelpCircle className="size-5 shrink-0" aria-hidden />
              <span className="flex-1">¿Dónde encuentro estos datos en mi factura?</span>
              <ChevronDown className={cn('size-5 transition-transform', showGuide && 'rotate-180')} aria-hidden />
            </button>
            {showGuide && <BillGuide />}

            {showDates && (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="bill-start"><CalendarDays className="size-4" /> Desde</Label>
                    <Input id="bill-start" type="date" value={start} max={today} onChange={(e) => setStart(e.target.value)} className="h-12 text-base" aria-invalid={!!fieldError('dates')} aria-describedby={errId('dates')} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="bill-end"><CalendarDays className="size-4" /> Hasta</Label>
                    <Input id="bill-end" type="date" value={end} min={start || undefined} max={today} onChange={(e) => setEnd(e.target.value)} className="h-12 text-base" aria-invalid={!!fieldError('dates')} aria-describedby={errId('dates')} />
                  </div>
                </div>
                {fieldError('dates') && (
                  <FieldMessage id={errId('dates')}>
                    {fieldError('dates')}
                    {conflictBill && (
                      <Button variant="link" className="h-auto p-0 pl-1 font-bold text-destructive underline" onClick={() => openBillForm(conflictBill)}>
                        Ver la de {monthName(conflictBill.billingStartDate)}
                      </Button>
                    )}
                  </FieldMessage>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="bill-kwh" className="text-base">¿Cuántos kWh dice tu factura?</Label>
              <div className="relative">
                <Input
                  id="bill-kwh"
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="Ej: 1.720"
                  value={kwh}
                  onChange={(e) => {
                    setKwh(e.target.value)
                    setWarningsOk(false)
                  }}
                  className="h-16 pr-16 text-3xl font-extrabold tracking-tight placeholder:text-xl placeholder:font-normal placeholder:text-muted-foreground/70"
                  aria-invalid={!!fieldError('kwh')}
                  aria-describedby={errId('kwh')}
                />
                <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-lg font-semibold text-muted-foreground">kWh</span>
              </div>
              {fieldError('kwh') ? (
                <FieldMessage id={errId('kwh')}>{fieldError('kwh')}</FieldMessage>
              ) : check.warnings.kwh && check.parsed ? (
                <FieldMessage id={errId('kwh')} tone="warn">{check.warnings.kwh}</FieldMessage>
              ) : (
                <FieldMessage id={errId('kwh')} tone="help">Búscalo como “consumo” o “energía activa”.</FieldMessage>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="bill-price" className="text-base">Precio por kWh</Label>
              <div className="relative">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lg font-semibold text-muted-foreground">{cur}</span>
                <Input
                  id="bill-price"
                  inputMode="decimal"
                  placeholder="0,84"
                  value={price}
                  onChange={(e) => {
                    setPrice(e.target.value)
                    setWarningsOk(false)
                  }}
                  className="h-12 pl-12 text-lg font-semibold"
                  aria-invalid={!!fieldError('price')}
                  aria-describedby={errId('price')}
                />
              </div>
              {fieldError('price') ? (
                <FieldMessage id={errId('price')}>{fieldError('price')}</FieldMessage>
              ) : check.warnings.price ? (
                <FieldMessage id={errId('price')} tone="warn">{check.warnings.price}</FieldMessage>
              ) : (
                !editing && last && <FieldMessage id={errId('price')} tone="help">Pusimos el de tu última factura. Cámbialo si subió.</FieldMessage>
              )}
            </div>

            {editing?.photoStatus === 'unreadable' && photo === editing.uploadedFiles?.[0] && (
              <div role="note" className="rounded-2xl bg-warn px-4 py-3 text-sm leading-snug text-warn-foreground">
                <p className="font-bold">No pudimos leer la foto de esta factura</p>
                <p className="mt-1">
                  Tu factura cuenta igual con los números que escribiste. Si puedes, toma otra foto con buena luz y sin sombras: así tu ahorro queda verificado ante el programa.
                </p>
              </div>
            )}

            <div>
              {photo ? (
                <div className="flex items-center gap-3 rounded-2xl bg-muted px-4 py-3">
                  <Camera className="size-5 text-primary" aria-hidden />
                  <span className="min-w-0 flex-1 truncate">{photo}</span>
                  <Button variant="ghost" size="icon" onClick={() => setPhoto(null)} aria-label="Quitar foto">
                    <X className="size-4" />
                  </Button>
                </div>
              ) : (
                <label className="flex h-14 cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed font-semibold text-muted-foreground transition-colors hover:bg-muted">
                  <Camera className="size-5" /> Tomar foto de la factura <span className="font-normal">(opcional)</span>
                  {/* La foto va al almacenamiento de archivos existente; aquí solo guardamos su nombre. */}
                  <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => setPhoto(e.target.files?.[0]?.name ?? null)} />
                </label>
              )}
              <p className="mt-1.5 text-sm text-muted-foreground">Si la foto no se lee bien, igual guardamos lo que escribiste.</p>
            </div>

            {check.parsed && (
              <div className="rounded-2xl bg-accent px-4 py-3 text-accent-foreground" aria-live="polite">
                Total {money(cur, check.parsed.kwhConsumed * check.parsed.costPerKwh)} · <strong>{dec(check.parsed.kwhPerDay)} kWh por día</strong>
                <span className="block text-sm opacity-80">Revisa que el total se parezca al de tu factura.</span>
              </div>
            )}

            {blocking && (
              <p role="alert" className="text-center font-semibold text-destructive">
                {Object.keys(check.errors).length > 1 ? 'Hay datos para revisar: están marcados en rojo.' : 'Revisa el dato marcado en rojo.'}
              </p>
            )}
            {warningsOk && hasWarnings && !blocking && (
              <p role="status" className="rounded-2xl bg-warn px-4 py-3 text-warn-foreground">
                Revisa los avisos en amarillo. Si está todo bien, toca <strong>“Sí, está bien. Guardar”</strong>.
              </p>
            )}
            {serverError && !serverField && (
              <ErrorCallout
                error={serverError}
                action={
                  serverError.kind !== 'fixable' && (
                    <Button variant="outline" className="h-11 bg-card" onClick={submit}>
                      Intentar de nuevo
                    </Button>
                  )
                }
              />
            )}
          </div>
        </div>
        <DrawerFooter className="mx-auto w-full max-w-md pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <Button size="lg" className="h-14 rounded-2xl text-lg font-bold" onClick={submit} disabled={busy}>
            {submitLabel}
          </Button>
          {editing && (
            <Button variant="ghost" className="h-12 text-destructive" onClick={remove} disabled={busy}>
              <Trash2 className="size-4" /> {confirmDelete ? 'Sí, borrar esta factura' : 'Borrar factura'}
            </Button>
          )}
          {editing && confirmDelete && <p className="text-center text-sm text-muted-foreground">Al borrarla, recalculamos tu ahorro sin esta factura.</p>}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}

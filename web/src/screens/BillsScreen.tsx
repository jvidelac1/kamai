import { Camera, CameraOff, ChevronRight, History, Info, Plus, ReceiptText } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Notice } from '@/components/Notice'
import { ConsumptionChart } from '@/components/ConsumptionChart'
import { ErrorState, ScreenSkeleton } from '@/components/States'
import { useBills, useFirstStepPlan, useSavings } from '@/lib/queries'
import { useUi } from '@/lib/ui'
import { dayMonth, dec, money, monthName, monthYear, thousands } from '@/lib/format'

export function BillsScreen() {
  const bills = useBills()
  const { planId } = useFirstStepPlan()
  const savings = useSavings(planId)
  const { openBillForm } = useUi()

  if (bills.isPending) return <ScreenSkeleton />
  if (bills.isError) return <ErrorState error={bills.error} onRetry={() => bills.refetch()} />

  const { currency, comparisons } = bills.data
  const list = [...bills.data.bills].reverse()
  const misleading = comparisons.find((c) => c.verdict === 'NAIVE_SAVING_IS_MISLEADING')
  const misleadingBill = misleading && bills.data.bills.find((b) => b.id === misleading.to)

  return (
    <div className="mt-2 space-y-4">
      <Button size="lg" className="h-14 w-full rounded-2xl text-lg font-bold" onClick={() => openBillForm()}>
        <Plus className="size-5" /> Subir factura de luz
      </Button>

      {bills.data.bills.length > 1 && (
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-5">
            <h2 className="font-bold">Tu consumo por día</h2>
            <p className="mb-3 text-sm text-muted-foreground">En kWh, mes a mes</p>
            <ConsumptionChart bills={bills.data.bills} measurement={savings.data?.measurement} currency={currency} />
          </CardContent>
        </Card>
      )}

      {misleading && misleadingBill && (
        <Notice tone="warn" icon={Info} title="Cambiamos cómo medimos">
          Antes te mostramos “ahorraste {money(currency, misleading.naiveSaving)}” en {monthName(misleadingBill.billingStartDate)}. Pero ese mes tuvo{' '}
          {Math.abs(misleading.daysDifference)} días menos: por día gastaste {dec(misleading.kwhPerDayChangePct)}% más. Ahora comparamos siempre por día.
        </Notice>
      )}

      {bills.data.corrections.length > 0 && (
        <Card className="border-0 shadow-sm" data-tour="corrections">
          <CardContent className="py-4">
            <h2 className="flex items-center gap-2 font-bold">
              <History className="size-4 text-muted-foreground" aria-hidden /> Tus cambios recientes
            </h2>
            <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
              {bills.data.corrections.map((c) => (
                <li key={`${c.billId}-${c.at}`}>{c.text}</li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-muted-foreground">Cada cambio recalcula tu ahorro desde cero: nunca se suma dos veces.</p>
          </CardContent>
        </Card>
      )}

      {list.length === 0 ? (
        <div className="mt-10 text-center text-muted-foreground">
          <ReceiptText className="mx-auto size-10" aria-hidden />
          <p className="mt-3">Todavía no subiste facturas. Con 3 facturas ya conocemos tu consumo normal.</p>
        </div>
      ) : (
        <section aria-label="Tus facturas">
          <h2 className="mb-2 px-1 text-sm font-semibold text-muted-foreground">Tus facturas ({list.length})</h2>
          <ul className="space-y-2">
            {list.map((b) => (
              <li key={b.id}>
                <button type="button" onClick={() => openBillForm(b)} className="w-full text-left">
                  <Card className="border-0 shadow-sm transition-colors active:bg-muted">
                    <CardContent className="flex items-center gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-bold">{monthYear(b.billingStartDate)}</p>
                        <p className="text-sm text-muted-foreground">
                          {thousands(b.kwhConsumed)} kWh · {money(currency, b.totalCost)}
                        </p>
                        {b.updatedAt && <p className="text-xs font-semibold text-muted-foreground">Corregida el {dayMonth(b.updatedAt)}</p>}
                        {b.photoStatus === 'unreadable' && (
                          <p className="mt-0.5 text-xs font-semibold text-warn-foreground">La foto no se lee: toca para subir otra</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="font-bold">{dec(b.kwhPerDay)}</p>
                        <p className="text-xs text-muted-foreground">kWh/día</p>
                      </div>
                      {b.photoStatus === 'unreadable' ? (
                        <CameraOff className="size-4 text-warn-foreground" aria-label="La foto no se lee" />
                      ) : b.uploadedFiles?.length ? (
                        <Camera className="size-4 text-muted-foreground" aria-label="Con foto" />
                      ) : (
                        <span className="text-[0.65rem] font-semibold uppercase text-muted-foreground">sin foto</span>
                      )}
                      <ChevronRight className="size-5 text-muted-foreground" aria-hidden />
                    </CardContent>
                  </Card>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

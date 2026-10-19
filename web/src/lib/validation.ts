// Validación en el celular, antes de enviar: mismas frases que el servidor + avisos suaves de "¿seguro?".
import type { Bill } from './types'
import { dayMonth, dec, monthName, parseDecimal } from './format'

export const todayIso = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000) + 1

/** "Ya lo terminé": devuelve el mensaje del problema, o null si la fecha sirve. */
export function validateCompletion(date: string, startedAt: string | undefined, today: string): string | null {
  if (!date) return 'Elige en el calendario el día en que lo terminaste.'
  if (startedAt && date < startedAt) return `Pusiste el ${dayMonth(date)}, pero empezaste este paso el ${dayMonth(startedAt)}. Elige un día desde el ${dayMonth(startedAt)} en adelante.`
  if (date > today) return `El ${dayMonth(date)} todavía no llegó. Elige hoy o un día anterior.`
  return null
}

export interface BillDraft {
  kwh: string
  price: string
  start: string
  end: string
}

export interface BillCheck {
  errors: Partial<Record<'kwh' | 'price' | 'dates', string>>
  warnings: Partial<Record<'kwh' | 'price', string>>
  /** Factura existente con la que se cruzan las fechas (para ofrecer "corregir esa"). */
  overlap?: Bill
  parsed?: { kwhConsumed: number; costPerKwh: number; billingStartDate: string; billingEndDate: string; days: number; kwhPerDay: number }
}

const median = (xs: number[]) => {
  if (!xs.length) return undefined
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

export function checkBill(d: BillDraft, ctx: { bills: Bill[]; editingId?: string; currency: string; today: string }): BillCheck {
  const out: BillCheck = { errors: {}, warnings: {} }
  const others = ctx.bills.filter((b) => b.id !== ctx.editingId)

  // kWh
  const kwh = parseDecimal(d.kwh, { dotIsThousands: true })
  if (!d.kwh.trim()) out.errors.kwh = 'Escribe los kWh que dice tu factura (por ejemplo 1.720).'
  else if (Number.isNaN(kwh)) out.errors.kwh = 'Escribe solo números, por ejemplo 1.720.'
  else if (kwh <= 0) out.errors.kwh = 'Los kWh tienen que ser más que cero.'

  // Precio
  const price = parseDecimal(d.price)
  if (!d.price.trim()) out.errors.price = 'Escribe el precio por kWh (por ejemplo 0,84).'
  else if (Number.isNaN(price)) out.errors.price = 'Escribe el precio con números, por ejemplo 0,84.'
  else if (price <= 0) out.errors.price = 'El precio por kWh tiene que ser más que cero.'
  else if (price > 10) out.errors.price = `Ese precio por kWh es muy alto. ¿Quisiste poner ${dec(price / 100, 2)}?`

  // Fechas
  let days = 0
  if (!d.start || !d.end) out.errors.dates = 'Elige las dos fechas del periodo.'
  else if (d.end < d.start) out.errors.dates = 'La fecha “hasta” tiene que ser después de la fecha “desde”.'
  else {
    days = daysBetween(d.start, d.end)
    if (days > 62) out.errors.dates = `El periodo dura ${days} días. Una factura de luz suele cubrir un mes: revisa las fechas.`
    else if (d.end > ctx.today) out.errors.dates = `La factura termina el ${dayMonth(d.end)}, que todavía no llegó. Revisa las fechas.`
    else {
      out.overlap = others.find((b) => d.start <= b.billingEndDate && b.billingStartDate <= d.end)
      if (out.overlap)
        out.errors.dates = `Estas fechas se cruzan con tu factura de ${monthName(out.overlap.billingStartDate)} (del ${dayMonth(out.overlap.billingStartDate)} al ${dayMonth(out.overlap.billingEndDate)}). Cada día va en una sola factura.`
    }
  }

  // Avisos suaves: no bloquean, pero piden confirmar (ceros de más o de menos, coma corrida).
  if (!out.errors.kwh && !out.errors.dates && days > 0) {
    const perDay = kwh / days
    const normal = median(others.map((b) => b.kwhPerDay))
    if (normal && perDay > normal * 1.5)
      out.warnings.kwh = `Son ${dec(perDay)} kWh por día, bastante más de lo normal en tu negocio (≈ ${dec(normal)}). ¿Está bien el número? Revisa que no sobre un cero.`
    else if (normal && perDay < normal * 0.5)
      out.warnings.kwh = `Son ${dec(perDay)} kWh por día, bastante menos de lo normal en tu negocio (≈ ${dec(normal)}). ¿Está bien el número? Revisa que no falte una cifra.`
  }
  if (!out.errors.price) {
    const last = [...others].sort((a, b) => a.billingEndDate.localeCompare(b.billingEndDate)).at(-1)?.costPerKwh
    if (last && (price > last * 1.5 || price < last / 1.5))
      out.warnings.price = `Tu última factura decía ${ctx.currency} ${dec(last, 2)} por kWh. ¿Seguro que ahora es ${dec(price, 2)}?`
  }

  if (!Object.keys(out.errors).length) {
    out.parsed = { kwhConsumed: kwh, costPerKwh: price, billingStartDate: d.start, billingEndDate: d.end, days, kwhPerDay: kwh / days }
  }
  return out
}

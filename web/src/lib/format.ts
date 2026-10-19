// Formatos para Perú/Bolivia: coma decimal, punto de miles, meses en palabras.

export const dec = (n: number, d = 1) => Number(n).toFixed(d).replace('.', ',')

export const thousands = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')

/** "S/ 1.200" con espacio que no se corta (el símbolo nunca queda solo al final de una línea). */
const NBSP = String.fromCharCode(160)
export const money = (currency: string, n: number) => `${currency}${NBSP}${thousands(n)}`

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

const parts = (iso: string) => iso.slice(0, 10).split('-').map(Number) as [number, number, number]

export const monthName = (iso: string) => MONTHS[parts(iso)[1] - 1]
export const monthShort = (iso: string) => MONTHS_SHORT[parts(iso)[1] - 1]
export const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** "Septiembre 2026" */
export const monthYear = (iso: string) => `${capitalize(monthName(iso))} ${parts(iso)[0]}`

/** "10 de julio" */
export const dayMonth = (iso: string) => `${parts(iso)[2]} de ${monthName(iso)}`

/**
 * Lee números como se escriben en el recibo. Devuelve NaN si no es un número.
 * - kWh (`dotIsThousands`): "1.665" = 1665, "1665,5" = 1665.5
 * - precio: "0,84" = "0.84" = 0.84
 */
export function parseDecimal(s: string, { dotIsThousands = false } = {}) {
  let t = String(s).trim().replace(/\s/g, '')
  if (!t) return NaN
  if (dotIsThousands || t.includes(',')) t = t.replace(/\./g, '').replace(',', '.')
  return /^\d+(\.\d+)?$/.test(t) ? Number(t) : NaN
}

const pad = (n: number) => String(n).padStart(2, '0')
const toIso = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`

/** Periodo sugerido para el siguiente recibo: el mes que sigue al último. */
export function nextPeriod(lastEndIso?: string) {
  const [y, m, day] = lastEndIso ? parts(lastEndIso) : parts(new Date().toISOString())
  const start = new Date(Date.UTC(y, m - 1, day + 1))
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0))
  return { start: toIso(start), end: toIso(end) }
}

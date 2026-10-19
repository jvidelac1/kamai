import { describe, it, expect } from 'vitest'
import { checkBill, validateCompletion } from '../validation'
import { parseDecimal } from '../format'
import { friendlyError } from '../errors'
import { ApiError } from '../api'
import type { Bill } from '../types'

const bill = (id: string, start: string, end: string, kwh: number, price: number): Bill => {
  const days = Math.round((Date.parse(end) - Date.parse(start)) / 86_400_000) + 1
  return { id, kwhConsumed: kwh, costPerKwh: price, billingStartDate: start, billingEndDate: end, days, totalCost: kwh * price, kwhPerDay: kwh / days }
}
const BILLS = [
  bill('may', '2026-05-01', '2026-05-31', 1880, 0.81),
  bill('jun', '2026-06-01', '2026-06-30', 1720, 0.84),
]
const ctx = { bills: BILLS, currency: 'S/', today: '2026-10-20' }
const ok = { kwh: '1.800', price: '0,84', start: '2026-07-01', end: '2026-07-31' }

describe('números como se escriben en la factura', () => {
  it('kWh: el punto es separador de miles', () => {
    expect(parseDecimal('1.800', { dotIsThousands: true })).toBe(1800)
    expect(parseDecimal('1800,5', { dotIsThousands: true })).toBe(1800.5)
  })
  it('precio: coma o punto decimal', () => {
    expect(parseDecimal('0,84')).toBe(0.84)
    expect(parseDecimal('0.84')).toBe(0.84)
  })
  it('lo que no es número da NaN', () => {
    expect(parseDecimal('abc')).toBeNaN()
    expect(parseDecimal('')).toBeNaN()
  })
})

describe('"Ya lo terminé": fecha', () => {
  it('antes de empezar: dice ambas fechas y qué elegir', () => {
    expect(validateCompletion('2026-06-05', '2026-07-01', '2026-10-20')).toBe(
      'Pusiste el 5 de junio, pero empezaste este paso el 1 de julio. Elige un día desde el 1 de julio en adelante.',
    )
  })
  it('en el futuro', () => {
    expect(validateCompletion('2026-12-01', '2026-07-01', '2026-10-20')).toBe('El 1 de diciembre todavía no llegó. Elige hoy o un día anterior.')
  })
  it('vacía', () => {
    expect(validateCompletion('', '2026-07-01', '2026-10-20')).toContain('Elige en el calendario')
  })
  it('una fecha válida no da error', () => {
    expect(validateCompletion('2026-07-10', '2026-07-01', '2026-10-20')).toBeNull()
  })
})

describe('factura: errores por campo', () => {
  it('todo bien: sin errores ni avisos, y calcula kWh por día', () => {
    const c = checkBill(ok, ctx)
    expect(c.errors).toEqual({})
    expect(c.warnings).toEqual({})
    expect(c.parsed?.kwhPerDay).toBeCloseTo(58.06, 2)
  })
  it('vacío y letras', () => {
    expect(checkBill({ ...ok, kwh: '' }, ctx).errors.kwh).toContain('Escribe los kWh')
    expect(checkBill({ ...ok, kwh: 'mil' }, ctx).errors.kwh).toBe('Escribe solo números, por ejemplo 1.720.')
  })
  it('"84" en vez de "0,84": sugiere el valor correcto', () => {
    expect(checkBill({ ...ok, price: '84' }, ctx).errors.price).toBe('Ese precio por kWh es muy alto. ¿Quisiste poner 0,84?')
  })
  it('fechas al revés, muy largas o en el futuro', () => {
    expect(checkBill({ ...ok, start: '2026-07-31', end: '2026-07-01' }, ctx).errors.dates).toContain('“hasta” tiene que ser después')
    expect(checkBill({ ...ok, start: '2026-07-01', end: '2026-10-15' }, ctx).errors.dates).toContain('El periodo dura 107 días')
    expect(checkBill({ ...ok, start: '2026-10-01', end: '2026-10-31' }, ctx).errors.dates).toBe('La factura termina el 31 de octubre, que todavía no llegó. Revisa las fechas.')
  })
  it('fechas que se cruzan: nombra la otra factura y la devuelve para ofrecer corregirla', () => {
    const c = checkBill({ ...ok, start: '2026-06-15', end: '2026-07-14' }, ctx)
    expect(c.errors.dates).toBe('Estas fechas se cruzan con tu factura de junio (del 1 de junio al 30 de junio). Cada día va en una sola factura.')
    expect(c.overlap?.id).toBe('jun')
  })
  it('al editar, no choca consigo misma', () => {
    const c = checkBill({ kwh: '1700', price: '0,84', start: '2026-06-01', end: '2026-06-30' }, { ...ctx, editingId: 'jun' })
    expect(c.errors).toEqual({})
  })
})

describe('factura: avisos suaves de "¿seguro?"', () => {
  it('un cero de más', () => {
    expect(checkBill({ ...ok, kwh: '18.000' }, ctx).warnings.kwh).toContain('bastante más de lo normal')
  })
  it('una cifra de menos', () => {
    expect(checkBill({ ...ok, kwh: '180' }, ctx).warnings.kwh).toContain('bastante menos de lo normal')
  })
  it('precio muy distinto al de la última factura', () => {
    expect(checkBill({ ...ok, price: '2,40' }, ctx).warnings.price).toBe('Tu última factura decía S/ 0,84 por kWh. ¿Seguro que ahora es 2,40?')
  })
  it('los avisos no bloquean: igual hay datos para guardar', () => {
    expect(checkBill({ ...ok, kwh: '18.000' }, ctx).parsed).toBeDefined()
  })
})

describe('errores traducidos para personas', () => {
  it('sin señal', () => {
    const f = friendlyError(new ApiError(0, null))
    expect(f).toMatchObject({ kind: 'network', title: 'Sin conexión' })
    expect(f.hint).toContain('Lo que escribiste sigue aquí')
  })
  it('problema nuestro', () => {
    expect(friendlyError(new ApiError(500, { error: 'INTERNAL' }))).toMatchObject({ kind: 'ours', message: 'Es un problema nuestro, no tuyo.' })
  })
  it('algo que ella puede arreglar: usa el mensaje, la pista y el campo del servidor', () => {
    const f = friendlyError(new ApiError(400, { error: 'COMPLETED_BEFORE_START', message: 'Pusiste el 5 de junio…', hint: 'Elige…', field: 'completedAt' }))
    expect(f).toMatchObject({ kind: 'fixable', code: 'COMPLETED_BEFORE_START', field: 'completedAt', message: 'Pusiste el 5 de junio…', hint: 'Elige…' })
  })
})

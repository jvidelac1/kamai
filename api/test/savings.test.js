import { describe, it, expect } from 'vitest';
import { measureSavings, STATUS, inputsHash } from '../src/domain/savings.js';
import { normalizeBill, compareConsecutive, billDays } from '../src/domain/bills.js';
import { INES_BILLS, INES_SIMULATED_POST_BILLS } from '../src/seed/data.js';

const [JAN, FEB, , , , JUN] = INES_BILLS;
const [JUL, AUG, SEP] = INES_SIMULATED_POST_BILLS;
const burletes = { startedAt: '2026-07-01', completedAt: '2026-07-10' };

describe('normalización de facturas (anexo)', () => {
  it('cuenta los días del periodo de forma inclusiva', () => {
    expect(billDays(JAN)).toBe(31);
    expect(billDays(FEB)).toBe(28);
  });

  it('reproduce el total de la factura de febrero: 1.690 kWh × 0,78 = S/ 1.318', () => {
    expect(normalizeBill(FEB).totalCost).toBeCloseTo(1318.2, 1);
  });
});

describe('el "ahorraste S/ 117" de febrero', () => {
  const cmp = compareConsecutive(JAN, FEB);

  it('la resta simple da ~S/ 117, que es lo que Kamai mostró', () => {
    expect(cmp.naiveSaving).toBeCloseTo(117, 0);
  });

  it('pero por día febrero consumió MÁS que enero (+1,7 %)', () => {
    expect(cmp.kwhPerDayChangePct).toBeGreaterThan(0);
    expect(cmp.kwhPerDayChangePct).toBeCloseTo(1.7, 1);
    expect(cmp.daysDifference).toBe(-3);
  });

  it('y se marca como ahorro engañoso', () => {
    expect(cmp.verdict).toBe('NAIVE_SAVING_IS_MISLEADING');
  });
});

describe('measureSavings — "todavía no podemos saberlo"', () => {
  it('sin facturas suficientes de antes: INSUFFICIENT_BASELINE', () => {
    const m = measureSavings([JAN, FEB], { startedAt: '2026-03-01', completedAt: '2026-03-05' });
    expect(m.status).toBe(STATUS.INSUFFICIENT_BASELINE);
    expect(m.need.baselineBills).toBe(1);
  });

  it('negocio nuevo sin ninguna factura: INSUFFICIENT_BASELINE y pide 3', () => {
    const m = measureSavings([], { startedAt: '2026-07-01' });
    expect(m.status).toBe(STATUS.INSUFFICIENT_BASELINE);
    expect(m.need.baselineBills).toBe(3);
  });

  it('con línea base pero sin factura completa posterior: WAITING_POST_DATA', () => {
    const m = measureSavings([...INES_BILLS, JUL], burletes);
    expect(m.status).toBe(STATUS.WAITING_POST_DATA);
    expect(m.periods.excludedTransition).toEqual(['bill_2026_07']); // julio mezcla antes y después
    expect(m.baseline.kwhPerDay).toBeCloseTo(59.67, 2); // 10.800 kWh / 181 días
  });

  it('la variación natural de Inés es ~2,6 % por mes', () => {
    const m = measureSavings([...INES_BILLS, JUL], burletes);
    expect(m.baseline.naturalVariationPct).toBeCloseTo(2.6, 1);
  });

  it('una baja de 4,5 % con UNA factura posterior queda dentro del ruido: INCONCLUSIVE', () => {
    const m = measureSavings([...INES_BILLS, JUL, AUG], burletes);
    expect(m.status).toBe(STATUS.INCONCLUSIVE);
    expect(m.savings.pct).toBeCloseTo(4.5, 1);
    expect(m.savings.kwhPerDayRange[0]).toBeLessThan(0); // el rango incluye "no ahorró"
  });
});

describe('measureSavings — ahorro medido y corrección por tarifa', () => {
  const m = measureSavings([...INES_BILLS, ...INES_SIMULATED_POST_BILLS], burletes);

  it('con dos facturas posteriores el ahorro supera el ruido: MEASURED', () => {
    expect(m.status).toBe(STATUS.MEASURED);
    expect(m.periods.post).toEqual(['bill_2026_08', 'bill_2026_09']);
    expect(m.savings.kwhPerDayRange[0]).toBeGreaterThan(0);
  });

  it('mide en kWh por día (−5,7 %), no en soles', () => {
    expect(m.post.kwhPerDay).toBeCloseTo(56.26, 2); // 3.432 kWh / 61 días
    expect(m.savings.kwhPerDay).toBeCloseTo(3.41, 2);
    expect(m.savings.pct).toBeCloseTo(5.7, 1);
  });

  it('valoriza a la tarifa vigente (0,86): ~S/ 88 al mes, con rango', () => {
    expect(m.savings.currentTariff).toBe(0.86);
    expect(m.savings.moneyPerMonthAtCurrentTariff).toBe(88);
    const [lo, hi] = m.savings.moneyPerMonthRange;
    expect(lo).toBeGreaterThan(0);
    expect(hi).toBeGreaterThan(m.savings.moneyPerMonthAtCurrentTariff);
  });

  it('separa el efecto de la tarifa: la resta en soles casi no muestra ahorro', () => {
    expect(m.tariffEffect.changePct).toBeGreaterThan(5); // de ~0,806 a 0,86
    expect(m.tariffEffect.naiveMoneyPerMonth).toBeLessThan(m.savings.moneyPerMonthAtCurrentTariff / 2);
  });

  it('declara que no corrige por temporada con menos de 12 meses', () => {
    expect(m.limitations.map((l) => l.code)).toContain('NO_SEASONAL_ADJUSTMENT');
    expect(m.limitations.map((l) => l.code)).toContain('TRANSITION_PERIODS_EXCLUDED');
  });

  it('con el mismo consumo por día pero tarifa más alta, NO reporta ahorro ni pérdida', () => {
    const sameKwhHigherTariff = [
      ...INES_BILLS,
      { id: 'x1', kwhConsumed: Math.round(59.67 * 31), costPerKwh: 0.95, billingStartDate: '2026-08-01', billingEndDate: '2026-08-31' },
      { id: 'x2', kwhConsumed: Math.round(59.67 * 30), costPerKwh: 0.95, billingStartDate: '2026-09-01', billingEndDate: '2026-09-30' },
    ];
    const r = measureSavings(sameKwhHigherTariff, burletes);
    expect(r.status).toBe(STATUS.INCONCLUSIVE);
    expect(Math.abs(r.savings.pct)).toBeLessThan(0.5);
  });

  it('si el consumo sube claramente: INCREASED (no lo esconde)', () => {
    const up = [
      ...INES_BILLS,
      { id: 'u1', kwhConsumed: 66 * 31, costPerKwh: 0.84, billingStartDate: '2026-08-01', billingEndDate: '2026-08-31' },
      { id: 'u2', kwhConsumed: 66 * 30, costPerKwh: 0.84, billingStartDate: '2026-09-01', billingEndDate: '2026-09-30' },
    ];
    expect(measureSavings(up, burletes).status).toBe(STATUS.INCREASED);
  });
});

describe('edición y borrado: recálculo sin doble conteo', () => {
  const all = [...INES_BILLS, ...INES_SIMULATED_POST_BILLS];

  it('es determinista: recalcular N veces da exactamente lo mismo', () => {
    const a = measureSavings(all, burletes);
    for (let i = 0; i < 5; i++) expect(measureSavings(all, burletes)).toEqual(a);
  });

  it('el orden en que llegan las facturas no cambia el resultado ni el hash', () => {
    const shuffled = [all[4], all[8], all[0], all[6], all[2], all[1], all[7], all[3], all[5]];
    expect(measureSavings(shuffled, burletes)).toEqual(measureSavings(all, burletes));
  });

  it('editar una factura cambia el hash y el resultado', () => {
    const edited = all.map((b) => (b.id === 'bill_2026_09' ? { ...b, kwhConsumed: 1750 } : b));
    const before = measureSavings(all, burletes);
    const after = measureSavings(edited, burletes);
    expect(after.inputsHash).not.toBe(before.inputsHash);
    expect(after.status).toBe(STATUS.INCONCLUSIVE);
  });

  it('borrar la última factura posterior vuelve a "todavía no podemos saberlo"', () => {
    const r = measureSavings(all.filter((b) => b.id !== 'bill_2026_09'), burletes);
    expect(r.status).toBe(STATUS.INCONCLUSIVE);
    const r2 = measureSavings(all.filter((b) => !['bill_2026_08', 'bill_2026_09'].includes(b.id)), burletes);
    expect(r2.status).toBe(STATUS.WAITING_POST_DATA);
  });

  it('inputsHash depende de las fechas del plan', () => {
    expect(inputsHash(all, burletes)).not.toBe(inputsHash(all, { ...burletes, completedAt: '2026-07-20' }));
  });
});

describe('lo que guarda la prueba de junio (control)', () => {
  it('junio vs enero: menos kWh por día pero más caro por la tarifa', () => {
    const cmp = compareConsecutive(JAN, JUN);
    expect(cmp.kwhPerDayChangePct).toBeLessThan(0);
    expect(cmp.tariffChangePct).toBeCloseTo(7.7, 1);
  });
});

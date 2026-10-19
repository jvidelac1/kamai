// Medición de ahorro honesta. Función pura: mismas facturas + mismo plan => mismo resultado.
// No guarda incrementos: siempre se recalcula desde las facturas vigentes (sin doble conteo).
import { createHash } from 'node:crypto';
import { normalizeBill, sortByStart, toUtcMs, isoDate, round } from './bills.js';

export const METHOD_VERSION = 'savings-v1';

export const SAVINGS_DEFAULTS = {
  minBaselineBills: 3, // menos de 3 periodos no permiten estimar la variación normal
  minBaselineDays: 80,
  minPostBills: 1, // al menos un periodo completo posterior a terminar la ecoinnovación
  noiseFloorPct: 0.02, // nunca asumimos menos de ±2% de variación natural
  z: 2, // ~95%: solo afirmamos ahorro si el rango completo está por encima de cero
  daysPerMonth: 30,
  seasonalMonthsRequired: 12,
};

export const STATUS = {
  INSUFFICIENT_BASELINE: 'INSUFFICIENT_BASELINE',
  WAITING_POST_DATA: 'WAITING_POST_DATA',
  INCONCLUSIVE: 'INCONCLUSIVE',
  MEASURED: 'MEASURED',
  INCREASED: 'INCREASED',
};

export function inputsHash(bills, plan) {
  const canonical = sortByStart(bills).map((b) => [
    b.id,
    b.kwhConsumed,
    b.costPerKwh,
    String(b.billingStartDate).slice(0, 10),
    String(b.billingEndDate).slice(0, 10),
  ]);
  const payload = JSON.stringify({
    v: METHOD_VERSION,
    bills: canonical,
    startedAt: plan?.startedAt ?? null,
    completedAt: plan?.completedAt ?? null,
  });
  return createHash('sha256').update(payload).digest('hex').slice(0, 16);
}

/**
 * Separa las facturas en:
 *  - baseline: terminan antes de que empezara la implementación
 *  - post: empiezan el día que se completó o después
 *  - transition: periodos mixtos (se excluyen: mezclan antes y después)
 */
export function classifyBills(bills, plan) {
  const startMs = plan?.startedAt ? toUtcMs(plan.startedAt) : plan?.completedAt ? toUtcMs(plan.completedAt) : null;
  const completedMs = plan?.completedAt ? toUtcMs(plan.completedAt) : null;
  const baseline = [];
  const post = [];
  const transition = [];
  for (const b of sortByStart(bills).map(normalizeBill)) {
    const s = toUtcMs(b.billingStartDate);
    const e = toUtcMs(b.billingEndDate);
    if (startMs === null || e < startMs) baseline.push(b);
    else if (completedMs !== null && s >= completedMs) post.push(b);
    else transition.push(b);
  }
  return { baseline, post, transition };
}

const sum = (xs, f) => xs.reduce((acc, x) => acc + f(x), 0);

/** Promedio ponderado por días: un periodo de 31 días pesa más que uno de 28. */
function weightedKwhPerDay(bills) {
  return sum(bills, (b) => b.kwhConsumed) / sum(bills, (b) => b.days);
}

function sampleSd(values) {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, v) => a + v, 0) / values.length;
  const variance = values.reduce((a, v) => a + (v - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function historyMonths(bills) {
  if (!bills.length) return 0;
  const sorted = sortByStart(bills);
  const first = toUtcMs(sorted[0].billingStartDate);
  const last = Math.max(...bills.map((b) => toUtcMs(b.billingEndDate)));
  return round((last - first) / 86_400_000 / 30.44, 1);
}

/**
 * @param {Array} bills facturas de luz de un negocio (contrato POST /user-bill)
 * @param {{startedAt?: string, completedAt?: string}} plan plan de acción de la ecoinnovación
 */
export function measureSavings(bills, plan, options = {}) {
  const cfg = { ...SAVINGS_DEFAULTS, ...options };
  const { baseline, post, transition } = classifyBills(bills, plan);
  const all = [...baseline, ...transition, ...post];
  const latest = all.length
    ? all.reduce((a, b) => (toUtcMs(b.billingEndDate) > toUtcMs(a.billingEndDate) ? b : a))
    : null;
  const months = historyMonths(all);

  const result = {
    methodVersion: METHOD_VERSION,
    inputsHash: inputsHash(bills, plan),
    status: null,
    periods: {
      baseline: baseline.map((b) => b.id),
      post: post.map((b) => b.id),
      excludedTransition: transition.map((b) => b.id),
    },
    limitations: [],
  };

  if (months < cfg.seasonalMonthsRequired) {
    result.limitations.push({
      code: 'NO_SEASONAL_ADJUSTMENT',
      detail: `Hay ${months} meses de historia; con menos de ${cfg.seasonalMonthsRequired} no se puede corregir por temporada.`,
    });
  }
  if (transition.length) {
    result.limitations.push({
      code: 'TRANSITION_PERIODS_EXCLUDED',
      detail: `${transition.length} periodo(s) mezclan antes y después de la implementación y no se usan.`,
    });
  }

  const baselineDays = sum(baseline, (b) => b.days);
  if (baseline.length < cfg.minBaselineBills || baselineDays < cfg.minBaselineDays) {
    result.status = STATUS.INSUFFICIENT_BASELINE;
    result.need = {
      baselineBills: Math.max(0, cfg.minBaselineBills - baseline.length),
      reason: 'Necesitamos al menos 3 facturas de antes de empezar para conocer tu consumo normal.',
    };
    return result;
  }

  const baseKwhPerDay = weightedKwhPerDay(baseline);
  const sd = sampleSd(baseline.map((b) => b.kwhPerDay));
  const noise = Math.max(sd, cfg.noiseFloorPct * baseKwhPerDay);
  result.baseline = {
    bills: baseline.length,
    days: baselineDays,
    kwhPerDay: round(baseKwhPerDay, 2),
    naturalVariationKwhPerDay: round(noise, 2),
    naturalVariationPct: round((noise / baseKwhPerDay) * 100, 1),
  };

  if (!plan?.completedAt || post.length < cfg.minPostBills) {
    result.status = STATUS.WAITING_POST_DATA;
    result.need = {
      postBills: cfg.minPostBills - post.length,
      reason: plan?.completedAt
        ? 'Necesitamos al menos una factura completa que empiece después de terminar la ecoinnovación.'
        : 'La ecoinnovación todavía no está completada.',
      firstUsefulPeriodStartsOnOrAfter: plan?.completedAt ? isoDate(toUtcMs(plan.completedAt)) : null,
    };
    return result;
  }

  const postKwhPerDay = weightedKwhPerDay(post);
  const savedKwhPerDay = baseKwhPerDay - postKwhPerDay;
  const se = noise * Math.sqrt(1 / baseline.length + 1 / post.length);
  const low = savedKwhPerDay - cfg.z * se;
  const high = savedKwhPerDay + cfg.z * se;

  if (low > 0) result.status = STATUS.MEASURED;
  else if (high < 0) result.status = STATUS.INCREASED;
  else result.status = STATUS.INCONCLUSIVE;

  // La tarifa no es mérito ni culpa de la dueña: el ahorro se mide en kWh y se valoriza a la tarifa vigente.
  const currentTariff = latest.costPerKwh;
  const toMonthly = (kwhPerDay) => kwhPerDay * cfg.daysPerMonth * currentTariff;
  const accumulated = sum(post, (b) => (baseKwhPerDay * b.days - b.kwhConsumed) * b.costPerKwh);

  // Lo que mostraría la "resta simple" con la misma información, para dejar en evidencia la diferencia.
  const baseCostPerDay = sum(baseline, (b) => b.totalCost) / baselineDays;
  const postCostPerDay = sum(post, (b) => b.totalCost) / sum(post, (b) => b.days);

  result.post = {
    bills: post.length,
    days: sum(post, (b) => b.days),
    kwhPerDay: round(postKwhPerDay, 2),
  };
  result.savings = {
    kwhPerDay: round(savedKwhPerDay, 2),
    kwhPerDayRange: [round(low, 2), round(high, 2)],
    pct: round((savedKwhPerDay / baseKwhPerDay) * 100, 1),
    pctRange: [round((low / baseKwhPerDay) * 100, 1), round((high / baseKwhPerDay) * 100, 1)],
    kwhPerMonth: round(savedKwhPerDay * cfg.daysPerMonth),
    currentTariff,
    moneyPerMonthAtCurrentTariff: round(toMonthly(savedKwhPerDay)),
    moneyPerMonthRange: [round(toMonthly(low)), round(toMonthly(high))],
    moneyAccumulatedSinceCompletion: round(accumulated),
  };
  result.tariffEffect = {
    baselineAvgTariff: round(sum(baseline, (b) => b.totalCost) / sum(baseline, (b) => b.kwhConsumed), 3),
    currentTariff,
    changePct: round((currentTariff / (sum(baseline, (b) => b.totalCost) / sum(baseline, (b) => b.kwhConsumed)) - 1) * 100, 1),
    naiveMoneyPerMonth: round((baseCostPerDay - postCostPerDay) * cfg.daysPerMonth),
  };
  return result;
}

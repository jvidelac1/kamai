// Normalización de facturas: todo se compara por día y en kWh, nunca en soles crudos.

const DAY_MS = 86_400_000;

export function toUtcMs(date) {
  if (date instanceof Date) return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return Date.parse(`${String(date).slice(0, 10)}T00:00:00Z`);
}

export function isoDate(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Días del periodo, inclusivo: 2026-02-01 → 2026-02-28 = 28 días. */
export function billDays(bill) {
  return Math.round((toUtcMs(bill.billingEndDate) - toUtcMs(bill.billingStartDate)) / DAY_MS) + 1;
}

export const round = (n, decimals = 0) => {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
};

export function normalizeBill(bill) {
  const days = billDays(bill);
  const totalCost = bill.kwhConsumed * bill.costPerKwh;
  return {
    ...bill,
    days,
    totalCost: round(totalCost, 2),
    kwhPerDay: bill.kwhConsumed / days,
    costPerDay: totalCost / days,
  };
}

export function sortByStart(bills) {
  return [...bills].sort((a, b) => toUtcMs(a.billingStartDate) - toUtcMs(b.billingStartDate));
}

/** Dos periodos se superponen si comparten al menos un día. */
export function overlaps(a, b) {
  return (
    toUtcMs(a.billingStartDate) <= toUtcMs(b.billingEndDate) &&
    toUtcMs(b.billingStartDate) <= toUtcMs(a.billingEndDate)
  );
}

/**
 * Explica por qué la "resta simple" de Kamai engaña.
 * Compara dos facturas consecutivas en soles crudos, por día y por tarifa.
 */
export function compareConsecutive(prevBill, currBill) {
  const prev = normalizeBill(prevBill);
  const curr = normalizeBill(currBill);
  const naiveSaving = prev.totalCost - curr.totalCost; // lo que Kamai muestra hoy
  const kwhPerDayChangePct = (curr.kwhPerDay / prev.kwhPerDay - 1) * 100;
  const costPerDayChangePct = (curr.costPerDay / prev.costPerDay - 1) * 100;
  const tariffChangePct = (curr.costPerKwh / prev.costPerKwh - 1) * 100;

  let verdict;
  if (naiveSaving > 0 && kwhPerDayChangePct >= 0) verdict = 'NAIVE_SAVING_IS_MISLEADING';
  else if (naiveSaving <= 0 && kwhPerDayChangePct < 0) verdict = 'SAVING_HIDDEN_BY_TARIFF_OR_DAYS';
  else verdict = 'CONSISTENT';

  return {
    from: prev.id,
    to: curr.id,
    naiveSaving: round(naiveSaving, 2),
    daysDifference: curr.days - prev.days,
    kwhPerDayChangePct: round(kwhPerDayChangePct, 1),
    costPerDayChangePct: round(costPerDayChangePct, 1),
    tariffChangePct: round(tariffChangePct, 1),
    verdict,
  };
}

/** Huella de una factura: cambia si cambian los datos que afectan la medición. */
export function billFingerprint(b) {
  return [b.kwhConsumed, b.costPerKwh, String(b.billingStartDate).slice(0, 10), String(b.billingEndDate).slice(0, 10)].join('|');
}

// Datos de otros negocios: solo agregados y solo con suficientes casos (k-anonimato).

export const MIN_BUSINESSES_TO_SHOW = 5;

/** Suavizado bayesiano: 1 de 2 no pesa como 7 de 9. Tira hacia la tasa general del programa (3 de 10). */
export function smoothedRate(successes, trials, prior = 0.3, strength = 4) {
  return (successes + prior * strength) / (trials + strength);
}

/** Efecto esperado (% de kWh/día) encogido hacia 0 cuando hay pocas mediciones. */
export function shrunkEffectPct(medianChangePct, n, k = 3) {
  if (!n || medianChangePct === null || medianChangePct === undefined) return 0;
  return (-medianChangePct * n) / (n + k); // -6 % de cambio => efecto positivo
}

/**
 * Versión publicable de una estadística de pares.
 * Debajo del umbral no se muestra ninguna cifra, solo un texto cualitativo.
 */
export function publicPeerStat(stat, min = MIN_BUSINESSES_TO_SHOW) {
  if (!stat) return { shown: false, reason: 'NO_DATA' };
  const out = { shown: true };
  if (stat.chosen >= min) {
    // Redondeado a "x de cada 10" para no revelar conteos exactos de grupos chicos.
    out.completionOutOf10 = Math.round((stat.completed / stat.chosen) * 10);
  } else {
    out.completionOutOf10 = null;
  }
  if (stat.withBills >= min && stat.medianKwhPerDayChangePct !== null) {
    out.medianKwhPerDayChangePct = Math.round(stat.medianKwhPerDayChangePct);
  } else {
    out.medianKwhPerDayChangePct = null;
    out.effectHiddenReason = stat.withBills ? 'FEW_MEASUREMENTS' : 'NO_MEASUREMENTS';
  }
  if (out.completionOutOf10 === null && out.medianKwhPerDayChangePct === null) out.shown = false;
  return out;
}

/**
 * Agregado para aliados: promedio solo si hay >= min negocios medidos.
 * Recibe resultados de medición ya calculados (uno por negocio/plan).
 */
export function aggregateForAllies(measurements, min = MIN_BUSINESSES_TO_SHOW) {
  const byStatus = {};
  for (const m of measurements) byStatus[m.status] = (byStatus[m.status] ?? 0) + 1;
  const measured = measurements.filter((m) => m.status === 'MEASURED');
  const report = {
    businessesTracked: measurements.length,
    byStatus,
    measuredBusinesses: measured.length,
    minBusinessesToPublish: min,
  };
  if (measured.length < min) {
    report.published = false;
    report.reason = `Hay ${measured.length} negocios con ahorro medido; se publica un promedio desde ${min}.`;
    return report;
  }
  const pcts = measured.map((m) => m.savings.pct).sort((a, b) => a - b);
  const mid = Math.floor(pcts.length / 2);
  const median = pcts.length % 2 ? pcts[mid] : (pcts[mid - 1] + pcts[mid]) / 2;
  report.published = true;
  report.medianSavingsPct = Math.round(median * 10) / 10;
  report.totalKwhSavedPerMonth = Math.round(measured.reduce((a, m) => a + m.savings.kwhPerMonth, 0));
  report.method = 'Línea base propia en kWh/día, sin tarifa; solo cuenta ahorro con rango ~95% sobre cero.';
  return report;
}

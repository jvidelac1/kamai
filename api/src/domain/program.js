// Indicadores del programa para aliados e inversores: embudo, meta de 90 días, CO₂ y evidencia.
// Solo agregados; nunca nombres, emails ni dinero individual.
import { toUtcMs } from './bills.js';
import { MIN_BUSINESSES_TO_SHOW } from './peerStats.js';

/** Línea de base del enunciado: "de cada 10 negocios que eligen una ecoinnovación, 3 la completan y 1 deja facturas de antes y después". */
export const PROGRAM_BASELINE_PER_10 = { completed: 3, withBeforeAfter: 1, measured: null };

const per10 = (n, d) => (d ? Math.round((n / d) * 100) / 10 : 0);

/**
 * @param rows [{ plan, business, m }] un elemento por plan elegido (cualquier estado)
 */
export function programIndicators(rows, { now }) {
  const chose = rows.length;
  const completed = rows.filter((r) => r.plan.status === 'completed');
  const withBeforeAfter = completed.filter((r) => r.m.periods.baseline.length >= 3 && r.m.periods.post.length >= 1);
  const measured = completed.filter((r) => r.m.status === 'MEASURED');

  // Meta: ahorro medido dentro de los primeros 90 días en Kamai (fecha = fin de la última factura usada).
  const within90 = measured.filter((r) => {
    if (!r.business.joinedAt) return false;
    const lastPost = Math.max(...r.m.periods.post.map((id) => toUtcMs(r.billsById[id].billingEndDate)));
    return (lastPost - toUtcMs(r.business.joinedAt)) / 86_400_000 <= 90;
  });

  const declared = completed.filter((r) => r.plan.perceivedImpact?.scale);
  const sumKwh = measured.reduce((a, r) => a + r.m.savings.kwhPerMonth, 0);
  const sumCo2 = measured.reduce((a, r) => a + (r.m.co2AvoidedKgPerMonth ?? 0), 0);

  return {
    funnel: {
      chose,
      completed: completed.length,
      withBeforeAfter: withBeforeAfter.length,
      measured: measured.length,
      per10: {
        completed: per10(completed.length, chose),
        withBeforeAfter: per10(withBeforeAfter.length, chose),
        measured: per10(measured.length, chose),
      },
      baselinePer10: PROGRAM_BASELINE_PER_10,
    },
    goal90Days: {
      measuredWithin90: within90.length,
      measured: measured.length,
      note: 'Negocios con ahorro medido cuya factura que lo confirma termina dentro de sus primeros 90 días en Kamai.',
    },
    measuredVsDeclared: {
      declared: declared.length,
      measured: measured.length,
      declaredButNotMeasured: declared.filter((r) => r.m.status !== 'MEASURED').length,
    },
    totals: {
      published: measured.length >= MIN_BUSINESSES_TO_SHOW,
      kwhSavedPerMonth: measured.length >= MIN_BUSINESSES_TO_SHOW ? Math.round(sumKwh) : null,
      co2AvoidedKgPerMonth: measured.length >= MIN_BUSINESSES_TO_SHOW ? Math.round(sumCo2) : null,
    },
    generatedAt: now.toISOString(),
  };
}

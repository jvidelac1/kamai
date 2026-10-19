// Redacción para la dueña: plantillas deterministas (sin LLM), cortas, en lenguaje simple.
import { publicPeerStat } from './peerStats.js';
import { STATUS } from './savings.js';
import { dayMonth, monthName } from '../errors.js';

const LOAD_NAMES = {
  horno: 'tu horno',
  refrigeracion: 'tus refrigeradoras',
  iluminacion: 'la iluminación',
  agua_caliente: 'el agua caliente',
};

const CURRENCY = { PE: 'S/', BO: 'Bs' };
export const currencyFor = (country) => CURRENCY[country] ?? '';

/** Espacio que no se corta: "S/" nunca queda solo al final de una línea. */
export const NBSP = String.fromCharCode(160);
export const formatMoney = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

/** Decimal con coma, como se escribe en Perú y Bolivia. */
export const dec = (n, d = 1) => Number(n).toFixed(d).replace('.', ',');

const joinEs = (xs) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} y ${xs.at(-1)}`);

export function explainRecommendation(rec, { business, peerStats, catalog }) {
  if (!rec.recommended) {
    return { headline: 'Por ahora no encontramos una ecoinnovación que entre en tu presupuesto y tu tiempo.', bullets: [] };
  }
  const money = currencyFor(business.country);
  const bullets = [];
  for (const r of rec.reasons) {
    if (r.code === 'TARGETS_MAIN_LOAD') bullets.push(`Ataca ${joinEs(r.loads.map((l) => LOAD_NAMES[l] ?? l))}, uno de los equipos que más consume en tu negocio.`);
    if (r.code === 'LOW_INVESTMENT') bullets.push('Casi no requiere inversión.');
    if (r.code === 'LOW_COMPLEXITY') bullets.push('Se hace en pocas horas, sin conocimiento técnico.');
    if (r.code === 'FITS_BUDGET_AND_TIME')
      bullets.push(`Entra en tu presupuesto de ${money}${NBSP}${formatMoney(r.budget)} y tus ${r.hoursPerWeek} horas por semana.`);
  }
  const stat = publicPeerStat(peerStats.find((s) => s.ecoId === rec.recommended.ecoId));
  if (stat.completionOutOf10 !== null) bullets.push(`${stat.completionOutOf10} de cada 10 panaderías que la eligieron la terminaron.`);
  if (stat.medianKwhPerDayChangePct !== null) bullets.push(`En negocios parecidos el consumo bajó alrededor de ${Math.abs(stat.medianKwhPerDayChangePct)}%.`);
  else bullets.push('Todavía hay pocas mediciones en negocios parecidos para darte una cifra de ahorro: lo vamos a medir con tus facturas.');

  const out = {
    headline: `Tu primer paso: ${rec.recommended.title}`,
    bullets,
  };
  for (const s of rec.stalledPlans) {
    out.stalledNote = `"${s.title}" lleva ${s.weeksWithoutProgress} semanas sin avanzar. Te sugerimos pausarla y retomarla cuando tengas tu primer ahorro.`;
  }
  if (rec.measurement.needsBaseline) {
    out.beforeYouStart = `Antes de empezar, sube ${rec.measurement.billsNeeded} factura(s) de luz anteriores: así podremos mostrarte cuánto ahorraste de verdad.`;
  }
  if (rec.nextAfterThis) {
    const next = catalog.find((e) => e.id === rec.nextAfterThis);
    if (next) out.next = `Cuando la termines y midamos el ahorro, seguimos con: ${next.title}.`;
  }
  return out;
}

export function explainSavings(m, { country }) {
  const money = currencyFor(country);
  switch (m.status) {
    case STATUS.INSUFFICIENT_BASELINE:
      return {
        headline: 'Todavía no podemos medir tu ahorro',
        detail: `Sube ${m.need.baselineBills} factura(s) más de antes de empezar para conocer tu consumo normal.`,
      };
    case STATUS.WAITING_POST_DATA:
      return {
        headline: 'Todavía no podemos saberlo',
        detail: m.need.firstUsefulPeriodStartsOnOrAfter
          ? 'Cuando subas tu primera factura completa después de terminar, te mostramos el resultado.'
          : 'Cuando completes la ecoinnovación y subas tu siguiente factura, te mostramos el resultado.',
        baseline: `Tu consumo normal: ${dec(m.baseline.kwhPerDay)} kWh por día.`,
      };
    case STATUS.INCONCLUSIVE:
      return {
        headline: 'Todavía no podemos saberlo',
        detail: `Tu consumo ${m.savings.pct >= 0 ? 'bajó' : 'subió'} ${dec(Math.abs(m.savings.pct))}%, pero tu consumo normal varía cerca de ${dec(m.baseline.naturalVariationPct)}% de un mes a otro. Con una factura más lo sabremos con más seguridad.`,
      };
    case STATUS.INCREASED:
      return {
        headline: 'Tu consumo subió',
        detail: `Gastas ${dec(Math.abs(m.savings.kwhPerDay))} kWh por día más que antes. Revisemos qué cambió en tu negocio.`,
      };
    case STATUS.MEASURED: {
      const s = m.savings;
      const lines = {
        headline: `Ahorras cerca de ${money} ${s.moneyPerMonthAtCurrentTariff} al mes`,
        detail: `Tu consumo bajó ${dec(s.pct)}% (${dec(s.kwhPerDay)} kWh por día menos que antes). Con lo que sabemos, el ahorro real está entre ${money} ${s.moneyPerMonthRange[0]} y ${money} ${s.moneyPerMonthRange[1]} al mes.`,
        howWeMeasured: 'Comparamos tu consumo por día antes y después, así no importa si el mes tuvo más o menos días.',
      };
      if (m.tariffEffect.changePct > 1)
        lines.tariffNote = `La tarifa subió ${dec(m.tariffEffect.changePct)}%: por eso tu factura no baja tanto como tu consumo. Esa subida no es culpa tuya.`;
      return lines;
    }
    default:
      return { headline: '', detail: '' };
  }
}

/**
 * Un cambio de factura en palabras, con fecha: "El 20 de octubre corregiste tu factura de septiembre: de 1.665 a 1.750 kWh."
 * (`e` viene del registro de cambios: kind, before, after, at)
 */
export function describeChange(e) {
  const ref = e.before ?? e.after;
  const when = `El ${dayMonth(e.at)}`;
  const month = monthName(ref.billingStartDate);
  if (e.kind === 'deleted') return `${when} borraste tu factura de ${month}.`;
  if (e.kind === 'created') return `${when} subiste tu factura de ${month}.`;
  const { before: b, after: a } = e;
  let what = '';
  if (b.kwhConsumed !== a.kwhConsumed) what = `: de ${formatMoney(b.kwhConsumed)} a ${formatMoney(a.kwhConsumed)} kWh`;
  else if (b.costPerKwh !== a.costPerKwh) what = `: el precio por kWh pasó de ${dec(b.costPerKwh, 2)} a ${dec(a.costPerKwh, 2)}`;
  else if (b.billingStartDate !== a.billingStartDate || b.billingEndDate !== a.billingEndDate) what = ': cambiaste las fechas';
  return `${when} corregiste tu factura de ${month}${what}.`;
}

/** Aviso al volver a ver el ahorro después de editar o borrar: qué cambió, cuándo, y qué pasó con la cifra que ya había visto. */
export function explainCorrection(events, { shown, m, country }) {
  const money = currencyFor(country);
  const amount = (n) => `${money}${NBSP}${formatMoney(n)}`;
  const more = events.length - 1;
  const what = !events.length
    ? 'Editaste o borraste una factura.'
    : more > 0
      ? `${describeChange(events.at(-1)).slice(0, -1)} (y ${more} cambio${more > 1 ? 's' : ''} más).`
      : describeChange(events.at(-1));
  let consequence = 'Por eso recalculamos tu resultado.';
  if (shown?.status === 'MEASURED' && m.status !== 'MEASURED')
    consequence = shown.moneyPerMonth != null
      ? `Por eso recalculamos tu resultado: antes te mostrábamos ${amount(shown.moneyPerMonth)} al mes y esa cifra ya no vale.`
      : 'Por eso recalculamos tu resultado: la cifra anterior ya no vale.';
  else if (shown?.status === 'MEASURED' && m.status === 'MEASURED' && shown.moneyPerMonth !== m.savings.moneyPerMonthAtCurrentTariff)
    consequence = `Por eso recalculamos: antes eran ${amount(shown.moneyPerMonth)} al mes, ahora ${amount(m.savings.moneyPerMonthAtCurrentTariff)}.`;
  return `${what} ${consequence}`;
}

/** Vista para aliados: sin nombre, sin dinero individual, con método y estado (medido vs declarado). */
export function allyView(m, { businessRef, ecoId, perceivedImpact }) {
  return {
    businessRef,
    ecoId,
    status: m.status,
    measured: m.status === 'MEASURED',
    declaredImpact: perceivedImpact ?? null,
    savingsPct: m.savings?.pct ?? null,
    savingsPctRange: m.savings?.pctRange ?? null,
    kwhPerMonth: m.savings?.kwhPerMonth ?? null,
    methodVersion: m.methodVersion,
    limitations: m.limitations.map((l) => l.code),
  };
}

// Motor único de recomendación del primer paso. Reglas + puntaje transparente.
// Determinista: mismo negocio + mismo catálogo + mismos datos de pares => misma recomendación,
// sin importar desde qué lugar de Kamai se pida (inicio, catálogo, diagnóstico, correo).
import { createHash } from 'node:crypto';
import { smoothedRate, shrunkEffectPct } from './peerStats.js';
import { toUtcMs } from './bills.js';

export const RULES_VERSION = 'rec-v1';

export const REC_CONFIG = {
  // SUPUESTO a validar con el equipo: el catálogo no tiene montos; bandas orientativas por nivel.
  investmentMinMoney: { BAJA: 0, MEDIA: 300, ALTA: 1500 },
  // SUPUESTO: horas semanales que suele pedir cada nivel de complejidad.
  hoursPerWeekNeeded: { BAJA: 1, MEDIA: 3, ALTA: 6 },
  levelEase: { BAJA: 1, MEDIA: 0.6, ALTA: 0.2 },
  weights: { loadMatch: 0.3, feasibility: 0.25, completion: 0.25, effect: 0.2 },
  effectCapPct: 20,
  stalledPlanDays: 42, // 6 semanas sin cambios => plan trabado
  minBaselineBills: 3,
};

const r3 = (n) => Math.round(n * 1000) / 1000;

function appliesToSector(eco, ciiu) {
  return !eco.ciiuCodes?.length || (ciiu && eco.ciiuCodes.includes(ciiu));
}

export function scoreEco(eco, business, peerStat, cfg = REC_CONFIG) {
  const loads = business.mainLoads ?? [];
  const targets = eco.targetLoads ?? [];
  const loadMatch = loads.length === 0 ? 0.5 : targets.some((t) => loads.includes(t)) ? 1 : 0.3;
  const feasibility = (cfg.levelEase[eco.investment] + cfg.levelEase[eco.complexity]) / 2;
  const completion = smoothedRate(peerStat?.completed ?? 0, peerStat?.chosen ?? 0);
  const effectPct = shrunkEffectPct(peerStat?.medianKwhPerDayChangePct ?? null, peerStat?.withBills ?? 0);
  const effect = Math.min(Math.max(effectPct, 0), cfg.effectCapPct) / cfg.effectCapPct;
  const w = cfg.weights;
  const total = w.loadMatch * loadMatch + w.feasibility * feasibility + w.completion * completion + w.effect * effect;
  return {
    total: r3(total),
    components: { loadMatch: r3(loadMatch), feasibility: r3(feasibility), completion: r3(completion), effect: r3(effect) },
    expectedEffectPct: Math.round(effectPct * 10) / 10,
  };
}

function exclusionReason(eco, business, plans, cfg) {
  if (eco.category !== (business.diagnosis?.topic ?? eco.category)) return 'OTHER_CATEGORY';
  if (!appliesToSector(eco, business.ciiu)) return 'NOT_FOR_SECTOR';
  const plan = plans.find((p) => p.ecoCardOrigin === eco.id);
  if (plan?.status === 'completed') return 'ALREADY_COMPLETED';
  if (plan && plan.status !== 'completed') return 'ALREADY_IN_PLAN';
  if (business.quarterBudget !== undefined && cfg.investmentMinMoney[eco.investment] > business.quarterBudget)
    return 'OVER_BUDGET';
  if (business.hoursPerWeek !== undefined && cfg.hoursPerWeekNeeded[eco.complexity] > business.hoursPerWeek)
    return 'OVER_TIME';
  return null;
}

function stalledPlans(plans, catalog, asOf, cfg) {
  const asOfMs = toUtcMs(asOf);
  return plans
    .filter((p) => ['in_progress', 'delayed', 'to_define', 'not_started'].includes(p.status))
    .map((p) => ({ plan: p, days: Math.floor((asOfMs - toUtcMs(p.statusUpdatedAt)) / 86_400_000) }))
    .filter(({ days }) => days >= cfg.stalledPlanDays)
    .map(({ plan, days }) => {
      const eco = catalog.find((e) => e.id === plan.ecoCardOrigin);
      return {
        planId: plan.id,
        ecoId: plan.ecoCardOrigin,
        title: plan.title,
        weeksWithoutProgress: Math.floor(days / 7),
        suggestion: 'PAUSE_AND_START_SMALLER',
        complexity: eco?.complexity,
        investment: eco?.investment,
      };
    });
}

/**
 * @returns recomendación con razones como códigos (la redacción vive en explanations.js)
 */
export function recommendFirstStep({ business, catalog, peerStats, plans = [], bills = [], asOf }, cfg = REC_CONFIG) {
  const statsById = Object.fromEntries(peerStats.map((s) => [s.ecoId, s]));
  const candidates = [];
  const excluded = [];
  for (const eco of catalog) {
    const reason = exclusionReason(eco, business, plans, cfg);
    if (reason) excluded.push({ ecoId: eco.id, title: eco.title, reason });
    else candidates.push({ eco, score: scoreEco(eco, business, statsById[eco.id], cfg) });
  }
  // Desempate estable: puntaje, luego menor inversión, luego id.
  candidates.sort(
    (a, b) =>
      b.score.total - a.score.total ||
      cfg.investmentMinMoney[a.eco.investment] - cfg.investmentMinMoney[b.eco.investment] ||
      a.eco.id.localeCompare(b.eco.id),
  );

  const top = candidates[0];
  const reasons = [];
  if (top) {
    const c = top.score.components;
    if (c.loadMatch === 1) reasons.push({ code: 'TARGETS_MAIN_LOAD', loads: top.eco.targetLoads.filter((t) => business.mainLoads.includes(t)) });
    if (top.eco.investment === 'BAJA') reasons.push({ code: 'LOW_INVESTMENT' });
    if (top.eco.complexity === 'BAJA') reasons.push({ code: 'LOW_COMPLEXITY' });
    reasons.push({ code: 'FITS_BUDGET_AND_TIME', budget: business.quarterBudget, hoursPerWeek: business.hoursPerWeek });
    if (c.completion >= 0.5) reasons.push({ code: 'PEERS_USUALLY_COMPLETE' });
  }

  const needsBaseline = bills.length < cfg.minBaselineBills;
  const result = {
    rulesVersion: RULES_VERSION,
    recommended: top
      ? { ecoId: top.eco.id, title: top.eco.title, investment: top.eco.investment, complexity: top.eco.complexity, score: top.score }
      : null,
    reasons,
    alternatives: candidates.slice(1, 3).map((c) => ({ ecoId: c.eco.id, title: c.eco.title, score: c.score })),
    excluded,
    stalledPlans: stalledPlans(plans, catalog, asOf, cfg),
    measurement: {
      needsBaseline,
      billsAvailable: bills.length,
      billsNeeded: Math.max(0, cfg.minBaselineBills - bills.length),
    },
    nextAfterThis: candidates.slice(1).find((c) => c.score.components.loadMatch === 1)?.eco.id ?? null,
  };
  result.inputsHash = createHash('sha256')
    .update(JSON.stringify({ v: RULES_VERSION, b: business, c: catalog.map((e) => e.id), s: peerStats, p: plans.map((p) => [p.id, p.status]), n: bills.length }))
    .digest('hex')
    .slice(0, 16);
  return result;
}

import { describe, it, expect } from 'vitest';
import { recommendFirstStep, scoreEco } from '../src/domain/recommendation.js';
import { explainRecommendation, NBSP } from '../src/domain/explanations.js';
import { smoothedRate, publicPeerStat, aggregateForAllies } from '../src/domain/peerStats.js';
import { INES, CATALOG, PEER_STATS, INES_BILLS, INES_PLANS } from '../src/seed/data.js';

const ctx = { business: INES, catalog: CATALOG, peerStats: PEER_STATS, plans: INES_PLANS, bills: INES_BILLS, asOf: '2026-07-01' };

describe('recomendación para Inés', () => {
  const rec = recommendFirstStep(ctx);

  it('recomienda burletes y descongelamiento de refrigeradoras (eco_118)', () => {
    expect(rec.recommended.ecoId).toBe('eco_118');
  });

  it('deja "hornear por tandas" como alternativa y como siguiente paso (ataca el horno)', () => {
    expect(rec.alternatives[0].ecoId).toBe('eco_204');
    expect(rec.nextAfterThis).toBe('eco_204');
  });

  it('excluye lo que no entra en S/ 1.200 o en 4 h/semana, y el aislamiento que ya está en plan', () => {
    const byId = Object.fromEntries(rec.excluded.map((e) => [e.ecoId, e.reason]));
    expect(byId.eco_071).toBe('ALREADY_IN_PLAN');
    expect(byId.eco_150).toBe('OVER_BUDGET');
  });

  it('detecta que el aislamiento lleva 7 semanas trabado y sugiere pausarlo', () => {
    expect(rec.stalledPlans).toHaveLength(1);
    expect(rec.stalledPlans[0]).toMatchObject({ ecoId: 'eco_071', weeksWithoutProgress: 7, suggestion: 'PAUSE_AND_START_SMALLER' });
  });

  it('tiene línea base suficiente (6 facturas): no pide más', () => {
    expect(rec.measurement.needsBaseline).toBe(false);
  });

  it('las razones son códigos trazables con versión de reglas', () => {
    expect(rec.rulesVersion).toBe('rec-v1');
    expect(rec.reasons.map((r) => r.code)).toEqual(
      expect.arrayContaining(['TARGETS_MAIN_LOAD', 'LOW_INVESTMENT', 'LOW_COMPLEXITY', 'FITS_BUDGET_AND_TIME', 'PEERS_USUALLY_COMPLETE']),
    );
  });

  it('es determinista: mismo input => misma recomendación y mismo hash', () => {
    expect(recommendFirstStep(ctx)).toEqual(rec);
  });
});

describe('explicación para Inés (sin LLM, con privacidad)', () => {
  const rec = recommendFirstStep(ctx);
  const ex = explainRecommendation(rec, { business: INES, peerStats: PEER_STATS, catalog: CATALOG });

  it('explica en lenguaje simple por qué', () => {
    expect(ex.headline).toContain('burletes');
    expect(ex.bullets.join(' ')).toContain('tus refrigeradoras');
    expect(ex.bullets.join(' ')).toContain(`S/${NBSP}1.200`); // espacio que no se corta
  });

  it('muestra la tasa de completitud (9 negocios >= 5) pero NO el % de ahorro (solo 4 midieron)', () => {
    expect(ex.bullets.join(' ')).toContain('8 de cada 10');
    expect(ex.bullets.join(' ')).not.toMatch(/6\s?%/);
    expect(ex.bullets.join(' ')).toContain('pocas mediciones');
  });

  it('incluye la nota de plan trabado y el siguiente paso', () => {
    expect(ex.stalledNote).toContain('7 semanas');
    expect(ex.next).toContain('Hornear por tandas');
  });
});

describe('casos borde de la recomendación', () => {
  it('negocio nuevo sin facturas: recomienda igual, pero pide 3 facturas antes de empezar', () => {
    const rec = recommendFirstStep({ ...ctx, plans: [], bills: [] });
    expect(rec.recommended).not.toBeNull();
    expect(rec.measurement).toEqual({ needsBaseline: true, billsAvailable: 0, billsNeeded: 3 });
    const ex = explainRecommendation(rec, { business: INES, peerStats: PEER_STATS, catalog: CATALOG });
    expect(ex.beforeYouStart).toContain('3 factura');
  });

  it('sin equipos declarados no inventa: la coincidencia de carga es neutra (0,5)', () => {
    const s = scoreEco(CATALOG[0], { ...INES, mainLoads: [] }, PEER_STATS[0]);
    expect(s.components.loadMatch).toBe(0.5);
  });

  it('un negocio que no es panadería no recibe ecoinnovaciones exclusivas de panadería', () => {
    const rec = recommendFirstStep({ ...ctx, business: { ...INES, ciiu: '5610' }, plans: [] });
    expect(rec.excluded.find((e) => e.ecoId === 'eco_204').reason).toBe('NOT_FOR_SECTOR');
  });

  it('con más presupuesto y tiempo, el aislamiento deja de excluirse por presupuesto', () => {
    const rec = recommendFirstStep({ ...ctx, business: { ...INES, quarterBudget: 5000, hoursPerWeek: 10 }, plans: [] });
    expect(rec.excluded.find((e) => e.ecoId === 'eco_071')).toBeUndefined();
  });
});

describe('pocos casos: suavizado y k-anonimato', () => {
  it('1 de 2 no pesa como 7 de 9', () => {
    expect(smoothedRate(1, 2)).toBeLessThan(smoothedRate(7, 9));
    expect(smoothedRate(1, 2)).toBeCloseTo(0.367, 3);
  });

  it('el -18 % del aislamiento (1 caso) no se publica', () => {
    const s = publicPeerStat(PEER_STATS.find((p) => p.ecoId === 'eco_071'));
    expect(s.shown).toBe(false);
    expect(s.medianKwhPerDayChangePct).toBeNull();
  });

  it('el -4 % de LED (5 casos con facturas) sí se publica', () => {
    expect(publicPeerStat(PEER_STATS.find((p) => p.ecoId === 'eco_090')).medianKwhPerDayChangePct).toBe(-4);
  });

  it('el reporte a aliados no publica promedios con menos de 5 negocios medidos', () => {
    const fake = (pct) => ({ status: 'MEASURED', savings: { pct, kwhPerMonth: 100 } });
    expect(aggregateForAllies([fake(5), fake(6), fake(7), fake(8)]).published).toBe(false);
    const r = aggregateForAllies([fake(5), fake(6), fake(7), fake(8), fake(9), { status: 'INCONCLUSIVE' }]);
    expect(r).toMatchObject({ published: true, medianSavingsPct: 7, measuredBusinesses: 5, businessesTracked: 6 });
  });
});

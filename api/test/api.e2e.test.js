// E2E de la API: mismo recorrido contra repo en memoria y contra MongoDB real (mongodb-memory-server).
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { createMemoryRepo } from '../src/repo/memoryRepo.js';
import { createMongoRepo } from '../src/repo/mongoRepo.js';
import { seed } from '../src/seed/seed.js';
import { createFakeAiClient } from '../src/integrations/ai.js';
import { createFakeMessagingClient } from '../src/integrations/messaging.js';
import { INES_SIMULATED_POST_BILLS } from '../src/seed/data.js';
import { NBSP } from '../src/domain/explanations.js';

const [JUL, AUG, SEP] = INES_SIMULATED_POST_BILLS.map(({ id, businessId, type, ...b }) => b);

async function memoryBackend() {
  return { repo: createMemoryRepo(), stop: async () => {} };
}
async function mongoBackend() {
  const { MongoMemoryServer } = await import('mongodb-memory-server');
  const mongod = await MongoMemoryServer.create();
  const repo = await createMongoRepo(mongod.getUri(), 'kamai_test');
  return { repo, stop: async () => { await repo.close(); await mongod.stop(); } };
}

const backends = [['memoria', memoryBackend]];
if (!process.env.SKIP_MONGO) backends.push(['MongoDB', mongoBackend]);

describe.each(backends)('API e2e — repo %s', (_name, makeBackend) => {
  let backend, app, ai, messaging;
  let now = new Date('2026-07-01T12:00:00Z');

  beforeAll(async () => {
    backend = await makeBackend();
    await seed(backend.repo);
    ai = createFakeAiClient();
    messaging = createFakeMessagingClient({ failTimes: 1 }); // el primer envío falla
    app = createApp({ repo: backend.repo, ai, messaging, clock: () => now });
  }, 120_000);
  afterAll(async () => backend?.stop());

  const api = () => request(app);
  let planId;
  /** Inés abre "Mi ahorro": consulta y, al mostrarlo, lo marca como visto. */
  const see = async () => {
    const r = await api().get(`/plans/${planId}/savings`).expect(200);
    await api().post(`/plans/${planId}/savings/seen`).send({ inputsHash: r.body.measurement.inputsHash }).expect(200);
    return r;
  };
  let recommendationId;

  it('GET /health', async () => {
    const r = await api().get('/health').expect(200);
    expect(r.body.ok).toBe(true);
  });

  it('los 4 lugares de Kamai reciben LA MISMA recomendación', async () => {
    const results = [];
    for (const surface of ['home', 'catalog', 'diagnosis', 'email']) {
      const r = await api().get('/businesses/biz_ines/recommendations/first-step').query({ surface }).expect(200);
      results.push(r.body);
    }
    expect(new Set(results.map((r) => r.recommendation.recommended.ecoId))).toEqual(new Set(['eco_118']));
    expect(new Set(results.map((r) => r.recommendationId)).size).toBe(1); // guardada una vez, con su porqué
    expect(results[0].explanation.stalledNote).toContain('7 semanas');
    recommendationId = results[0].recommendationId;
    const stored = await backend.repo.listRecommendations('biz_ines');
    expect(stored).toHaveLength(1);
    expect(stored[0].reasons.length).toBeGreaterThan(0);
  });

  it('surface inválido => 400', async () => {
    await api().get('/businesses/biz_ines/recommendations/first-step?surface=foo').expect(400);
  });

  it('el listado de facturas desarma el "ahorraste S/ 117" de febrero', async () => {
    const r = await api().get('/businesses/biz_ines/bills').expect(200);
    const feb = r.body.comparisons.find((c) => c.to === 'bill_2026_02');
    expect(feb.naiveSaving).toBeCloseTo(117, 0);
    expect(feb.verdict).toBe('NAIVE_SAVING_IS_MISLEADING');
  });

  it('Inés acepta el primer paso: se crea el plan con startedAt y el id de la recomendación', async () => {
    const r = await api().post('/businesses/biz_ines/plans').send({ ecoId: 'eco_118', startedAt: '2026-07-01', recommendationId }).expect(201);
    planId = r.body.id;
    expect(r.body).toMatchObject({ status: 'in_progress', startedAt: '2026-07-01', recommendationId });
    expect(r.body.steps.map((s) => s.title)).toEqual(['Revisar burletes', 'Programar descongelamiento', 'Registrar consumo']);
  });

  it('una vez aceptado, "su primer paso" es el plan en curso y lo recomendado pasa a ser el siguiente', async () => {
    const r = await api().get('/businesses/biz_ines/recommendations/first-step?surface=home&asOf=2026-07-01').expect(200);
    expect(r.body.firstStepPlan).toMatchObject({ id: planId, ecoId: 'eco_118', status: 'in_progress' });
    expect(r.body.recommendation.recommended.ecoId).toBe('eco_204');
  });

  it('perfil público del negocio (sin email) y tachar pasos del plan', async () => {
    const b = await api().get('/businesses/biz_ines').expect(200);
    expect(b.body).toMatchObject({ name: 'Panadería Santa Inés', ownerName: 'Inés Huamán', currency: 'S/' });
    expect(b.body.email).toBeUndefined();
    const p = await api().patch(`/plans/${planId}/steps/0`).send({ status: 'completed' }).expect(200);
    expect(p.body.steps.map((s) => s.status)).toEqual(['completed', 'not_started', 'not_started']);
    await api().patch(`/plans/${planId}/steps/9`).send({ status: 'completed' }).expect(400);
  });

  it('si la IA no responde, ve los pasos de la guía (200, no error)', async () => {
    ai.mode = 'timeout';
    const r = await api().post(`/plans/${planId}/sub-tasks`).send({ stepsId: ['step_1', 'step_2'] }).expect(200);
    expect(r.body).toMatchObject({ source: 'static', reason: 'AI_UNAVAILABLE', retryable: true });
    expect(r.body.steps[0].title).toBe('Revisar burletes');
    ai.mode = 'quota';
    const q = await api().post(`/plans/${planId}/sub-tasks`).send({ stepsId: ['step_1'] }).expect(200);
    expect(q.body).toMatchObject({ source: 'static', reason: 'NO_QUOTA', retryable: false });
    ai.mode = 'ok';
    const ok = await api().post(`/plans/${planId}/sub-tasks`).send({ stepsId: ['step_1'] }).expect(200);
    expect(ok.body.source).toBe('ai');
  });

  it('fecha de término antes de empezar: explica con fechas y marca el campo', async () => {
    now = new Date('2026-07-10T18:00:00Z'); // en la historia, Inés lo marca el mismo día que lo termina
    const r = await api().post(`/plans/${planId}/complete`).send({ completedAt: '2026-06-05' }).expect(400);
    expect(r.body).toMatchObject({
      error: 'COMPLETED_BEFORE_START',
      field: 'completedAt',
      minDate: '2026-07-01',
      message: 'Pusiste el 5 de junio, pero empezaste este paso el 1 de julio.',
      hint: 'Elige un día desde el 1 de julio en adelante.',
    });
  });

  it('fecha de término en el futuro: lo dice y sugiere qué hacer', async () => {
    const r = await api().post(`/plans/${planId}/complete`).send({ completedAt: '2026-07-20' }).expect(400);
    expect(r.body).toMatchObject({ error: 'COMPLETED_IN_FUTURE', field: 'completedAt', maxDate: '2026-07-10', message: 'El 20 de julio todavía no llegó.' });
    expect(r.body.hint).toContain('Elige hoy o un día anterior');
  });

  it('fecha vacía o mal escrita: mensaje del campo, no jerga técnica', async () => {
    const r = await api().post(`/plans/${planId}/complete`).send({ completedAt: '10/07/2026' }).expect(400);
    expect(r.body).toMatchObject({ error: 'VALIDATION', field: 'completedAt', message: 'Elige en el calendario el día en que lo terminaste.' });
  });

  it('completa el 10/7: todavía no podemos saberlo (falta factura posterior)', async () => {
    const r = await api().post(`/plans/${planId}/complete`).send({ completedAt: '2026-07-10', perceivedImpact: { scale: 4 } }).expect(200);
    expect(r.body.savings.measurement.status).toBe('WAITING_POST_DATA');
    expect(r.body.savings.explanation.headline).toBe('Todavía no podemos saberlo');
  });

  it('tocar dos veces "Listo" con la misma fecha no es un error; con otra fecha, se explica', async () => {
    await api().post(`/plans/${planId}/complete`).send({ completedAt: '2026-07-10' }).expect(200);
    const r = await api().post(`/plans/${planId}/complete`).send({ completedAt: '2026-07-08' }).expect(409);
    expect(r.body).toMatchObject({ error: 'PLAN_ALREADY_COMPLETED', message: 'Ya marcaste este paso como terminado el 10 de julio.' });
  });

  it('factura superpuesta => 409 que nombra la factura con la que choca', async () => {
    const r = await api().post('/businesses/biz_ines/bills').send({ ...JUL, billingStartDate: '2026-06-15' }).expect(409);
    expect(r.body).toMatchObject({
      error: 'OVERLAPPING_PERIOD',
      field: 'billingStartDate',
      conflictsWith: 'bill_2026_06',
      conflictStart: '2026-06-01',
      conflictEnd: '2026-06-30',
      message: 'Estas fechas se cruzan con tu factura de junio (del 1 de junio al 30 de junio).',
    });
    expect(r.body.hint).toContain('Cada día va en una sola factura');
  });

  it('factura sin foto se acepta con evidence "none" (cuenta igual para la dueña)', async () => {
    const r = await api().post('/businesses/biz_ines/bills').send({ kwhConsumed: 1000, costPerKwh: 0.8, billingStartDate: '2025-11-01', billingEndDate: '2025-11-30' }).expect(201);
    expect(r.body.evidence).toBe('none');
    await api().delete(`/bills/${r.body.id}`).expect(204);
  });

  it('factura inválida => 400 con un mensaje simple por cada campo', async () => {
    const r = await api().post('/businesses/biz_ines/bills').send({ kwhConsumed: -5, costPerKwh: 84, billingStartDate: '2026-07-01', billingEndDate: '2026-06-01' }).expect(400);
    expect(r.body.error).toBe('VALIDATION');
    expect(r.body.fields).toEqual({
      kwhConsumed: 'Los kWh tienen que ser más que cero.',
      costPerKwh: 'Ese precio por kWh es muy alto. ¿Quisiste poner 0,84 en vez de 84?',
      billingEndDate: 'La fecha “hasta” tiene que ser después de la fecha “desde”.',
    });
    expect(r.body.hint).toContain('más de un dato');
    const long = await api().post('/businesses/biz_ines/bills').send({ kwhConsumed: 900, costPerKwh: 0.8, billingStartDate: '2025-01-01', billingEndDate: '2025-04-30' }).expect(400);
    expect(long.body.message).toBe('El periodo dura 120 días. Una factura de luz suele cubrir un mes: revisa las fechas.');
  });

  let augId, sepId;
  it('julio (mixto) + agosto: INCONCLUSIVE, con explicación honesta', async () => {
    await api().post('/businesses/biz_ines/bills').send(JUL).expect(201);
    augId = (await api().post('/businesses/biz_ines/bills').send(AUG).expect(201)).body.id;
    const r = await see();
    expect(r.body.measurement.status).toBe('INCONCLUSIVE');
    expect(r.body.measurement.periods.excludedTransition).toHaveLength(1);
    expect(r.body.explanation.detail).toContain('varía cerca de');
  });

  it('septiembre: MEASURED (~S/ 88/mes) y se encola UN correo', async () => {
    const bill = (await api().post('/businesses/biz_ines/bills').send(SEP).expect(201)).body;
    sepId = bill.id;
    expect(bill.currency).toBe('S/');
    const r = await see();
    expect(r.body.measurement.status).toBe('MEASURED');
    expect(r.body.measurement.savings.moneyPerMonthAtCurrentTariff).toBe(88);
    expect(r.body.explanation.headline).toBe('Ahorras cerca de S/ 88 al mes');
    expect(r.body.explanation.tariffNote).toContain('no es culpa tuya');
    // Subir una factura nueva es avance, no corrección: nunca se le dice "editaste o borraste".
    expect(r.body.previous.changeKind).toBe('NEW_BILLS');
    expect(r.body.explanation.updateNote ?? '').not.toContain('editaste');
    const outbox = await backend.repo.listOutbox({ template: 'savings-measured' });
    expect(outbox).toHaveLength(1);
  });

  it('recalcular varias veces no duplica snapshots ni correos', async () => {
    const before = (await backend.repo.listSnapshots(planId)).length;
    for (let i = 0; i < 3; i++) await api().get(`/plans/${planId}/savings`).expect(200);
    const snaps = await backend.repo.listSnapshots(planId);
    expect(snaps).toHaveLength(before); // consultar no crea snapshots
    // Nunca dos snapshots seguidos con el mismo hash (volver a un estado anterior sí es válido: A → B → A).
    expect(snaps.every((s, i) => i === 0 || s.inputsHash !== snaps[i - 1].inputsHash)).toBe(true);
    expect(await backend.repo.listOutbox({ template: 'savings-measured' })).toHaveLength(1);
  });

  it('el correo falla una vez, se reintenta con backoff y sale una sola vez', async () => {
    const first = await api().post('/internal/outbox/deliver').expect(200);
    expect(first.body.results.find((x) => x.key.includes(planId)).status).toBe('retry');
    now = new Date(now.getTime() + 2 * 60_000); // pasan 2 minutos
    const second = await api().post('/internal/outbox/deliver').expect(200);
    expect(second.body.results.find((x) => x.key.includes(planId)).status).toBe('sent');
    expect(messaging.sent.filter((m) => m.email === 'ines@ejemplo.test')).toHaveLength(1);
    const third = await api().post('/internal/outbox/deliver').expect(200);
    expect(third.body.results).toHaveLength(0);
  });

  it('si edita septiembre, se recalcula desde cero y se le avisa del cambio (sin cifras contradictorias)', async () => {
    await api().put(`/bills/${sepId}`).send({ kwhConsumed: 1750 }).expect(200);
    // Consultar (por ejemplo, desde Facturas para el gráfico) NO cuenta como visto: el aviso la espera.
    const peek = await api().get(`/plans/${planId}/savings`).expect(200);
    expect(peek.body.previous.changeKind).toBe('EDITED_OR_DELETED');
    const r = await see();
    expect(r.body.measurement.status).toBe('INCONCLUSIVE');
    expect(r.body.previous.status).toBe('MEASURED');
    expect(r.body.previous.changeKind).toBe('EDITED_OR_DELETED');
    // Dice cuándo, qué factura, de cuánto a cuánto, y qué pasa con la cifra que ya había visto.
    expect(r.body.explanation.updateNote).toBe(
      `El 10 de julio corregiste tu factura de septiembre: de 1.665 a 1.750 kWh. Por eso recalculamos tu resultado: antes te mostrábamos S/${NBSP}88 al mes y esa cifra ya no vale.`,
    );
    // La segunda vez que entra ya no se repite el aviso grande, pero la última corrección queda a la vista.
    const again = await see();
    expect(again.body.previous).toBeNull();
    expect(again.body.explanation.updateNote).toBeUndefined();
    expect(again.body.lastCorrection).toMatchObject({ kind: 'edited', text: 'El 10 de julio corregiste tu factura de septiembre: de 1.665 a 1.750 kWh.' });
    // Y en Facturas aparece el historial de correcciones.
    const bills = await api().get('/businesses/biz_ines/bills').expect(200);
    expect(bills.body.corrections[0].text).toContain('corregiste tu factura de septiembre');
  });

  it('cada factura trae su CO₂ equivalente (contrato del anexo) y el ahorro, el CO₂ evitado', async () => {
    const r = await api().get('/businesses/biz_ines/bills').expect(200);
    const feb = r.body.bills.find((b) => b.id === 'bill_2026_02');
    expect(feb.co2Equivalent).toBeCloseTo(1690 * 0.21, 1);
  });

  it('foto ilegible: la factura cuenta igual, se marca y al cambiar la foto se vuelve a revisar', async () => {
    const r = await api()
      .post('/businesses/biz_ines/bills')
      .send({ kwhConsumed: 900, costPerKwh: 0.8, billingStartDate: '2025-12-01', billingEndDate: '2025-12-31', uploadedFiles: ['factura-borrosa.jpg'] })
      .expect(201);
    expect(r.body.photoStatus).toBe('unreadable');
    const fixed = await api().put(`/bills/${r.body.id}`).send({ uploadedFiles: ['factura-nueva.jpg'] }).expect(200);
    expect(fixed.body.photoStatus).toBe('readable');
    await api().delete(`/bills/${r.body.id}`).expect(204);
  });

  it('si borra agosto y septiembre, vuelve a "todavía no podemos saberlo"', async () => {
    await api().delete(`/bills/${sepId}`).expect(204);
    await api().delete(`/bills/${augId}`).expect(204);
    const r = await api().get(`/plans/${planId}/savings`).expect(200);
    expect(r.body.measurement.status).toBe('WAITING_POST_DATA');
  });

  it('reporte a aliados: agregado con k>=5, sin nombres ni emails', async () => {
    const r = await api().get('/allies/report').expect(200);
    expect(r.body.summary.published).toBe(true);
    expect(r.body.summary.measuredBusinesses).toBeGreaterThanOrEqual(5);
    const raw = JSON.stringify(r.body);
    expect(raw).not.toContain('Inés');
    expect(raw).not.toContain('@ejemplo.test');
    expect(raw).not.toContain('biz_');
    expect(r.body.rows.every((row) => 'declaredImpact' in row && 'measured' in row)).toBe(true);
    // Las panaderías sintéticas no subieron fotos: quedan marcadas como evidencia "none" (no verificada).
    expect(r.body.rows.map((row) => row.evidence)).toContain('none');
    expect(r.body.rows.every((row) => ['photo', 'partial', 'none'].includes(row.evidence))).toBe(true);
  });

  it('aliados: embudo contra "de cada 10, 3 completan y 1 deja facturas", meta de 90 días, CO₂ y declarado vs medido', async () => {
    const r = await api().get('/allies/report').expect(200);
    const p = r.body.program;
    expect(p.funnel.baselinePer10).toEqual({ completed: 3, withBeforeAfter: 1, measured: null });
    expect(p.funnel.chose).toBeGreaterThanOrEqual(p.funnel.completed);
    expect(p.funnel.completed).toBeGreaterThanOrEqual(p.funnel.withBeforeAfter);
    expect(p.funnel.withBeforeAfter).toBeGreaterThanOrEqual(p.funnel.measured);
    expect(p.goal90Days.measuredWithin90).toBeGreaterThan(0);
    expect(p.goal90Days.measuredWithin90).toBeLessThanOrEqual(p.goal90Days.measured);
    expect(p.totals.published).toBe(true);
    expect(p.totals.co2AvoidedKgPerMonth).toBeGreaterThan(0);
    expect(p.measuredVsDeclared.declared).toBeGreaterThan(0);
  });

  it('negocio nuevo sin facturas: recomendación igual, pidiendo 3 facturas antes de empezar', async () => {
    const r = await api().get('/businesses/biz_nueva/recommendations/first-step?asOf=2026-07-01').expect(200);
    expect(r.body.recommendation.recommended).not.toBeNull();
    expect(r.body.recommendation.measurement).toEqual({ needsBaseline: true, billsAvailable: 0, billsNeeded: 3 });
    expect(r.body.explanation.beforeYouStart).toContain('sube 3 factura(s)');
  });

  it('marcar como visto una versión vieja no la marca (STALE)', async () => {
    const r = await api().post(`/plans/${planId}/savings/seen`).send({ inputsHash: 'viejo' }).expect(200);
    expect(r.body).toEqual({ ok: false, reason: 'STALE' });
  });

  it('negocio inexistente => 404', async () => {
    await api().get('/businesses/nope/recommendations/first-step').expect(404);
  });
});

// Endpoints de demo (solo existen con la opción demo): el correo que falla y se reintenta "ya".
describe('API demo — correo que falla', () => {
  it('falla una vez, se reintenta al instante y sale una sola vez', async () => {
    const repo = createMemoryRepo();
    await seed(repo);
    const messaging = createFakeMessagingClient();
    const app = createApp({ repo, ai: createFakeAiClient(), messaging, clock: () => new Date('2026-07-10T18:00:00Z'), demo: { reset: async () => {} } });
    await repo.enqueueOnce({ key: 'biz_ines:savings-measured:p1', email: 'ines@ejemplo.test', template: 'savings-measured', subject: 's', html: 'h', status: 'pending', attempts: 0, nextAttemptAt: '2026-07-10T18:00:00.000Z' });
    await request(app).post('/internal/demo/messaging').send({ failTimes: 1 }).expect(200);
    const a = await request(app).post('/internal/demo/outbox/deliver-now').expect(200);
    expect(a.body.results[0].status).toBe('retry');
    const b = await request(app).post('/internal/demo/outbox/deliver-now').expect(200);
    expect(b.body.results[0].status).toBe('sent');
    expect(messaging.sent).toHaveLength(1);
  });
});

import express from 'express';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { z } from 'zod';
import { HttpError, toErrorResponse, dayMonth, monthName } from './errors.js';
import { recommendFirstStep } from './domain/recommendation.js';
import { measureSavings, STATUS } from './domain/savings.js';
import { normalizeBill, sortByStart, overlaps, compareConsecutive, billDays, billFingerprint } from './domain/bills.js';
import { explainRecommendation, explainSavings, allyView, currencyFor, describeChange, explainCorrection } from './domain/explanations.js';
import { aggregateForAllies } from './domain/peerStats.js';
import { co2Kg } from './domain/emissions.js';
import { programIndicators } from './domain/program.js';
import { createFakePhotoChecker, photoStatusOf } from './integrations/photos.js';
import { enqueueEmail, deliverPending } from './integrations/messaging.js';
import { subTasksWithFallback, createFakeAiClient } from './integrations/ai.js';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato esperado AAAA-MM-DD');

const BillInput = z
  .object({
    kwhConsumed: z.number().positive().max(1_000_000),
    costPerKwh: z.number().positive().max(10), // una tarifa real (S/ o Bs) está muy por debajo; atrapa "84" en vez de "0,84"
    billingStartDate: isoDate,
    billingEndDate: isoDate,
    uploadedFiles: z.array(z.string()).max(2).default([]),
  })
  .superRefine((b, ctx) => {
    if (b.billingEndDate < b.billingStartDate)
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['billingEndDate'], message: 'END_BEFORE_START', params: { reason: 'END_BEFORE_START' } });
    else if (billDays(b) > 62)
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['billingEndDate'], message: 'TOO_LONG', params: { reason: 'TOO_LONG', days: billDays(b) } });
  });

const SURFACES = ['home', 'catalog', 'diagnosis', 'email'];

const notFound = (what) => new HttpError(404, 'NOT_FOUND', `${what} no existe o ya fue borrado.`, { hint: 'Vuelve a abrir Kamai para ver tus datos actualizados.' });

export function createApp({ repo, ai, messaging, photos = createFakePhotoChecker(), clock = () => new Date(), allySalt = 'demo-salt', demo = null }) {
  const app = express();
  app.use(express.json({ limit: '50kb' }));
  const route = (fn) => (req, res, next) => fn(req, res).catch(next);
  const now = () => clock();

  const electricityBills = async (businessId) => (await repo.listBills(businessId)).filter((b) => (b.type ?? 'electricity') === 'electricity');

  /** Factura como la ve la pantalla: normalizada + CO₂ equivalente (anexo) + estado de la foto. */
  const presentBill = (bill, country) => ({ ...normalizeBill(bill), co2Equivalent: co2Kg(bill.kwhConsumed, country), photoStatus: photoStatusOf(bill) });

  const snap = (b) => ({ kwhConsumed: b.kwhConsumed, costPerKwh: b.costPerKwh, billingStartDate: b.billingStartDate, billingEndDate: b.billingEndDate });
  const logChange = (kind, bill, before, after) =>
    repo.logBillChange({ businessId: bill.businessId, billId: bill.id, kind, before: before && snap(before), after: after && snap(after), at: now().toISOString() });

  /** Agrega a la medición lo que depende del país (CO₂ evitado). */
  const enrich = (m, business) => (m.savings ? { ...m, co2AvoidedKgPerMonth: co2Kg(m.savings.kwhPerMonth, business.country) } : m);

  /** Recalcula desde cero y guarda snapshot solo si cambiaron los datos de entrada. */
  async function refreshSavings(plan) {
    const business = await repo.getBusiness(plan.businessId);
    const bills = await electricityBills(plan.businessId);
    const m = measureSavings(bills, plan);
    const last = await repo.lastSnapshot(plan.id);
    let changed = false;
    if (!last || last.inputsHash !== m.inputsHash) {
      changed = Boolean(last);
      await repo.saveSnapshot({ planId: plan.id, businessId: plan.businessId, inputsHash: m.inputsHash, status: m.status, measurement: m, createdAt: now().toISOString(), supersedes: last?.inputsHash ?? null });
      if (m.status === STATUS.MEASURED && last?.status !== STATUS.MEASURED) {
        const msg = explainSavings(m, business);
        await enqueueEmail(repo, { business, template: 'savings-measured', ref: plan.id, subject: msg.headline, html: `<p>${msg.headline}</p><p>${msg.detail}</p>`, now: now() });
      }
    }
    return { m, last, changed, business };
  }

  async function refreshCompletedPlans(businessId) {
    const plans = (await repo.listPlans(businessId)).filter((p) => p.status === 'completed');
    for (const p of plans) await refreshSavings(p);
  }

  app.get('/health', (req, res) => res.json({ ok: true, repo: repo.kind }));

  // ---------- Recomendación única ----------
  app.get('/businesses/:id/recommendations/first-step', route(async (req, res) => {
    const surface = req.query.surface ?? 'home';
    if (!SURFACES.includes(surface)) throw new HttpError(400, 'BAD_SURFACE', `surface debe ser uno de ${SURFACES.join(', ')}`, { field: 'surface' });
    const business = await repo.getBusiness(req.params.id);
    if (!business) throw notFound('El negocio');
    const [catalog, peerStats, plans, bills] = await Promise.all([
      repo.listCatalog(),
      repo.listPeerStats(business.sector),
      repo.listPlans(business.id),
      electricityBills(business.id),
    ]);
    const asOf = req.query.asOf ?? now().toISOString().slice(0, 10);
    const rec = recommendFirstStep({ business, catalog, peerStats, plans, bills, asOf });
    const last = await repo.lastRecommendation(business.id);
    let stored = last;
    if (!last || last.inputsHash !== rec.inputsHash || last.asOf !== asOf) {
      stored = await repo.saveRecommendation({ id: `rec_${rec.inputsHash}_${asOf}`, businessId: business.id, ...rec, asOf, createdAt: now().toISOString(), firstServedOn: surface });
    }
    // Si ya aceptó un primer paso, ese es "su" primer paso; lo recomendado pasa a ser el siguiente.
    const accepted = plans.filter((p) => p.recommendationId);
    const firstStepPlan = accepted.find((p) => p.status !== 'completed') ?? accepted.find((p) => p.status === 'completed') ?? null;
    res.json({
      recommendationId: stored.id,
      surface,
      firstStepPlan: firstStepPlan && { id: firstStepPlan.id, ecoId: firstStepPlan.ecoCardOrigin, title: firstStepPlan.title, status: firstStepPlan.status },
      recommendation: rec,
      explanation: explainRecommendation(rec, { business, peerStats, catalog }),
    });
  }));

  // ---------- Planes ----------
  app.post('/businesses/:id/plans', route(async (req, res) => {
    const body = z.object({ ecoId: z.string(), startedAt: isoDate.optional(), recommendationId: z.string().optional() }).parse(req.body);
    const business = await repo.getBusiness(req.params.id);
    if (!business) throw notFound('El negocio');
    const eco = (await repo.listCatalog()).find((e) => e.id === body.ecoId);
    if (!eco) throw notFound('La ecoinnovación');
    const startedAt = body.startedAt ?? now().toISOString().slice(0, 10);
    const plan = await repo.insertPlan({
      businessId: business.id,
      ecoCardOrigin: eco.id,
      title: eco.title,
      status: 'in_progress',
      statusUpdatedAt: startedAt,
      startedAt, // NUEVO: necesario para separar línea base
      recommendationId: body.recommendationId ?? null, // NUEVO: trazabilidad de por qué se eligió
      steps: eco.steps.map((title) => ({ title, status: 'not_started', subSteps: [] })),
    });
    res.status(201).json(plan);
  }));

  app.get('/businesses/:id', route(async (req, res) => {
    const b = await repo.getBusiness(req.params.id);
    if (!b) throw notFound('El negocio');
    // Solo lo que necesita la pantalla de la dueña (sin email).
    res.json({ id: b.id, name: b.name, ownerName: b.ownerName, country: b.country, city: b.city, currency: currencyFor(b.country) });
  }));

  app.patch('/plans/:id/steps/:index', route(async (req, res) => {
    const { status } = z.object({ status: z.enum(['not_started', 'completed']) }).parse(req.body);
    const plan = await repo.getPlan(req.params.id);
    if (!plan) throw notFound('El plan');
    const i = Number(req.params.index);
    if (!Number.isInteger(i) || i < 0 || i >= plan.steps.length) throw new HttpError(400, 'BAD_STEP', 'Ese paso no existe.', { hint: 'Vuelve a abrir tu plan.' });
    const steps = plan.steps.map((s, k) => (k === i ? { ...s, status } : s));
    res.json(await repo.updatePlan(plan.id, { steps }));
  }));

  app.get('/plans/:id', route(async (req, res) => {
    const plan = await repo.getPlan(req.params.id);
    if (!plan) throw notFound('El plan');
    res.json(plan);
  }));

  app.post('/plans/:id/complete', route(async (req, res) => {
    const body = z
      .object({ completedAt: isoDate, perceivedImpact: z.object({ scale: z.number().int().min(1).max(5), text: z.string().max(500).optional() }).optional() })
      .parse(req.body);
    const plan = await repo.getPlan(req.params.id);
    if (!plan) throw notFound('El plan');
    const today = now().toISOString().slice(0, 10);
    if (plan.status === 'completed') {
      // Doble toque o reintento con la misma fecha: idempotente, no es un error.
      if (plan.completedAt === body.completedAt) {
        const { m, business } = await refreshSavings(plan);
        return res.json({ plan, savings: { measurement: m, explanation: explainSavings(m, business) } });
      }
      throw new HttpError(409, 'PLAN_ALREADY_COMPLETED', `Ya marcaste este paso como terminado el ${dayMonth(plan.completedAt)}.`, {
        hint: 'No hace falta hacerlo de nuevo. Tu ahorro se mide desde esa fecha.',
        details: { completedAt: plan.completedAt },
      });
    }
    if (plan.startedAt && body.completedAt < plan.startedAt)
      throw new HttpError(400, 'COMPLETED_BEFORE_START', `Pusiste el ${dayMonth(body.completedAt)}, pero empezaste este paso el ${dayMonth(plan.startedAt)}.`, {
        hint: `Elige un día desde el ${dayMonth(plan.startedAt)} en adelante.`,
        field: 'completedAt',
        details: { minDate: plan.startedAt },
      });
    if (body.completedAt > today)
      throw new HttpError(400, 'COMPLETED_IN_FUTURE', `El ${dayMonth(body.completedAt)} todavía no llegó.`, {
        hint: 'Elige hoy o un día anterior. Si todavía no lo terminaste, vuelve cuando lo hagas.',
        field: 'completedAt',
        details: { maxDate: today },
      });
    const updated = await repo.updatePlan(plan.id, { status: 'completed', statusUpdatedAt: body.completedAt, completedAt: body.completedAt, perceivedImpact: body.perceivedImpact ?? null });
    const { m, business } = await refreshSavings(updated);
    res.json({ plan: updated, savings: { measurement: m, explanation: explainSavings(m, business) } });
  }));

  app.post('/plans/:id/sub-tasks', route(async (req, res) => {
    const { stepsId } = z.object({ stepsId: z.array(z.string()).min(1) }).parse(req.body);
    const plan = await repo.getPlan(req.params.id);
    if (!plan) throw notFound('El plan');
    // Solo en demo: ?simulate=timeout|quota fuerza la falla del proveedor para mostrar el respaldo.
    const client = demo && req.query.simulate ? createFakeAiClient({ mode: String(req.query.simulate) }) : ai;
    res.json(await subTasksWithFallback(client, plan, stepsId));
  }));

  // ---------- Facturas ----------
  app.get('/businesses/:id/bills', route(async (req, res) => {
    const business = await repo.getBusiness(req.params.id);
    if (!business) throw notFound('El negocio');
    const bills = sortByStart(await electricityBills(business.id)).map((b) => presentBill(b, business.country));
    const comparisons = bills.slice(1).map((b, i) => compareConsecutive(bills[i], b));
    const corrections = (await repo.listBillChanges(business.id))
      .filter((e) => e.kind !== 'created')
      .slice(-5)
      .reverse()
      .map((e) => ({ ...e, text: describeChange(e) }));
    res.json({ currency: currencyFor(business.country), bills, comparisons, corrections });
  }));

  async function assertNoOverlap(businessId, candidate, selfId) {
    const clash = (await repo.listBills(businessId)).find((b) => b.id !== selfId && (b.type ?? 'electricity') === 'electricity' && overlaps(b, candidate));
    if (clash)
      throw new HttpError(409, 'OVERLAPPING_PERIOD', `Estas fechas se cruzan con tu factura de ${monthName(clash.billingStartDate)} (del ${dayMonth(clash.billingStartDate)} al ${dayMonth(clash.billingEndDate)}).`, {
        hint: 'Cada día va en una sola factura. Revisa las fechas de esta, o corrige la otra si es la que está mal.',
        field: 'billingStartDate',
        details: { conflictsWith: clash.id, conflictStart: clash.billingStartDate, conflictEnd: clash.billingEndDate },
      });
  }

  app.post('/businesses/:id/bills', route(async (req, res) => {
    const business = await repo.getBusiness(req.params.id);
    if (!business) throw notFound('El negocio');
    const input = BillInput.parse(req.body);
    await assertNoOverlap(business.id, input);
    const photoStatus = input.uploadedFiles.length ? await photos.check(input.uploadedFiles[0]) : 'none';
    const bill = await repo.insertBill({ ...input, businessId: business.id, type: 'electricity', currency: currencyFor(business.country), evidence: input.uploadedFiles.length ? 'photo' : 'none', photoStatus });
    await logChange('created', bill, null, bill);
    await refreshCompletedPlans(business.id);
    res.status(201).json(presentBill(bill, business.country));
  }));

  app.put('/bills/:id', route(async (req, res) => {
    const cur = await repo.getBill(req.params.id);
    if (!cur) throw notFound('La factura');
    const input = BillInput.parse({ ...cur, ...req.body });
    await assertNoOverlap(cur.businessId, input, cur.id);
    const photoChanged = JSON.stringify(input.uploadedFiles) !== JSON.stringify(cur.uploadedFiles ?? []);
    const photoStatus = !input.uploadedFiles.length ? 'none' : photoChanged ? await photos.check(input.uploadedFiles[0]) : photoStatusOf(cur);
    const bill = await repo.updateBill(cur.id, { ...input, evidence: input.uploadedFiles.length ? 'photo' : 'none', photoStatus, updatedAt: now().toISOString() });
    if (billFingerprint(cur) !== billFingerprint(bill)) await logChange('edited', bill, cur, bill);
    await refreshCompletedPlans(cur.businessId);
    const business = await repo.getBusiness(cur.businessId);
    res.json(presentBill(bill, business.country));
  }));

  app.delete('/bills/:id', route(async (req, res) => {
    const cur = await repo.getBill(req.params.id);
    if (!cur) throw notFound('La factura');
    await repo.deleteBill(cur.id);
    await logChange('deleted', cur, cur, null);
    await refreshCompletedPlans(cur.businessId);
    res.status(204).end();
  }));

  // ---------- Ahorro medido ----------
  app.get('/plans/:id/savings', route(async (req, res) => {
    const plan = await repo.getPlan(req.params.id);
    if (!plan) throw notFound('El plan');
    const { m: raw, business } = await refreshSavings(plan);
    const m = enrich(raw, business);
    const explanation = explainSavings(m, business);
    // Se compara contra lo último que VIO la dueña (no contra el último snapshot), para avisarle de cualquier cambio.
    const shown = plan.savingsLastShown;
    const corrections = (await repo.listBillChanges(plan.businessId)).filter((e) => e.kind !== 'created');
    const fingerprints = Object.fromEntries((await electricityBills(plan.businessId)).map((b) => [b.id, billFingerprint(b)]));
    const changed = Boolean(shown && shown.inputsHash !== m.inputsHash);
    let changeKind = null;
    if (changed) {
      // Si todas las facturas que ya vio siguen iguales, solo se agregaron nuevas: es avance, no corrección.
      const rewritten = Object.entries(shown.fingerprints ?? {}).some(([id, fp]) => fingerprints[id] !== fp);
      changeKind = rewritten ? 'EDITED_OR_DELETED' : 'NEW_BILLS';
      if (rewritten) {
        // Solo las facturas que ya había visto y que cambiaron o desaparecieron (la última corrección de cada una).
        const touched = Object.entries(shown.fingerprints ?? {}).filter(([id, fp]) => fingerprints[id] !== fp).map(([id]) => id);
        const latestPerBill = touched.map((id) => corrections.filter((e) => e.billId === id).at(-1)).filter(Boolean);
        latestPerBill.sort((a, b) => a.at.localeCompare(b.at));
        explanation.updateNote = explainCorrection(latestPerBill, { shown, m, country: business.country });
      }
      else if (shown.status === m.status && m.status === 'MEASURED')
        explanation.updateNote = 'Con tu nueva factura, la medición es más precisa.';
    }
    // La última corrección queda siempre a la vista (no solo la primera vez), para que la tenga presente.
    const last = corrections.at(-1);
    res.json({
      planId: plan.id,
      ecoId: plan.ecoCardOrigin,
      measurement: m,
      explanation,
      previous: changed ? { status: shown.status, inputsHash: shown.inputsHash, changeKind } : null,
      lastCorrection: last ? { ...last, text: describeChange(last) } : null,
    });
  }));

  /**
   * "Inés vio este resultado". Consultar el ahorro no cambia nada; solo la pantalla de ahorro, al mostrarlo, lo marca como visto.
   * Así, si corrige una factura desde Facturas (que también consulta el ahorro para el gráfico), el aviso la espera en "Mi ahorro".
   */
  app.post('/plans/:id/savings/seen', route(async (req, res) => {
    const { inputsHash } = z.object({ inputsHash: z.string().min(1) }).parse(req.body);
    const plan = await repo.getPlan(req.params.id);
    if (!plan) throw notFound('El plan');
    const bills = await electricityBills(plan.businessId);
    const m = measureSavings(bills, plan);
    if (m.inputsHash !== inputsHash) return res.json({ ok: false, reason: 'STALE' }); // vio una versión vieja: no la marcamos
    await repo.updatePlan(plan.id, {
      savingsLastShown: {
        inputsHash: m.inputsHash,
        status: m.status,
        moneyPerMonth: m.savings?.moneyPerMonthAtCurrentTariff ?? null,
        fingerprints: Object.fromEntries(bills.map((b) => [b.id, billFingerprint(b)])),
        at: now().toISOString(),
      },
    });
    res.json({ ok: true });
  }));

  // ---------- Aliados: agregado, sin datos personales ----------
  app.get('/allies/report', route(async (req, res) => {
    const allPlans = await repo.listAllPlans();
    const programRows = [];
    const rows = [];
    for (const p of allPlans) {
      const business = await repo.getBusiness(p.businessId);
      const bills = await electricityBills(p.businessId);
      const m = enrich(measureSavings(bills, p), business);
      programRows.push({ plan: p, business, m, billsById: Object.fromEntries(bills.map((b) => [b.id, b])) });
      if (p.status !== 'completed') continue;
      const businessRef = createHash('sha256').update(allySalt + p.businessId).digest('hex').slice(0, 10);
      // Evidencia: ¿las facturas usadas en la medición tienen foto legible? (si no, cuenta para ella pero queda "sin verificar")
      const used = new Set([...m.periods.baseline, ...m.periods.post]);
      const verified = bills.filter((b) => used.has(b.id) && photoStatusOf(b) === 'readable').length;
      const evidence = used.size === 0 ? 'none' : verified === used.size ? 'photo' : verified === 0 ? 'none' : 'partial';
      rows.push({ m, view: { ...allyView(m, { businessRef, ecoId: p.ecoCardOrigin, perceivedImpact: p.perceivedImpact?.scale }), evidence, country: business.country } });
    }
    res.json({
      generatedAt: now().toISOString(),
      summary: aggregateForAllies(rows.map((r) => r.m)),
      program: programIndicators(programRows, { now: now() }),
      rows: rows.map((r) => r.view),
    });
  }));

  // ---------- Interno: worker de correos (en prod: cron / job programado) ----------
  app.post('/internal/outbox/deliver', route(async (req, res) => {
    res.json({ results: await deliverPending(repo, messaging, { now: now() }) });
  }));
  app.get('/internal/outbox', route(async (req, res) => res.json(await repo.listOutbox())));
  if (demo?.reset) app.post('/internal/demo/reset', route(async (req, res) => { await demo.reset(); res.json({ ok: true }); }));
  if (demo) {
    app.get('/internal/demo', (req, res) => res.json({ ok: true }));
    // Solo demo: hacer que el servicio de correos falle N veces, y entregar sin esperar el backoff.
    app.post('/internal/demo/messaging', route(async (req, res) => {
      const { failTimes } = z.object({ failTimes: z.number().int().min(0).max(10) }).parse(req.body);
      messaging.setFailTimes?.(failTimes);
      res.json({ ok: true, failTimes });
    }));
    app.post('/internal/demo/outbox/deliver-now', route(async (req, res) => {
      // "Que pase el tiempo": los pendientes quedan listos para reintentarse ya, sin esperar el backoff.
      const t = now();
      for (const m of await repo.listOutbox({ status: 'pending' })) await repo.updateOutbox(m.key, { nextAttemptAt: t.toISOString() });
      res.json({ results: await deliverPending(repo, messaging, { now: t }) });
    }));
  }

  // Frontend React compilado (web/dist).
  const webDist = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'web', 'dist');
  app.use(express.static(webDist));
  app.get('/', (req, res) => res.status(404).type('text').send('Falta compilar el frontend: cd web && npm install && npm run build'));

  // ---------- Errores ----------
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    const { status, body } = toErrorResponse(err);
    // Registro corto para poder ver qué error vio la persona (sin datos personales).
    if (status >= 500) console.error(err);
    else console.warn(`[${status}] ${req.method} ${req.path} → ${body.error}${body.field ? ` (${body.field})` : ''}`);
    res.status(status).json(body);
  });
  return app;
}

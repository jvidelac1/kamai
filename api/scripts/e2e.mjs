// Recorre el escenario completo de Inés por HTTP real y escribe la evidencia en ../evidence/e2e.md
// Uso: node scripts/e2e.mjs [--memory]   (por defecto usa MongoDB en memoria)
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from '../src/app.js';
import { createMemoryRepo } from '../src/repo/memoryRepo.js';
import { createMongoRepo } from '../src/repo/mongoRepo.js';
import { seed } from '../src/seed/seed.js';
import { createFakeAiClient } from '../src/integrations/ai.js';
import { createFakeMessagingClient } from '../src/integrations/messaging.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const useMemory = process.argv.includes('--memory');

let repo;
let stopMongo = async () => {};
if (useMemory) repo = createMemoryRepo();
else {
  const { MongoMemoryServer } = await import('mongodb-memory-server');
  const mongod = await MongoMemoryServer.create();
  repo = await createMongoRepo(mongod.getUri(), 'kamai_demo');
  stopMongo = () => mongod.stop();
}
await seed(repo);

let now = new Date('2026-07-01T12:00:00Z');
const ai = createFakeAiClient();
const messaging = createFakeMessagingClient({ failTimes: 1 });
const app = createApp({ repo, ai, messaging, clock: () => now });
const server = app.listen(0);
const base = `http://localhost:${server.address().port}`;

const out = [];
const md = (s = '') => out.push(s);
let step = 0;
const checks = [];

async function call(title, method, url, body, pick = (b) => b) {
  const res = await fetch(base + url, { method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const json = res.status === 204 ? null : await res.json();
  md(`### ${++step}. ${title}`);
  md('```http');
  md(`${method} ${url}${body ? `\n\n${JSON.stringify(body)}` : ''}`);
  md('```');
  md(`**→ ${res.status}**`);
  if (json) {
    md('```json');
    md(JSON.stringify(pick(json), null, 2));
    md('```');
  }
  md();
  return { status: res.status, body: json };
}
function check(label, ok) {
  checks.push({ label, ok });
  if (!ok) process.exitCode = 1;
}

md('# El caso de Inés, paso a paso por HTTP');
md();
md(`Generado el ${new Date().toISOString().slice(0, 10)} contra un servidor real (repo: ${repo.kind}).`);
md();
md('Las facturas de enero a junio son las del caso. Las de julio a septiembre las inventé para poder mostrar la medición.');
md();

const surfaces = [];
for (const s of ['home', 'catalog', 'diagnosis', 'email']) {
  const r = await call(`Recomendación desde "${s}"`, 'GET', `/businesses/biz_ines/recommendations/first-step?surface=${s}&asOf=2026-07-01`, null, (b) =>
    s === 'home' ? { recommendationId: b.recommendationId, recommended: b.recommendation.recommended, reasons: b.recommendation.reasons.map((x) => x.code), alternatives: b.recommendation.alternatives.map((a) => a.ecoId), excluded: b.recommendation.excluded, stalledPlans: b.recommendation.stalledPlans, explanation: b.explanation } : { recommendationId: b.recommendationId, recommended: b.recommendation.recommended.ecoId },
  );
  surfaces.push(r.body);
}
check('Los 4 lugares recomiendan lo mismo (eco_118)', surfaces.every((s) => s.recommendation.recommended.ecoId === 'eco_118'));
check('Una sola recomendación guardada con su porqué', new Set(surfaces.map((s) => s.recommendationId)).size === 1);
check('Detecta aislamiento trabado 7 semanas', surfaces[0].recommendation.stalledPlans[0]?.weeksWithoutProgress === 7);

const bills = await call('Facturas normalizadas: la trampa de febrero', 'GET', '/businesses/biz_ines/bills', null, (b) => ({ comparisons: b.comparisons.slice(0, 2), last: b.comparisons.at(-1) }));
check('Febrero: "ahorraste S/ 117" marcado como engañoso', bills.body.comparisons[0].verdict === 'NAIVE_SAVING_IS_MISLEADING');

const plan = await call('Inés acepta el primer paso', 'POST', '/businesses/biz_ines/plans', { ecoId: 'eco_118', startedAt: '2026-07-01', recommendationId: surfaces[0].recommendationId }, (b) => ({ id: b.id, status: b.status, startedAt: b.startedAt, recommendationId: b.recommendationId }));
const planId = plan.body.id;

ai.mode = 'timeout'; // el proveedor de IA no responde
const aiDown = await call('Subtareas con el proveedor de IA caído', 'POST', `/plans/${planId}/sub-tasks`, { stepsId: ['step_1', 'step_2', 'step_3'] });
ai.mode = 'ok';
check('IA caída → pasos estáticos, 200', aiDown.status === 200 && aiDown.body.source === 'static');

now = new Date('2026-07-10T18:00:00Z'); // la marca como terminada ese mismo día
const done = await call('Completa la ecoinnovación el 10/7', 'POST', `/plans/${planId}/complete`, { completedAt: '2026-07-10', perceivedImpact: { scale: 4, text: 'Las refris ya no hacen tanto hielo' } }, (b) => ({ status: b.savings.measurement.status, explanation: b.savings.explanation }));
check('Recién completada → WAITING_POST_DATA', done.body.savings.measurement.status === 'WAITING_POST_DATA');

await call('Sube julio (periodo mixto)', 'POST', '/businesses/biz_ines/bills', { kwhConsumed: 1800, costPerKwh: 0.84, billingStartDate: '2026-07-01', billingEndDate: '2026-07-31', uploadedFiles: ['jul.jpg'] }, (b) => ({ id: b.id, kwhPerDay: b.kwhPerDay, currency: b.currency }));
const overlap = await call('Intenta subir un periodo superpuesto', 'POST', '/businesses/biz_ines/bills', { kwhConsumed: 900, costPerKwh: 0.84, billingStartDate: '2026-07-15', billingEndDate: '2026-08-10' });
check('Superposición → 409', overlap.status === 409);
await call('Sube agosto', 'POST', '/businesses/biz_ines/bills', { kwhConsumed: 1767, costPerKwh: 0.84, billingStartDate: '2026-08-01', billingEndDate: '2026-08-31', uploadedFiles: ['ago.jpg'] }, (b) => ({ id: b.id, kwhPerDay: b.kwhPerDay }));
const s1 = await call('Ahorro con una factura posterior', 'GET', `/plans/${planId}/savings`, null, (b) => ({ status: b.measurement.status, periods: b.measurement.periods, baseline: b.measurement.baseline, savings: b.measurement.savings, explanation: b.explanation }));
await fetch(base + '/plans/' + planId + '/savings/seen', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ inputsHash: s1.body.measurement.inputsHash }) }); // Inés lo ve en Mi ahorro
check('Agosto solo → INCONCLUSIVE ("todavía no podemos saberlo")', s1.body.measurement.status === 'INCONCLUSIVE');

const sep = await call('Sube septiembre (la tarifa vuelve a subir: 0,86)', 'POST', '/businesses/biz_ines/bills', { kwhConsumed: 1665, costPerKwh: 0.86, billingStartDate: '2026-09-01', billingEndDate: '2026-09-30', uploadedFiles: ['sep.jpg'] }, (b) => ({ id: b.id, totalCost: b.totalCost }));
const s2 = await call('Ahorro con dos facturas posteriores', 'GET', `/plans/${planId}/savings`, null, (b) => ({ status: b.measurement.status, savings: b.measurement.savings, tariffEffect: b.measurement.tariffEffect, limitations: b.measurement.limitations, explanation: b.explanation, previous: b.previous }));
await fetch(base + '/plans/' + planId + '/savings/seen', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ inputsHash: s2.body.measurement.inputsHash }) }); // Inés lo ve en Mi ahorro
check('Con septiembre → MEASURED, S/ 88/mes', s2.body.measurement.status === 'MEASURED' && s2.body.measurement.savings.moneyPerMonthAtCurrentTariff === 88);
check('La resta simple en soles habría mostrado mucho menos ahorro', s2.body.measurement.tariffEffect.naiveMoneyPerMonth < 44);

await call('Worker de correos (1er intento: el servicio de mensajería falla)', 'POST', '/internal/outbox/deliver');
now = new Date(now.getTime() + 2 * 60_000);
const d2 = await call('Worker de correos (2 min después: reintento)', 'POST', '/internal/outbox/deliver');
check('Correo "ahorro medido" enviado una sola vez tras reintento', messaging.sent.length === 1 && d2.body.results[0]?.status === 'sent');

await call('Edita septiembre (se equivocó: eran 1.750 kWh)', 'PUT', `/bills/${sep.body.id}`, { kwhConsumed: 1750 }, (b) => ({ id: b.id, kwhConsumed: b.kwhConsumed, kwhPerDay: b.kwhPerDay }));
const s3 = await call('Ahorro tras la edición', 'GET', `/plans/${planId}/savings`, null, (b) => ({ status: b.measurement.status, savingsPct: b.measurement.savings.pct, explanation: b.explanation, previous: b.previous }));
check('Edición → recalcula desde cero y avisa que la cifra anterior ya no vale', s3.body.measurement.status === 'INCONCLUSIVE' && s3.body.previous?.changeKind === 'EDITED_OR_DELETED');

const allies = await call('Reporte para aliados (agregado, k ≥ 5)', 'GET', '/allies/report', null, (b) => ({ summary: b.summary, sampleRows: b.rows.slice(0, 2) }));
check('Aliados: sin nombres ni emails, publica mediana con ≥5 medidos', allies.body.summary.published && !JSON.stringify(allies.body).includes('@ejemplo'));

out.splice(6, 0, '## Qué se verificó', '', ...checks.map((c) => `- [${c.ok ? 'ok' : 'FALLA'}] ${c.label}`), '', '## Pedidos y respuestas', '');

server.close();
await repo.close();
await stopMongo();

const dest = path.join(here, '..', '..', 'evidence', 'e2e.md');
await mkdir(path.dirname(dest), { recursive: true });
await writeFile(dest, out.join('\n'), 'utf8');
for (const c of checks) console.log(`${c.ok ? 'OK  ' : 'FAIL'} ${c.label}`);
console.log(`\nEvidencia escrita en ${dest}`);

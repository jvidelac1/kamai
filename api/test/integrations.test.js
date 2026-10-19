import { describe, it, expect } from 'vitest';
import { createMemoryRepo } from '../src/repo/memoryRepo.js';
import { enqueueEmail, deliverPending, createFakeMessagingClient, BACKOFF_MINUTES } from '../src/integrations/messaging.js';
import { subTasksWithFallback, createFakeAiClient } from '../src/integrations/ai.js';

const business = { id: 'biz_x', email: 'x@ejemplo.test' };
const t0 = new Date('2026-09-01T10:00:00Z');

describe('outbox de correos', () => {
  it('encola una sola vez por negocio + plantilla + referencia', async () => {
    const repo = createMemoryRepo();
    const a = await enqueueEmail(repo, { business, template: 'savings-measured', ref: 'plan_1', subject: 's', html: 'h', now: t0 });
    const b = await enqueueEmail(repo, { business, template: 'savings-measured', ref: 'plan_1', subject: 's', html: 'h', now: t0 });
    expect(a.inserted).toBe(true);
    expect(b.inserted).toBe(false);
    expect(await repo.listOutbox()).toHaveLength(1);
  });

  it('no escribe a direcciones que rebotaron', async () => {
    const repo = createMemoryRepo();
    await enqueueEmail(repo, { business: { ...business, emailBounced: true }, template: 't', ref: 'r', subject: 's', html: 'h', now: t0 });
    const client = createFakeMessagingClient();
    expect(await deliverPending(repo, client, { now: t0 })).toHaveLength(0);
    expect((await repo.listOutbox())[0].status).toBe('suppressed');
    expect(client.sent).toHaveLength(0);
  });

  it('primer fallo: queda pending con attempts=1 y reintento a 1 minuto', async () => {
    const repo = createMemoryRepo();
    await enqueueEmail(repo, { business, template: 't', ref: 'r', subject: 's', html: 'h', now: t0 });
    await deliverPending(repo, createFakeMessagingClient({ failTimes: 1 }), { now: t0 });
    const [m] = await repo.listOutbox();
    expect(m).toMatchObject({ status: 'pending', attempts: 1, lastError: 'messaging 503' });
    expect(new Date(m.nextAttemptAt).getTime() - t0.getTime()).toBe(60_000);
  });

  it('no reintenta antes de tiempo', async () => {
    const repo = createMemoryRepo();
    const client = createFakeMessagingClient({ failTimes: 1 });
    await enqueueEmail(repo, { business, template: 't', ref: 'r', subject: 's', html: 'h', now: t0 });
    await deliverPending(repo, client, { now: t0 });
    expect(await deliverPending(repo, client, { now: new Date(t0.getTime() + 30_000) })).toHaveLength(0);
  });

  it('después de 5 intentos fallidos queda failed', async () => {
    const repo = createMemoryRepo();
    const client = createFakeMessagingClient({ failTimes: 99 });
    await enqueueEmail(repo, { business, template: 't', ref: 'r', subject: 's', html: 'h', now: t0 });
    let now = t0;
    for (let i = 0; i < BACKOFF_MINUTES.length; i++) {
      await deliverPending(repo, client, { now });
      now = new Date(now.getTime() + 24 * 3600_000);
    }
    const [m] = await repo.listOutbox();
    expect(m).toMatchObject({ status: 'failed', attempts: 5 });
    expect(client.sent).toHaveLength(0);
  });
});

describe('subtareas con respaldo', () => {
  const plan = { id: 'plan_1', steps: [{ title: 'Revisar burletes' }, { title: 'Programar descongelamiento' }] };

  it('timeout => pasos estáticos reintentables', async () => {
    const r = await subTasksWithFallback(createFakeAiClient({ mode: 'timeout' }), plan, ['s1', 's2']);
    expect(r).toMatchObject({ source: 'static', reason: 'AI_UNAVAILABLE', retryable: true });
    expect(r.steps.map((s) => s.title)).toEqual(['Revisar burletes', 'Programar descongelamiento']);
  });

  it('402 => sin cupo, no reintentable', async () => {
    const r = await subTasksWithFallback(createFakeAiClient({ mode: 'quota' }), plan, ['s1']);
    expect(r).toMatchObject({ source: 'static', reason: 'NO_QUOTA', retryable: false });
  });
});

// Correos vía el servicio interno de mensajería, con outbox: el request de la usuaria nunca espera ni falla por el correo.

export function createHttpMessagingClient({ url, apiKey, timeoutMs = 5000, fetchImpl = fetch }) {
  return {
    async send({ email, subject, html }) {
      const res = await fetchImpl(`${url}/v1/email/send`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': apiKey },
        body: JSON.stringify({ email, subject, html }),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (res.status !== 200) throw Object.assign(new Error(`messaging ${res.status}`), { status: res.status });
    },
  };
}

/** Cliente falso para dev/tests. `failTimes` simula caídas antes de aceptar. */
export function createFakeMessagingClient({ failTimes = 0 } = {}) {
  let failures = 0;
  const sent = [];
  return {
    sent,
    /** Solo demo/tests: que los próximos N envíos fallen. */
    setFailTimes(n) {
      failTimes = n;
      failures = 0;
    },
    async send(msg) {
      if (failures < failTimes) {
        failures++;
        throw Object.assign(new Error('messaging 503'), { status: 503 });
      }
      sent.push(msg);
    },
  };
}

export const BACKOFF_MINUTES = [1, 5, 30, 120, 720];

/**
 * Encola una sola vez por (persona, plantilla, referencia). No escribe a direcciones que rebotaron.
 */
export async function enqueueEmail(repo, { business, template, ref, subject, html, now = new Date() }) {
  const key = `${business.id}:${template}:${ref}`;
  if (business.emailBounced) {
    return repo.enqueueOnce({ key, email: business.email, template, subject, html, status: 'suppressed', attempts: 0, createdAt: now.toISOString() });
  }
  return repo.enqueueOnce({
    key,
    email: business.email,
    template,
    subject,
    html,
    status: 'pending',
    attempts: 0,
    nextAttemptAt: now.toISOString(),
    createdAt: now.toISOString(),
  });
}

/** Worker: entrega pendientes con reintentos exponenciales. Después de 5 intentos queda 'failed' (visible en panel interno). */
export async function deliverPending(repo, client, { now = new Date() } = {}) {
  const pending = (await repo.listOutbox({ status: 'pending' })).filter((m) => new Date(m.nextAttemptAt) <= now);
  const results = [];
  for (const m of pending) {
    try {
      await client.send({ email: m.email, subject: m.subject, html: m.html });
      await repo.updateOutbox(m.key, { status: 'sent', sentAt: now.toISOString(), attempts: m.attempts + 1 });
      results.push({ key: m.key, status: 'sent' });
    } catch (err) {
      const attempts = m.attempts + 1;
      const done = attempts >= BACKOFF_MINUTES.length;
      const next = new Date(now.getTime() + BACKOFF_MINUTES[Math.min(attempts - 1, BACKOFF_MINUTES.length - 1)] * 60_000);
      await repo.updateOutbox(m.key, {
        status: done ? 'failed' : 'pending',
        attempts,
        lastError: err.message,
        nextAttemptAt: next.toISOString(),
      });
      results.push({ key: m.key, status: done ? 'failed' : 'retry', error: err.message });
    }
  }
  return results;
}

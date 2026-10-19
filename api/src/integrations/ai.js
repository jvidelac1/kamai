// Proveedor de IA para subtareas. La IA es opcional: si falla, la usuaria ve los pasos del catálogo y puede reintentar.

export function createHttpAiClient({ url, apiKey, timeoutMs = 8000, fetchImpl = fetch }) {
  return {
    async subTasks({ userEcoCardId, stepsId }) {
      const res = await fetchImpl(`${url}/ia/ecoinnovation/sub-tasks`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ userEcoCardId, stepsId }),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!res.ok) throw Object.assign(new Error(`ai ${res.status}`), { status: res.status });
      return res.json();
    },
  };
}

/** mode: 'ok' | 'timeout' | 'quota' */
export function createFakeAiClient({ mode = 'ok' } = {}) {
  return {
    mode,
    async subTasks({ stepsId }) {
      if (this.mode === 'timeout') throw Object.assign(new Error('ai timeout'), { name: 'TimeoutError' });
      if (this.mode === 'quota') throw Object.assign(new Error('ai 402'), { status: 402 });
      return { steps: stepsId.map((id) => ({ _id: id, subSteps: ['Revisar el estado actual', 'Anotar lo que encontraste'] })) };
    },
  };
}

export async function subTasksWithFallback(ai, plan, stepsId) {
  try {
    const out = await ai.subTasks({ userEcoCardId: plan.id, stepsId });
    return { source: 'ai', steps: out.steps };
  } catch (err) {
    const reason = err.status === 402 ? 'NO_QUOTA' : 'AI_UNAVAILABLE';
    return {
      source: 'static',
      reason,
      retryable: reason === 'AI_UNAVAILABLE',
      message:
        reason === 'NO_QUOTA'
          ? 'Usaste las sugerencias automáticas de este mes. Puedes seguir con los pasos de la guía.'
          : 'Las sugerencias automáticas no están disponibles ahora. Aquí tienes los pasos de la guía; puedes reintentar más tarde.',
      steps: plan.steps.map((s, i) => ({ _id: stepsId[i] ?? `step_${i + 1}`, title: s.title, subSteps: [] })),
    };
  }
}

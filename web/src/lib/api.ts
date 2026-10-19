import type { AlliesReport, Bill, BillInput, BillsResponse, Business, Plan, RecommendationResponse, SavingsResponse, SubTasksResponse } from './types'
import { CASO } from './caso'

/** Error de la API tal como lo manda el servidor: qué pasó, qué hacer y en qué campo. status 0 = sin conexión. */
export class ApiError extends Error {
  status: number
  code: string
  hint?: string
  field?: string
  fields?: Record<string, string>
  details: Record<string, unknown>
  constructor(status: number, body: Record<string, unknown> | null) {
    super(typeof body?.message === 'string' ? body.message : 'Algo salió mal')
    this.status = status
    this.code = typeof body?.error === 'string' ? body.error : status === 0 ? 'NETWORK' : 'UNKNOWN'
    this.hint = typeof body?.hint === 'string' ? body.hint : undefined
    this.field = typeof body?.field === 'string' ? body.field : undefined
    this.fields = (body?.fields as Record<string, string>) ?? undefined
    this.details = body ?? {}
  }
}

async function http<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, ...rest } = init
  let res: Response
  try {
    res = await fetch(path, {
      ...rest,
      headers: { 'content-type': 'application/json', ...rest.headers },
      body: json === undefined ? rest.body : JSON.stringify(json),
    })
  } catch {
    throw new ApiError(0, null) // sin señal o servidor inalcanzable
  }
  if (res.status === 204) return undefined as T
  const body = await res.json().catch(() => null)
  if (!res.ok) throw new ApiError(res.status, body)
  return body as T
}

const biz = CASO.businessId

export const api = {
  business: () => http<Business>(`/businesses/${biz}`),
  recommendation: () => http<RecommendationResponse>(`/businesses/${biz}/recommendations/first-step?surface=home&asOf=${CASO.hoy}`),
  plan: (id: string) => http<Plan>(`/plans/${id}`),
  startPlan: (ecoId: string, recommendationId: string) =>
    http<Plan>(`/businesses/${biz}/plans`, { method: 'POST', json: { ecoId, recommendationId, startedAt: CASO.hoy } }),
  setStep: (planId: string, index: number, done: boolean) =>
    http<Plan>(`/plans/${planId}/steps/${index}`, { method: 'PATCH', json: { status: done ? 'completed' : 'not_started' } }),
  subTasks: (planId: string, stepIndex: number, simulateAiDown: boolean) =>
    http<SubTasksResponse>(`/plans/${planId}/sub-tasks${simulateAiDown ? '?simulate=timeout' : ''}`, {
      method: 'POST',
      json: { stepsId: [`step_${stepIndex + 1}`] },
    }),
  completePlan: (planId: string, completedAt: string, scale?: number, text?: string) =>
    http<{ plan: Plan }>(`/plans/${planId}/complete`, {
      method: 'POST',
      // Impacto percibido (lo que ella declara): escala + texto libre, como el formulario actual de Kamai.
      json: { completedAt, ...(scale || text ? { perceivedImpact: { scale: scale ?? 3, ...(text ? { text } : {}) } } : {}) },
    }),
  bills: () => http<BillsResponse>(`/businesses/${biz}/bills`),
  addBill: (input: BillInput) => http<Bill>(`/businesses/${biz}/bills`, { method: 'POST', json: input }),
  updateBill: (id: string, input: Partial<BillInput>) => http<Bill>(`/bills/${id}`, { method: 'PUT', json: input }),
  deleteBill: (id: string) => http<void>(`/bills/${id}`, { method: 'DELETE' }),
  savings: (planId: string) => http<SavingsResponse>(`/plans/${planId}/savings`),
  /** "Inés vio este resultado" (solo lo llama la pantalla Mi ahorro al mostrarlo). */
  markSavingsSeen: (planId: string, inputsHash: string) => http<{ ok: boolean }>(`/plans/${planId}/savings/seen`, { method: 'POST', json: { inputsHash } }),
  resetDemo: () => http<{ ok: true }>('/internal/demo/reset', { method: 'POST' }),
  alliesReport: () => http<AlliesReport>('/allies/report'),
}

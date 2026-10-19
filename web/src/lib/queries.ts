import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './api'
import type { BillInput } from './types'

export const keys = {
  business: ['business'] as const,
  rec: ['recommendation'] as const,
  bills: ['bills'] as const,
  plan: (id: string) => ['plan', id] as const,
  savings: (id: string) => ['savings', id] as const,
}

export const useBusiness = () => useQuery({ queryKey: keys.business, queryFn: api.business, staleTime: Infinity })
export const useRecommendation = () => useQuery({ queryKey: keys.rec, queryFn: api.recommendation })
export const useBills = () => useQuery({ queryKey: keys.bills, queryFn: api.bills })
export const useAlliesReport = () => useQuery({ queryKey: ['allies'], queryFn: api.alliesReport })

/** El plan del primer paso aceptado (si existe). */
export function useFirstStepPlan() {
  const rec = useRecommendation()
  const id = rec.data?.firstStepPlan?.id
  const plan = useQuery({ queryKey: keys.plan(id ?? 'none'), queryFn: () => api.plan(id!), enabled: Boolean(id) })
  return { rec, plan, planId: id }
}

export function useSavings(planId?: string, enabled = true) {
  // Siempre fresco al entrar: el servidor decide si mostrar el aviso grande (primera vez) o solo "Último cambio".
  return useQuery({ queryKey: keys.savings(planId ?? 'none'), queryFn: () => api.savings(planId!), enabled: Boolean(planId) && enabled, refetchOnMount: 'always' })
}

/** Cualquier cambio de facturas o plan puede mover la recomendación y el ahorro: refrescamos todo lo derivado. */
function useInvalidateAll() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ predicate: (q) => q.queryKey[0] !== 'business' })
}

export function useStartPlan() {
  const invalidate = useInvalidateAll()
  return useMutation({ mutationFn: (v: { ecoId: string; recommendationId: string }) => api.startPlan(v.ecoId, v.recommendationId), onSuccess: invalidate })
}

export function useSetStep(planId?: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { index: number; done: boolean }) => api.setStep(planId!, v.index, v.done),
    onSuccess: (plan) => qc.setQueryData(keys.plan(plan.id), plan),
  })
}

export function useCompletePlan(planId?: string) {
  const invalidate = useInvalidateAll()
  return useMutation({
    mutationFn: (v: { completedAt: string; scale?: number; text?: string }) => api.completePlan(planId!, v.completedAt, v.scale, v.text),
    onSuccess: invalidate,
  })
}

export function useAddBill() {
  const invalidate = useInvalidateAll()
  return useMutation({ mutationFn: (input: BillInput) => api.addBill(input), onSuccess: invalidate })
}

export function useUpdateBill() {
  const invalidate = useInvalidateAll()
  return useMutation({ mutationFn: (v: { id: string; input: Partial<BillInput> }) => api.updateBill(v.id, v.input), onSuccess: invalidate })
}

export function useDeleteBill() {
  const invalidate = useInvalidateAll()
  return useMutation({ mutationFn: (id: string) => api.deleteBill(id), onSuccess: invalidate })
}

export function useResetDemo() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: api.resetDemo, onSuccess: () => qc.resetQueries() })
}

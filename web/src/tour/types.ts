import type { LucideIcon } from 'lucide-react'
import type { api } from '@/lib/api'

/** CSS selector, o "el elemento más chico que contiene este texto" (opcionalmente subiendo hasta `closest`). */
export type Target = string | { text: string; selector?: string; closest?: string }

export interface TourCtx {
  sleep(ms: number): Promise<void>
  find(t: Target): HTMLElement | null
  waitFor(t: Target, timeoutMs?: number): Promise<HTMLElement>
  /** Resalta, hace scroll y toca el elemento, como lo haría una persona. */
  click(t: Target): Promise<void>
  /** Escribe letra por letra (o de una, para fechas). */
  type(t: Target, value: string): Promise<void>
  goTab(label: 'Mi paso' | 'Mi ahorro' | 'Facturas'): Promise<void>
  closeDrawer(): Promise<void>
  /** Verifica que el texto aparezca en pantalla (espera hasta 6 s). Si no aparece, el paso falla. */
  expectText(text: string, opts?: { timeoutMs?: number }): Promise<void>
  /** Verificación libre (por ejemplo, de algo que pasa por detrás). */
  check(label: string, ok: boolean): void
  highlight(t: Target | null): void
  reset(): Promise<void>
  refresh(): Promise<void>
  setAiDown(v: boolean): void
  setOffline(v: boolean): void
  /** Cambia entre la app de Inés y la vista de aliados. */
  setView(v: 'owner' | 'allies'): Promise<void>
  /** Adjunta un archivo (foto) a un input type=file, como si la persona lo eligiera. */
  attachFile(t: Target, fileName: string): Promise<void>
  /** GET/POST a la API "por detrás", para mostrar lo que no se ve en pantalla. */
  backstage<T = unknown>(path: string, body?: unknown): Promise<T>
  api: typeof api
}

export interface TourStep {
  title: string
  /** Qué pasa y por qué, en lenguaje simple. */
  explain: string
  /** Qué caso de la especificación cubre. */
  covers?: string
  run(ctx: TourCtx): Promise<void>
}

export interface Tour {
  id: string
  title: string
  subtitle: string
  icon: LucideIcon
  steps: TourStep[]
}

export type StepStatus = 'pending' | 'running' | 'ok' | 'fail'

export interface StepResult {
  status: StepStatus
  checks: { label: string; ok: boolean }[]
  error?: string
}

// Contratos de la API (subset que usa la pantalla de la dueña).

export type Level = 'BAJA' | 'MEDIA' | 'ALTA'

export interface Business {
  id: string
  name: string
  ownerName: string
  country: string
  city: string
  currency: string
}

export interface Excluded {
  ecoId: string
  title: string
  reason: 'OTHER_CATEGORY' | 'NOT_FOR_SECTOR' | 'ALREADY_COMPLETED' | 'ALREADY_IN_PLAN' | 'OVER_BUDGET' | 'OVER_TIME'
}

export interface Recommendation {
  rulesVersion: string
  recommended: { ecoId: string; title: string; investment: Level; complexity: Level } | null
  reasons: { code: string; loads?: string[] }[]
  alternatives: { ecoId: string; title: string }[]
  excluded: Excluded[]
  stalledPlans: { planId: string; title: string; weeksWithoutProgress: number }[]
  measurement: { needsBaseline: boolean; billsAvailable: number; billsNeeded: number }
}

export interface RecommendationResponse {
  recommendationId: string
  firstStepPlan: { id: string; ecoId: string; title: string; status: string } | null
  recommendation: Recommendation
  explanation: { headline: string; bullets: string[]; stalledNote?: string; beforeYouStart?: string; next?: string }
}

export interface PlanStep {
  title: string
  status: 'not_started' | 'completed'
  subSteps: string[]
}

export interface Plan {
  id: string
  ecoCardOrigin: string
  title: string
  status: string
  startedAt?: string
  completedAt?: string
  steps: PlanStep[]
}

export interface Bill {
  id: string
  kwhConsumed: number
  costPerKwh: number
  billingStartDate: string
  billingEndDate: string
  uploadedFiles?: string[]
  days: number
  totalCost: number
  kwhPerDay: number
  /** kg de CO₂ equivalente (anexo: la factura "agrega co2Equivalent") */
  co2Equivalent?: number | null
  photoStatus?: 'none' | 'readable' | 'unreadable'
  updatedAt?: string
}

export interface BillChange {
  billId: string
  kind: 'created' | 'edited' | 'deleted'
  at: string
  text: string
}

export interface BillComparison {
  from: string
  to: string
  naiveSaving: number
  daysDifference: number
  kwhPerDayChangePct: number
  verdict: 'NAIVE_SAVING_IS_MISLEADING' | 'SAVING_HIDDEN_BY_TARIFF_OR_DAYS' | 'CONSISTENT'
}

export interface BillsResponse {
  currency: string
  bills: Bill[]
  comparisons: BillComparison[]
  corrections: BillChange[]
}

export type SavingsStatus = 'INSUFFICIENT_BASELINE' | 'WAITING_POST_DATA' | 'INCONCLUSIVE' | 'MEASURED' | 'INCREASED'

export interface Measurement {
  status: SavingsStatus
  inputsHash: string
  periods: { baseline: string[]; post: string[]; excludedTransition: string[] }
  limitations: { code: string; detail: string }[]
  baseline?: { kwhPerDay: number; naturalVariationPct: number }
  post?: { kwhPerDay: number }
  savings?: {
    kwhPerDay: number
    pct: number
    pctRange: [number, number]
    kwhPerMonth: number
    currentTariff: number
    moneyPerMonthAtCurrentTariff: number
    moneyPerMonthRange: [number, number]
    moneyAccumulatedSinceCompletion: number
  }
  tariffEffect?: { changePct: number; naiveMoneyPerMonth: number }
  co2AvoidedKgPerMonth?: number | null
  need?: { baselineBills?: number; postBills?: number }
}

export interface SavingsResponse {
  planId: string
  measurement: Measurement
  explanation: {
    headline: string
    detail: string
    baseline?: string
    tariffNote?: string
    updateNote?: string
    howWeMeasured?: string
  }
  previous: { status: SavingsStatus; changeKind: 'NEW_BILLS' | 'EDITED_OR_DELETED' } | null
  lastCorrection: BillChange | null
}

export interface AllyRow {
  businessRef: string
  ecoId: string
  status: SavingsStatus
  measured: boolean
  declaredImpact: number | null
  savingsPct: number | null
  savingsPctRange: [number, number] | null
  kwhPerMonth: number | null
  evidence: 'photo' | 'partial' | 'none'
  country: string
  methodVersion: string
}

export interface AlliesReport {
  generatedAt: string
  summary: {
    businessesTracked: number
    measuredBusinesses: number
    minBusinessesToPublish: number
    published: boolean
    medianSavingsPct?: number
    totalKwhSavedPerMonth?: number
    method?: string
    reason?: string
    byStatus: Record<string, number>
  }
  program: {
    funnel: {
      chose: number
      completed: number
      withBeforeAfter: number
      measured: number
      per10: { completed: number; withBeforeAfter: number; measured: number }
      baselinePer10: { completed: number; withBeforeAfter: number; measured: number | null }
    }
    goal90Days: { measuredWithin90: number; measured: number; note: string }
    measuredVsDeclared: { declared: number; measured: number; declaredButNotMeasured: number }
    totals: { published: boolean; kwhSavedPerMonth: number | null; co2AvoidedKgPerMonth: number | null }
  }
  rows: AllyRow[]
}

export interface SubTasksResponse {
  source: 'ai' | 'static'
  reason?: 'NO_QUOTA' | 'AI_UNAVAILABLE'
  retryable?: boolean
  message?: string
  steps: { _id: string; title?: string; subSteps: string[] }[]
}

export interface BillInput {
  kwhConsumed: number
  costPerKwh: number
  billingStartDate: string
  billingEndDate: string
  uploadedFiles: string[]
}

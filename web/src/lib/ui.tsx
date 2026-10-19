import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Bill } from './types'

export type Tab = 'step' | 'savings' | 'bills'
/** Quién mira: la dueña (app de Inés) o los aliados que financian el programa. */
export type View = 'owner' | 'allies'

interface UiState {
  tab: Tab
  setTab: (t: Tab) => void
  billForm: { open: boolean; bill?: Bill }
  openBillForm: (bill?: Bill) => void
  closeBillForm: () => void
  aiDown: boolean
  setAiDown: (v: boolean) => void
  view: View
  setView: (v: View) => void
}

const Ctx = createContext<UiState | null>(null)

const readTab = (): Tab => {
  try {
    const t = localStorage.getItem('kamai-tab')
    return t === 'savings' || t === 'bills' ? t : 'step'
  } catch {
    return 'step'
  }
}

export function UiProvider({ children }: { children: ReactNode }) {
  const [tab, setTabState] = useState<Tab>(readTab)
  const [billForm, setBillForm] = useState<{ open: boolean; bill?: Bill }>({ open: false })
  const [aiDown, setAiDown] = useState(false)
  // ?aliados en la URL abre directamente la vista para aliados.
  const [view, setViewState] = useState<View>(() => (new URLSearchParams(window.location.search).has('aliados') ? 'allies' : 'owner'))
  const setView = useCallback((v: View) => {
    setViewState(v)
    const params = new URLSearchParams(window.location.search)
    if (v === 'allies') params.set('aliados', '')
    else params.delete('aliados')
    const q = params.toString().replace(/=(&|$)/g, '$1') // "?recorridos&aliados", sin "=" vacíos
    window.history.replaceState(null, '', window.location.pathname + (q ? `?${q}` : ''))
    window.scrollTo({ top: 0 })
  }, [])

  const setTab = useCallback((t: Tab) => {
    setTabState(t)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem('kamai-tab', tab)
    } catch {
      /* sin almacenamiento: no pasa nada */
    }
  }, [tab])

  return (
    <Ctx.Provider
      value={{
        tab,
        setTab,
        billForm,
        openBillForm: (bill) => setBillForm({ open: true, bill }),
        closeBillForm: () => setBillForm((s) => ({ ...s, open: false })),
        aiDown,
        setAiDown,
        view,
        setView,
      }}
    >
      {children}
    </Ctx.Provider>
  )
}

export function useUi() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useUi fuera de UiProvider')
  return v
}

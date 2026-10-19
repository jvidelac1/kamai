import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useUi } from '@/lib/ui'
import type { StepResult, Target, Tour, TourCtx } from './types'

class CheckFailed extends Error {}

const NBSP = String.fromCharCode(160)
const norm = (s: string) => s.split(NBSP).join(' ').replace(/\s+/g, ' ')
const visible = (el: Element) => {
  const r = el.getBoundingClientRect()
  return r.width > 0 && r.height > 0
}

export type Speed = 'lento' | 'normal' | 'rapido'
const SPEED: Record<Speed, number> = { lento: 1.7, normal: 1, rapido: 0.45 }

interface TourState {
  tour: Tour | null
  index: number
  results: StepResult[]
  running: boolean
  paused: boolean
  manual: boolean
  finished: boolean
  speed: Speed
  target: Element | null
  start(t: Tour): void
  stop(): void
  togglePause(): void
  next(): void
  setManual(v: boolean): void
  setSpeed(s: Speed): void
}

const Ctx = createContext<TourState | null>(null)

export function TourProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient()
  const ui = useUi()
  const [tour, setTour] = useState<Tour | null>(null)
  const [index, setIndex] = useState(0)
  const [results, setResults] = useState<StepResult[]>([])
  const [running, setRunning] = useState(false)
  const [paused, setPaused] = useState(false)
  const [manual, setManualState] = useState(false)
  const [finished, setFinished] = useState(false)
  const [speed, setSpeedState] = useState<Speed>('normal')
  const [target, setTarget] = useState<Element | null>(null)

  const stopped = useRef(false)
  const pausedRef = useRef(false)
  const manualRef = useRef(false)
  const speedRef = useRef(1)
  const resume = useRef<(() => void) | null>(null)
  const realFetch = useRef<typeof fetch | null>(null)
  const uiRef = useRef(ui)
  uiRef.current = ui

  const patchResult = (i: number, f: (r: StepResult) => StepResult) => setResults((rs) => rs.map((r, k) => (k === i ? f(r) : r)))

  const setOffline = (v: boolean) => {
    if (v) {
      if (!realFetch.current) realFetch.current = window.fetch
      window.fetch = () => Promise.reject(new TypeError('Failed to fetch'))
      Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false })
      window.dispatchEvent(new Event('offline'))
    } else if (realFetch.current) {
      window.fetch = realFetch.current
      realFetch.current = null
      delete (navigator as unknown as Record<string, unknown>).onLine
      window.dispatchEvent(new Event('online'))
    }
  }

  const cleanup = () => {
    setOffline(false)
    uiRef.current.setAiDown(false)
    setTarget(null)
  }

  const buildCtx = (stepIndex: number): TourCtx => {
    const sleep = (ms: number) =>
      new Promise<void>((resolve, reject) => {
        setTimeout(() => (stopped.current ? reject(new Error('stopped')) : resolve()), ms * speedRef.current)
      })
    const find = (t: Target): HTMLElement | null => {
      if (typeof t === 'string') {
        const els = [...document.querySelectorAll<HTMLElement>(t)].filter(visible)
        return els.at(-1) ?? null // el último suele ser el de la capa de arriba (drawer)
      }
      const cands = [...document.querySelectorAll<HTMLElement>(t.selector ?? 'button, a, label, h1, h2, h3, p, span, li')]
        .filter(visible)
        .filter((el) => norm(el.textContent ?? '').includes(norm(t.text)))
      cands.sort((a, b) => (a.textContent?.length ?? 0) - (b.textContent?.length ?? 0))
      const el = cands[0] ?? null
      return el && t.closest ? (el.closest<HTMLElement>(t.closest) ?? el) : el
    }
    const waitFor = async (t: Target, timeoutMs = 6000) => {
      const end = Date.now() + timeoutMs
      for (;;) {
        if (stopped.current) throw new Error('stopped')
        const el = find(t)
        if (el) return el
        if (Date.now() > end) throw new CheckFailed(`No encontré ${typeof t === 'string' ? t : `“${t.text}”`} en pantalla`)
        await new Promise((r) => setTimeout(r, 100))
      }
    }
    const highlight = (t: Target | null) => {
      const el = t ? find(t) : null
      el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      setTarget(el)
    }
    const check = (label: string, ok: boolean) => {
      patchResult(stepIndex, (r) => ({ ...r, checks: [...r.checks, { label, ok }] }))
      if (!ok) throw new CheckFailed(label)
    }
    const setVal = (el: HTMLInputElement, v: string) => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, v)
      el.dispatchEvent(new Event('input', { bubbles: true }))
    }
    return {
      sleep,
      find,
      waitFor,
      highlight,
      check,
      api,
      async click(t) {
        const el = await waitFor(t)
        el.scrollIntoView({ block: 'center', behavior: 'smooth' })
        setTarget(el)
        await sleep(650)
        el.click()
        await sleep(350)
      },
      async type(t, value) {
        const el = (await waitFor(t)) as HTMLInputElement
        el.scrollIntoView({ block: 'center', behavior: 'smooth' })
        setTarget(el)
        await sleep(300)
        el.focus()
        if (el.type === 'date') setVal(el, value)
        else {
          setVal(el, '')
          for (let i = 1; i <= value.length; i++) {
            setVal(el, value.slice(0, i))
            await sleep(70)
          }
        }
        await sleep(300)
      },
      async goTab(label) {
        const btn = [...document.querySelectorAll<HTMLElement>('nav button')].find((b) => b.textContent?.includes(label))
        if (!btn) throw new CheckFailed(`No encontré la pestaña ${label}`)
        setTarget(btn)
        await sleep(500)
        btn.click()
        await sleep(700)
      },
      async closeDrawer() {
        const open = () => document.querySelector('[data-slot="drawer-content"][data-state="open"]')
        if (!open()) return
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
        const end = Date.now() + 2000
        while (open() && Date.now() < end) await new Promise((r) => setTimeout(r, 100))
        await sleep(400)
      },
      async expectText(text, opts) {
        const end = Date.now() + (opts?.timeoutMs ?? 6000)
        for (;;) {
          if (stopped.current) throw new Error('stopped')
          if (norm(document.body.innerText).includes(norm(text))) return check(`Aparece: “${text}”`, true)
          if (Date.now() > end) return check(`Aparece: “${text}”`, false)
          await new Promise((r) => setTimeout(r, 120))
        }
      },
      async reset() {
        setOffline(false)
        uiRef.current.setAiDown(false)
        await api.resetDemo()
        try {
          localStorage.removeItem('kamai-tab')
        } catch {
          /* sin almacenamiento */
        }
        await qc.resetQueries()
        uiRef.current.closeBillForm()
        uiRef.current.setView('owner')
        uiRef.current.setTab('step')
        await sleep(600)
      },
      async refresh() {
        await qc.invalidateQueries()
        await sleep(500)
      },
      setAiDown: (v) => uiRef.current.setAiDown(v),
      setOffline,
      async setView(v) {
        uiRef.current.closeBillForm()
        uiRef.current.setView(v)
        await sleep(900)
      },
      async attachFile(t, fileName) {
        const input = (await waitFor(t)) as HTMLInputElement
        const label = input.closest('label') ?? input
        label.scrollIntoView({ block: 'center', behavior: 'smooth' })
        setTarget(label)
        await sleep(600)
        const dt = new DataTransfer()
        dt.items.add(new File(['foto'], fileName, { type: 'image/jpeg' }))
        input.files = dt.files
        input.dispatchEvent(new Event('change', { bubbles: true }))
        await sleep(500)
      },
      async backstage(path, body) {
        const res = await fetch(path, body === undefined ? undefined : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
        return res.json()
      },
    }
  }

  const waitTurn = async (readMs: number) => {
    // Pausa o modo paso a paso: esperamos a que la persona toque "Seguir"/"Siguiente".
    if (manualRef.current || pausedRef.current) {
      await new Promise<void>((r) => (resume.current = r))
      resume.current = null
      return
    }
    const end = Date.now() + readMs * speedRef.current
    while (Date.now() < end) {
      if (stopped.current) return
      if (pausedRef.current || manualRef.current) {
        await new Promise<void>((r) => (resume.current = r))
        resume.current = null
        return
      }
      await new Promise((r) => setTimeout(r, 100))
    }
  }

  const start = useCallback(
    async (t: Tour) => {
      stopped.current = false
      pausedRef.current = false
      setPaused(false)
      setFinished(false)
      setTour(t)
      setIndex(0)
      setResults(t.steps.map(() => ({ status: 'pending', checks: [] })))
      setRunning(true)
      await new Promise((r) => setTimeout(r, 300))
      for (let i = 0; i < t.steps.length; i++) {
        if (stopped.current) break
        setIndex(i)
        patchResult(i, (r) => ({ ...r, status: 'running' }))
        try {
          await t.steps[i].run(buildCtx(i))
          patchResult(i, (r) => ({ ...r, status: 'ok' }))
        } catch (e) {
          if (stopped.current) break
          patchResult(i, (r) => ({ ...r, status: 'fail', error: e instanceof Error ? e.message : String(e) }))
          pausedRef.current = true // ante un fallo, frenamos para que se vea
          setPaused(true)
        }
        setTarget(null)
        if (i < t.steps.length - 1) await waitTurn(Math.max(2200, t.steps[i].explain.length * 30))
      }
      if (!stopped.current) setFinished(true)
      setRunning(false)
      cleanup()
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  const value = useMemo<TourState>(
    () => ({
      tour,
      index,
      results,
      running,
      paused,
      manual,
      finished,
      speed,
      target,
      start,
      stop() {
        stopped.current = true
        resume.current?.()
        setTour(null)
        setRunning(false)
        cleanup()
      },
      togglePause() {
        pausedRef.current = !pausedRef.current
        setPaused(pausedRef.current)
        if (!pausedRef.current) resume.current?.()
      },
      next() {
        resume.current?.()
      },
      setManual(v) {
        manualRef.current = v
        setManualState(v)
        if (!v) resume.current?.()
      },
      setSpeed(s) {
        speedRef.current = SPEED[s]
        setSpeedState(s)
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tour, index, results, running, paused, manual, finished, speed, target, start],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useTour() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useTour fuera de TourProvider')
  return v
}

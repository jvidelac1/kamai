import { PiggyBank, ReceiptText, Sprout, type LucideIcon } from 'lucide-react'
import { useUi, type Tab } from '@/lib/ui'
import { cn } from '@/lib/utils'

const TABS: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: 'step', label: 'Mi paso', icon: Sprout },
  { id: 'savings', label: 'Mi ahorro', icon: PiggyBank },
  { id: 'bills', label: 'Facturas', icon: ReceiptText },
]

export function BottomNav() {
  const { tab, setTab } = useUi()
  return (
    <nav
      aria-label="Secciones"
      className="fixed inset-x-0 bottom-0 z-30 border-t bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      <ul className="mx-auto grid max-w-md grid-cols-3">
        {TABS.map(({ id, label, icon: Icon }) => {
          const active = tab === id
          return (
            <li key={id}>
              <button
                type="button"
                onClick={() => setTab(id)}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex h-16 w-full flex-col items-center justify-center gap-1 text-[0.8rem] font-semibold transition-colors',
                  active ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <span className={cn('flex h-7 w-14 items-center justify-center rounded-full transition-colors', active && 'bg-accent')}>
                  <Icon className="size-5" strokeWidth={active ? 2.4 : 2} />
                </span>
                {label}
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

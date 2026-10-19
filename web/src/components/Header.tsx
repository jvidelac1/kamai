import { useBusiness } from '@/lib/queries'
import { TourLauncher, toursEnabled } from '@/tour/TourLauncher'

export function Header() {
  const { data } = useBusiness()
  const firstName = data?.ownerName.split(' ')[0]
  return (
    <header style={{ top: 'var(--tour-h, 0px)' }} className="sticky z-20 -mb-1 flex items-center justify-between gap-3 bg-background/90 px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] backdrop-blur">
      <div className="min-w-0">
        <p className="text-sm text-muted-foreground">{data ? data.name : 'Kamai'}</p>
        <h1 className="truncate text-xl font-extrabold tracking-tight">{firstName ? `Hola, ${firstName}` : 'Hola'}</h1>
      </div>
      {toursEnabled() && <TourLauncher />}
    </header>
  )
}

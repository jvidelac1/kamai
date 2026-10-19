import { Header } from '@/components/Header'
import { OfflineBanner } from '@/components/OfflineBanner'
import { BottomNav } from '@/components/BottomNav'
import { BillFormDrawer } from '@/components/BillFormDrawer'
import { StepScreen } from '@/screens/StepScreen'
import { SavingsScreen } from '@/screens/SavingsScreen'
import { BillsScreen } from '@/screens/BillsScreen'
import { AlliesScreen } from '@/screens/AlliesScreen'
import { useUi } from '@/lib/ui'
import { TourPanel } from '@/tour/TourPanel'

export default function App() {
  const { tab, view } = useUi()
  if (view === 'allies')
    return (
      <>
        <AlliesScreen />
        <TourPanel />
      </>
    )
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col">
      <Header />
      <OfflineBanner />
      <main className="flex-1 px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-2">
        {tab === 'step' && <StepScreen />}
        {tab === 'savings' && <SavingsScreen />}
        {tab === 'bills' && <BillsScreen />}
      </main>
      <BottomNav />
      <BillFormDrawer />
      <TourPanel />
    </div>
  )
}

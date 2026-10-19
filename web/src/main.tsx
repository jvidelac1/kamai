import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import '@fontsource-variable/nunito/wght.css'
import './index.css'
import App from './App'
import { UiProvider } from '@/lib/ui'
import { TourProvider } from '@/tour/TourProvider'
import { Toaster } from '@/components/ui/sonner'

// Modo oscuro según el sistema (selección explícita, no inversión automática).
const media = window.matchMedia('(prefers-color-scheme: dark)')
const applyTheme = () => document.documentElement.classList.toggle('dark', media.matches)
applyTheme()
media.addEventListener('change', applyTheme)

// networkMode 'always': sin señal, intentar y fallar enseguida con un mensaje claro.
// (Por defecto React Query pausa el guardado offline y el botón quedaría en "Guardando…" sin explicación.)
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 15_000, networkMode: 'always' },
    mutations: { networkMode: 'always' },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <UiProvider>
        <TourProvider>
          <App />
          {/* Abajo, sobre la barra de navegación: arriba quedan el encabezado y el panel de los recorridos */}
          <Toaster position="bottom-center" richColors closeButton mobileOffset={{ bottom: 88 }} offset={{ bottom: 88 }} />
        </TourProvider>
      </UiProvider>
    </QueryClientProvider>
  </StrictMode>,
)

import { useEffect, useState } from 'react'
import { CloudOff } from 'lucide-react'

/** Aviso cuando el celular se queda sin señal: puede mirar, pero para guardar necesita conexión. */
export function OfflineBanner() {
  const [online, setOnline] = useState(() => navigator.onLine)
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])
  if (online) return null
  return (
    <div role="status" className="mx-4 mb-2 flex items-center gap-2 rounded-2xl bg-warn px-4 py-3 text-sm text-warn-foreground">
      <CloudOff className="size-5 shrink-0" aria-hidden />
      <span>
        <strong>Estás sin señal.</strong> Puedes mirar tus datos; para guardar algo necesitas conexión.
      </span>
    </div>
  )
}

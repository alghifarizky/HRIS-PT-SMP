// Toast — design system v1 B1 hal 2: di atas bottom nav, hilang otomatis 4 detik.
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { CircleCheck } from 'lucide-react'

const ToastContext = createContext<(pesan: string) => void>(() => {})

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ pesan: string; id: number } | null>(null)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(t)
  }, [toast])

  return (
    <ToastContext.Provider value={(pesan) => setToast({ pesan, id: Date.now() })}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-4 bottom-24 z-50 flex justify-center lg:bottom-6">
        {toast && (
          <div key={toast.id} className="flex items-center gap-3 rounded-kartu bg-teks px-4 py-3 text-[15px] text-white shadow-lg">
            <CircleCheck className="size-5 shrink-0 text-sukses-latar" aria-hidden />
            {toast.pesan}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)

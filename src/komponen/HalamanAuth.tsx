// Kerangka halaman tanpa login (masuk, lupa & atur password) — latar putih, kolom maks 440 px.
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { ChevronLeft } from 'lucide-react'

export default function HalamanAuth({ kembaliKe, children }: { kembaliKe?: string; children: ReactNode }) {
  return (
    <main className="min-h-dvh bg-permukaan">
      {kembaliKe && (
        <header className="border-b border-garis">
          <div className="mx-auto flex h-14 max-w-[440px] items-center px-2">
            <Link to={kembaliKe} aria-label="Kembali" className="fokus-ring flex size-11 items-center justify-center rounded-kontrol">
              <ChevronLeft className="size-6" aria-hidden />
            </Link>
          </div>
        </header>
      )}
      <div className={`mx-auto flex max-w-[440px] flex-col px-6 pb-8 ${kembaliKe ? 'min-h-[calc(100dvh-57px)] pt-8' : 'min-h-dvh pt-[72px]'}`}>
        {children}
      </div>
    </main>
  )
}

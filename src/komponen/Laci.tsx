// Panel samping kanan (detail log audit, B3C hal 17). <dialog> bawaan: fokus terkunci, Esc / ketuk latar = tutup.
import { useEffect, useId, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { Tombol } from './form'

/** `kaki`: isi bilah bawah pengganti tombol Tutup (mis. Tolak / Setujui di persetujuan, B3B hal 2). */
export default function Laci({ judul, subjudul, onTutup, kaki, children }: { judul: string; subjudul?: string; onTutup: () => void; kaki?: ReactNode; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null)
  const idJudul = useId()
  useEffect(() => {
    if (ref.current && !ref.current.open) ref.current.showModal()
  }, [])

  return (
    <dialog
      ref={ref}
      aria-labelledby={idJudul}
      onClose={onTutup}
      onClick={(e) => e.target === ref.current && ref.current.close()}
      className="ml-auto h-dvh max-h-dvh w-full max-w-[480px] bg-permukaan p-0 text-teks shadow-xl backdrop:bg-teks/40"
    >
      <div className="flex h-full flex-col">
        <div className="flex items-start justify-between gap-4 border-b border-garis px-6 py-4">
          <div>
            <h2 id={idJudul} className="text-[19px] leading-6 font-semibold">{judul}</h2>
            {subjudul && <p className="mt-0.5 text-sm text-teks-sekunder">{subjudul}</p>}
          </div>
          <button type="button" onClick={() => ref.current?.close()} aria-label="Tutup" className="fokus-ring -mr-2 flex size-11 shrink-0 items-center justify-center rounded-kontrol text-teks-sekunder">
            <X className="size-5" aria-hidden />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        <div className="flex justify-end gap-3 border-t border-garis px-6 py-4">
          {kaki ?? <Tombol varian="sekunder" onClick={() => ref.current?.close()}>Tutup</Tombol>}
        </div>
      </div>
    </dialog>
  )
}

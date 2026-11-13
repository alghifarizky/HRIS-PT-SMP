// Dialog tengah (layar lebar) — design system v1 B1 hal 2: maks. 440 px, fokus terkunci, Esc / ketuk latar = tutup.
// Memakai <dialog> bawaan browser; render bersyarat ({buka && <Dialog …/>}) agar isi form selalu baru.
import { useEffect, useId, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'

export default function Dialog({ judul, onTutup, children }: { judul: string; onTutup: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null)
  const idJudul = useId()

  useEffect(() => {
    if (ref.current && !ref.current.open) ref.current.showModal() // StrictMode menjalankan efek dua kali
  }, [])

  return (
    <dialog
      ref={ref}
      aria-labelledby={idJudul}
      onClose={onTutup}
      onClick={(e) => e.target === ref.current && ref.current.close()} // klik latar
      className="m-auto w-[calc(100%-32px)] max-w-[440px] rounded-kartu bg-permukaan p-0 text-teks shadow-xl backdrop:bg-teks/40"
    >
      <div className="p-6">
        <div className="flex items-start justify-between gap-4">
          <h2 id={idJudul} className="text-[19px] leading-6 font-semibold">
            {judul}
          </h2>
          <button type="button" onClick={() => ref.current?.close()} aria-label="Tutup" className="fokus-ring -mt-2 -mr-2 flex size-11 items-center justify-center rounded-kontrol text-teks-sekunder">
            <X className="size-5" aria-hidden />
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </dialog>
  )
}

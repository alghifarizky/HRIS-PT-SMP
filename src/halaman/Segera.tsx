// Placeholder menu yang belum dikerjakan — gaya empty state design system v1 (B1 hal 2).
import type { ReactNode } from 'react'
import { Hammer } from 'lucide-react'

export default function Segera({ judul, children }: { judul: string; children?: ReactNode }) {
  return (
    <div>
      <h1 className="text-[22px] leading-7 font-semibold">{judul}</h1>
      <div className="mt-6 flex flex-col items-center rounded-kartu border border-garis bg-permukaan px-6 py-10 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-latar">
          <Hammer className="size-6 text-teks-sekunder" aria-hidden />
        </div>
        <p className="mt-4 text-[17px] leading-6 font-semibold">Segera hadir</p>
        <p className="mt-1 text-[15px] leading-[22px] text-teks-sekunder">Halaman ini dikerjakan di fase berikutnya.</p>
      </div>
      {children}
    </div>
  )
}

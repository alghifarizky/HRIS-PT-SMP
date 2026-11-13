// State daftar/tabel wajib (CLAUDE.md): muat (skeleton), kosong, galat — design system v1 B1 hal 2.
import type { ReactNode } from 'react'
import { CircleAlert, Inbox } from 'lucide-react'
import { Tombol } from './form'

export function Skeleton({ baris = 4 }: { baris?: number }) {
  return (
    <div role="status" aria-label="Memuat" className="flex flex-col gap-3 p-5">
      {Array.from({ length: baris }, (_, i) => (
        <div key={i} className="h-10 animate-pulse rounded-kontrol bg-latar motion-reduce:animate-none" />
      ))}
    </div>
  )
}

export function KeadaanGalat({ judul, onCobaLagi }: { judul: string; onCobaLagi: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center px-6 py-10 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-bahaya-latar">
        <CircleAlert className="size-6 text-bahaya-ikon" aria-hidden />
      </div>
      <p className="mt-4 text-[17px] leading-6 font-semibold">{judul}</p>
      <p className="mt-1 text-[15px] text-teks-sekunder">Periksa koneksi Anda, lalu coba lagi.</p>
      <Tombol onClick={onCobaLagi} className="mt-4">
        Coba lagi
      </Tombol>
    </div>
  )
}

export function KeadaanKosong({ judul, pesan, aksi }: { judul: string; pesan: string; aksi?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-latar">
        <Inbox className="size-6 text-teks-sekunder" aria-hidden />
      </div>
      <p className="mt-4 text-[17px] leading-6 font-semibold">{judul}</p>
      <p className="mt-1 text-[15px] text-teks-sekunder">{pesan}</p>
      {aksi && <div className="mt-4">{aksi}</div>}
    </div>
  )
}

const NADA = {
  sukses: 'bg-sukses-latar text-sukses',
  peringatan: 'bg-peringatan-latar text-peringatan',
  bahaya: 'bg-bahaya-latar text-bahaya',
  info: 'bg-info-latar text-info',
  netral: 'bg-latar text-teks-sekunder',
  ungu: 'bg-ungu-latar text-ungu',
}

/** Badge status: selalu titik + label (status tidak hanya warna). */
export function Badge({ nada, children }: { nada: keyof typeof NADA; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[13px] leading-5 font-semibold whitespace-nowrap ${NADA[nada]}`}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {children}
    </span>
  )
}

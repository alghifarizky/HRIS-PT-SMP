// Isian khusus: nominal Rupiah, No. KTP tersamar, tanggal.
import { useState, type ComponentProps } from 'react'
import { CalendarDays } from 'lucide-react'
import { Input } from './form'
import { dariTanggalDb, tanggalSingkat } from '../lib/format'

const fmt = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 })

/** Ketik angka saja; tampil "Rp 4.500.000". Nilai: number, atau NaN bila kosong (agar zod menolak "wajib"). */
export function InputRupiah({ id, nilai, onUbah, onBlur, galat }: { id: string; nilai: number; onUbah: (n: number) => void; onBlur?: () => void; galat?: boolean }) {
  return (
    <Input
      id={id}
      inputMode="numeric"
      placeholder="Rp 0"
      galat={galat}
      value={Number.isFinite(nilai) ? `Rp ${fmt.format(nilai)}` : ''}
      onChange={(e) => {
        const angka = e.target.value.replace(/\D/g, '').slice(0, 12)
        onUbah(angka ? Number(angka) : NaN)
      }}
      onBlur={onBlur}
      className="tabular-nums"
    />
  )
}

/** No. KTP: tampil penuh saat diketik, tersamar "3201********0007" saat tidak fokus (EMP-06). Hanya angka, maks. 16. */
export function InputKtp({ id, nilai, onUbah, onBlur, galat }: { id: string; nilai: string; onUbah: (v: string) => void; onBlur?: () => void; galat?: boolean }) {
  const [fokus, setFokus] = useState(false)
  const tampil = !fokus && nilai.length === 16 ? `${nilai.slice(0, 4)}********${nilai.slice(-4)}` : nilai
  return (
    <Input
      id={id}
      inputMode="numeric"
      autoComplete="off"
      placeholder="16 digit angka"
      galat={galat}
      value={tampil}
      onFocus={() => setFokus(true)}
      onBlur={() => {
        setFokus(false)
        onBlur?.()
      }}
      onChange={(e) => fokus && onUbah(e.target.value.replace(/\D/g, '').slice(0, 16))}
      className="tabular-nums"
    />
  )
}

/** Tanggal tampil "Kam, 24 Des 2026" (desain B1 hal 29/36). Input date bawaan transparan di atasnya membuka pemilih
 *  tanggal HP; tanpa lebar bawaannya (iOS) yang dulu membuat isian meluber keluar layar. Cocok dengan register() RHF. */
export function InputTanggal({ nilai, galat, ...p }: ComponentProps<'input'> & { nilai: string; galat?: boolean }) {
  return (
    <div className={`relative flex h-12 min-w-0 items-center gap-2 rounded-kontrol border bg-permukaan px-4 text-[15px] has-focus-visible:ring-2 has-focus-visible:ring-primer lg:h-11 ${galat ? 'border-bahaya-ikon' : 'border-garis'}`}>
      <span className={`min-w-0 flex-1 truncate ${nilai ? '' : 'text-teks-3'}`}>{nilai ? tanggalSingkat(dariTanggalDb(nilai)) : 'Pilih tanggal'}</span>
      <CalendarDays className="size-5 shrink-0 text-teks-sekunder" aria-hidden />
      <input
        type="date"
        aria-invalid={galat || undefined}
        aria-describedby={galat && p.id ? `${p.id}-galat` : undefined}
        onClick={(e) => e.currentTarget.showPicker?.()} // desktop: buka kalender, bukan hanya fokus segmen
        className="absolute inset-0 size-full cursor-pointer appearance-none opacity-0"
        {...p}
      />
    </div>
  )
}

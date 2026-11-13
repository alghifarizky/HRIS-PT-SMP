// Isian khusus: nominal Rupiah & No. KTP tersamar.
import { useState } from 'react'
import { Input } from './form'

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

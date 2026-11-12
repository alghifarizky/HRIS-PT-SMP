import { useState } from 'react'
import { sapaan, tanggalPanjang } from '../lib/format'

/** "Selamat pagi, Rina" + "Kamis, 12 Nov 2026" — H1 22/28 600 (design system v1). */
export default function Sapaan({ nama }: { nama: string }) {
  const [sekarang] = useState(() => new Date())
  return (
    <div>
      <h1 className="text-[22px] leading-7 font-semibold">
        {sapaan(sekarang)}, {nama.split(' ')[0]}
      </h1>
      <p className="mt-1 text-[15px] leading-[22px] text-teks-sekunder">{tanggalPanjang(sekarang)}</p>
    </div>
  )
}

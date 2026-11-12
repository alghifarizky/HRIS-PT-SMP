// Placeholder setelah login (AUTH-04/05) — diganti layout per peran di langkah berikutnya.
import { supabase } from '../lib/supabase'
import type { Profil } from '../auth/sesi'

const LABEL_PERAN = { karyawan: 'Karyawan', atasan: 'Atasan', hr: 'HR', direksi: 'Direksi' } as const

export default function BerandaSementara({ profil }: { profil: Profil }) {
  return (
    <main className="mx-auto max-w-[440px] px-4 py-8">
      <h1 className="text-[22px] leading-7 font-semibold">Halo, {profil.nama}</h1>
      <p className="mt-1 text-[15px] text-teks-sekunder">Peran: {LABEL_PERAN[profil.role]}</p>
      <button
        type="button"
        onClick={() => supabase.auth.signOut()}
        className="fokus-ring mt-6 h-12 w-full rounded-kontrol border border-garis bg-permukaan font-semibold"
      >
        Keluar
      </button>
    </main>
  )
}

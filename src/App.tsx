import type { ReactNode } from 'react'
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router'
import { supabase } from './lib/supabase'
import { useProfil, useSesi } from './auth/sesi'
import Masuk from './halaman/Masuk'
import LupaPassword from './halaman/LupaPassword'
import AturPassword from './halaman/AturPassword'
import BerandaSementara from './halaman/BerandaSementara'

// Route guard hanya untuk UX — keamanan sebenarnya di RLS.
function HanyaTamu({ children }: { children: ReactNode }) {
  const sesi = useSesi()
  if (sesi === undefined) return <LayarMemuat />
  return sesi ? <Navigate to="/" replace /> : children
}

function WajibMasuk() {
  const sesi = useSesi()
  const profil = useProfil()
  if (sesi === undefined || (sesi && profil.isPending)) return <LayarMemuat />
  if (!sesi) return <Navigate to="/masuk" replace />
  if (profil.isError) return <LayarPesan judul="Data akun gagal dimuat" pesan="Periksa koneksi internet Anda, lalu coba lagi." aksi="Coba lagi" onAksi={() => profil.refetch()} />
  if (!profil.data)
    return <LayarPesan judul="Akun tidak aktif" pesan="Akun Anda belum terdaftar atau sudah dinonaktifkan. Hubungi HR." aksi="Keluar" onAksi={() => supabase.auth.signOut()} />
  return <BerandaSementara profil={profil.data} />
}

const router = createBrowserRouter([
  { path: '/masuk', element: <HanyaTamu><Masuk /></HanyaTamu> },
  { path: '/lupa-password', element: <HanyaTamu><LupaPassword /></HanyaTamu> },
  // Terbuka untuk tamu maupun yang sudah login: link email membuat sesi sebelum halaman tampil
  { path: '/atur-password', element: <AturPassword /> },
  { path: '/', element: <WajibMasuk /> },
  { path: '*', element: <Navigate to="/" replace /> },
])

export default function App() {
  return <RouterProvider router={router} />
}

function LayarMemuat() {
  return (
    <div className="flex min-h-dvh items-center justify-center" role="status" aria-label="Memuat">
      <span className="size-8 animate-spin rounded-full border-[3px] border-primer-100 border-t-primer" />
    </div>
  )
}

function LayarPesan(p: { judul: string; pesan: string; aksi: string; onAksi: () => void }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-[440px] flex-col items-center justify-center px-6 text-center">
      <h1 className="text-[17px] leading-6 font-semibold">{p.judul}</h1>
      <p className="mt-2 text-[15px] text-teks-sekunder">{p.pesan}</p>
      <button type="button" onClick={p.onAksi} className="fokus-ring mt-6 h-12 rounded-kontrol bg-primer px-6 font-semibold text-white">
        {p.aksi}
      </button>
    </main>
  )
}

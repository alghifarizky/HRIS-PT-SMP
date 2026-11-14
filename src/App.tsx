import { lazy, Suspense, type ComponentType, type ReactNode } from 'react'
import { createBrowserRouter, Navigate, Outlet, RouterProvider, useRouteError, type RouteObject } from 'react-router'
import { supabase } from './lib/supabase'
import { useProfil, useSesi, type Peran } from './auth/sesi'
import { AKSES, halamanAwal } from './navigasi'
import Segera from './halaman/Segera'
import Beranda from './halaman/Beranda'
import { Skeleton } from './komponen/keadaan'

/** Halaman yang sudah dikerjakan; selainnya "Segera hadir". */
const HALAMAN: Record<string, ComponentType> = {
  '/beranda': Beranda,
  '/panel': Beranda,
  '/panel/master-data': lazy(() => import('./halaman/master-data/MasterData')),
  '/panel/karyawan': lazy(() => import('./halaman/karyawan/DaftarKaryawan')),
  '/panel/karyawan/tambah': lazy(() => import('./halaman/karyawan/TambahKaryawan')),
  '/panel/karyawan/:id/edit': lazy(() => import('./halaman/karyawan/EditKaryawan')),
  '/panel/karyawan/:id': lazy(() => import('./halaman/karyawan/DetailKaryawan')),
  '/panel/log-audit': lazy(() => import('./halaman/log-audit/LogAudit')),
  '/profil': lazy(() => import('./halaman/profil/ProfilSaya')),
  '/panel/profil': lazy(() => import('./halaman/profil/ProfilSaya')),
  '/ganti-password': lazy(() => import('./halaman/profil/GantiPassword')),
  '/clock': lazy(() => import('./halaman/absensi/ClockKamera')),
  '/absensi': lazy(() => import('./halaman/absensi/RiwayatAbsensi')),
  '/absensi/:tanggal': lazy(() => import('./halaman/absensi/DetailAbsensi')),
}

// Route guard hanya untuk UX — keamanan sebenarnya di RLS.
function HanyaTamu() {
  const sesi = useSesi()
  if (sesi === undefined) return <LayarMemuat />
  return sesi ? <Navigate to="/" replace /> : <Outlet />
}

function WajibMasuk() {
  const sesi = useSesi()
  const profil = useProfil()
  if (sesi === undefined || (sesi && profil.isPending)) return <LayarMemuat />
  if (!sesi) return <Navigate to="/masuk" replace />
  if (profil.isError) return <LayarPesan judul="Data akun gagal dimuat" pesan="Periksa koneksi internet Anda, lalu coba lagi." aksi="Coba lagi" onAksi={() => profil.refetch()} />
  if (!profil.data)
    return <LayarPesan judul="Akun tidak aktif" pesan="Akun Anda belum terdaftar atau sudah dinonaktifkan. Hubungi HR." aksi="Keluar" onAksi={() => supabase.auth.signOut()} />
  return <Outlet />
}

function HanyaPeran({ peran, children }: { peran: Peran[]; children: ReactNode }) {
  const role = useProfil().data!.role
  return peran.includes(role) ? children : <Navigate to={halamanAwal(role)} replace />
}

function KeHalamanAwal() {
  return <Navigate to={halamanAwal(useProfil().data!.role)} replace />
}

const lazyHalaman = (muat: () => Promise<{ default: ComponentType }>) => async () => ({ Component: (await muat()).default })

function halaman(ke: string, label: string) {
  const Halaman = HALAMAN[ke]
  if (Halaman) return <Halaman />
  return <Segera judul={label} />
}

/** Satu rute per halaman di AKSES. */
const ruteDari = (pilih: (ke: string) => boolean): RouteObject[] =>
  Object.entries(AKSES)
    .filter(([ke]) => pilih(ke))
    .map(([ke, { label, peran }]) => ({
      path: ke,
      element: (
        <HanyaPeran peran={peran}>
          <Suspense fallback={<Skeleton />}>{halaman(ke, label)}</Suspense>
        </HanyaPeran>
      ),
    }))

const router = createBrowserRouter([
  {
    errorElement: <LayarGalat />,
    children: [
  {
    element: <HanyaTamu />,
    children: [
      { path: '/masuk', lazy: lazyHalaman(() => import('./halaman/Masuk')) },
      { path: '/lupa-password', lazy: lazyHalaman(() => import('./halaman/LupaPassword')) },
    ],
  },
  // Terbuka untuk tamu maupun yang sudah login: link email membawa token untuk dipakai di halaman ini
  { path: '/atur-password', lazy: lazyHalaman(() => import('./halaman/AturPassword')) },
  {
    path: '/',
    element: <WajibMasuk />,
    children: [
      { index: true, element: <KeHalamanAwal /> },
      ...ruteDari((ke) => ke === '/clock'), // layar penuh tanpa shell
      { lazy: lazyHalaman(() => import('./layout/LayoutMobile')), children: ruteDari((ke) => !ke.startsWith('/panel') && ke !== '/clock') },
      { lazy: lazyHalaman(() => import('./layout/LayoutPanel')), children: ruteDari((ke) => ke.startsWith('/panel')) },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
])

export default function App() {
  return <RouterProvider router={router} />
}

/** Pengganti layar galat teknis bawaan router bila ada error tak terduga saat render. */
function LayarGalat() {
  console.error(useRouteError())
  return (
    <LayarPesan
      judul="Terjadi kesalahan"
      pesan="Halaman ini mengalami gangguan. Muat ulang untuk mencoba lagi; bila berulang, hubungi admin aplikasi."
      aksi="Muat ulang"
      onAksi={() => window.location.reload()}
    />
  )
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

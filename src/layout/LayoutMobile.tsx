// Shell mobile: Karyawan, Atasan, dan "Akun saya" HR — desain B1 hal 10, B2 hal 1.
import { useEffect, useRef } from 'react'
import { Link, Outlet, useLocation } from 'react-router'
import { useProfil } from '../auth/sesi'
import { NAV_MOBILE } from '../navigasi'
import { BottomNav, judulMobile, TopBarMobile } from './bagian'

export default function LayoutMobile() {
  const { role } = useProfil().data!
  const { pathname } = useLocation()
  const isi = useRef<HTMLElement>(null)
  useEffect(() => isi.current?.scrollTo(0, 0), [pathname]) // area isi yang scroll — mulai dari atas tiap pindah halaman
  return (
    // Kolom setinggi layar: hanya <main> yang scroll; top bar & bottom nav diam (Safari iOS)
    <div className="flex h-dvh flex-col bg-latar">
      <TopBarMobile
        ke="/notifikasi"
        judul={judulMobile(pathname)}
        ekstra={
          // Tidak ada di desain: jalan pulang HR dari "Akun saya" ke panel
          role === 'hr' && (
            <Link to="/panel" className="fokus-ring flex min-h-11 items-center rounded-kontrol px-3 text-[15px] font-semibold text-primer">
              Panel HR
            </Link>
          )
        }
      />
      <main ref={isi} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto max-w-[480px] px-4 pt-6 pb-8">
          <Outlet />
        </div>
      </main>
      <BottomNav items={NAV_MOBILE[role] ?? []} />
    </div>
  )
}

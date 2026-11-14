// Shell mobile: Karyawan, Atasan, dan "Akun saya" HR — desain B1 hal 10, B2 hal 1.
import { Link, Outlet, useLocation } from 'react-router'
import { useProfil } from '../auth/sesi'
import { NAV_MOBILE } from '../navigasi'
import { BottomNav, judulMobile, kembaliMobile, TopBarMobile } from './bagian'

export default function LayoutMobile() {
  const { role } = useProfil().data!
  const { pathname } = useLocation()
  return (
    <div className="min-h-dvh bg-latar">
      <TopBarMobile
        ke="/notifikasi"
        judul={judulMobile(pathname)}
        kembali={kembaliMobile(pathname)}
        ekstra={
          // Tidak ada di desain: jalan pulang HR dari "Akun saya" ke panel
          role === 'hr' && (
            <Link to="/panel" className="fokus-ring flex min-h-11 items-center rounded-kontrol px-3 text-[15px] font-semibold text-primer">
              Panel HR
            </Link>
          )
        }
      />
      <main className="mx-auto max-w-[480px] px-4 pt-6 pb-28">
        <Outlet />
      </main>
      <BottomNav items={NAV_MOBILE[role] ?? []} />
    </div>
  )
}

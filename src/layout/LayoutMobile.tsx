// Shell mobile: Karyawan, Atasan, dan "Akun saya" HR — desain B1 hal 10, B2 hal 1.
import { Link, Outlet, useLocation } from 'react-router'
import { useProfil } from '../auth/sesi'
import { NAV_MOBILE } from '../navigasi'
import { BottomNav, judulMobile, kembaliMobile, TopBarMobile } from './bagian'
import { useJumlahMenungguSaya, useRealtimeNotifikasi } from '../halaman/notifikasi/data'

const LATAR_PUTIH = ['/pengajuan/lembur/ajukan', '/pengajuan/cuti/ajukan']

export default function LayoutMobile() {
  const { role } = useProfil().data!
  const { pathname } = useLocation()
  useRealtimeNotifikasi()
  const menunggu = useJumlahMenungguSaya().data
  return (
    // Form pengajuan berlatar putih (desain B1 hal 28–30, 36; revisi Al 14 Nov 2026)
    <div className={`min-h-dvh ${LATAR_PUTIH.includes(pathname) ? 'bg-permukaan' : 'bg-latar'}`}>
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
      <BottomNav items={NAV_MOBILE[role] ?? []} lencana={{ '/persetujuan': menunggu }} />
    </div>
  )
}

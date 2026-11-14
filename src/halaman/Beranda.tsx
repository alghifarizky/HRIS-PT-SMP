// Beranda (mobile) & Dashboard (panel). Kartu lain (slip, saldo, pengajuan) diisi di fase fiturnya.
import { useLocation } from 'react-router'
import { useProfil } from '../auth/sesi'
import Sapaan from '../komponen/Sapaan'
import KartuAbsensiHariIni from './absensi/KartuAbsensiHariIni'
import KartuTimHariIni from './absensi/KartuTimHariIni'

export default function Beranda() {
  const { pathname } = useLocation()
  const { nama, role } = useProfil().data!
  const mobile = pathname === '/beranda'
  return (
    <div className="flex flex-col gap-4">
      <Sapaan nama={nama} />
      {mobile && role === 'atasan' && <KartuTimHariIni />}
      {mobile && <KartuAbsensiHariIni judul={role === 'atasan' ? 'Absensi saya hari ini' : 'Absensi hari ini'} />}
    </div>
  )
}

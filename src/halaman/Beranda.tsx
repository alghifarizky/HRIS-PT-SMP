// Beranda (mobile) & Dashboard (panel). Kartu lain (slip, saldo, pengajuan) diisi di fase fiturnya.
import { useLocation } from 'react-router'
import { useProfil } from '../auth/sesi'
import Sapaan from '../komponen/Sapaan'
import KartuAbsensiHariIni from './absensi/KartuAbsensiHariIni'

export default function Beranda() {
  const { pathname } = useLocation()
  return (
    <div className="flex flex-col gap-4">
      <Sapaan nama={useProfil().data!.nama} />
      {pathname === '/beranda' && <KartuAbsensiHariIni />}
    </div>
  )
}

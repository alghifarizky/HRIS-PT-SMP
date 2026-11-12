// Beranda (mobile) & Dashboard (panel) — sementara hanya sapaan; kartu-kartu diisi di fase fiturnya.
import { useProfil } from '../auth/sesi'
import Sapaan from '../komponen/Sapaan'

export default function Beranda() {
  return <Sapaan nama={useProfil().data!.nama} />
}

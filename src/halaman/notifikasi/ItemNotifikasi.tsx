// Satu baris notifikasi (B1 hal 45, B2 hal 2, B4 hal 12/66): ikon menurut isi, titik biru + latar bila belum dibaca.
import { useNavigate } from 'react-router'
import { Check, Clock, FileText, X } from 'lucide-react'
import { useProfil } from '../../auth/sesi'
import { waktuPendek } from '../../lib/format'
import { tujuanNotifikasi, useTandaiDibaca, type Notifikasi } from './data'

function Ikon({ judul }: { judul: string }) {
  const [Svg, kelas] =
    /disetujui/i.test(judul) ? [Check, 'bg-sukses-latar text-sukses']
    : /ditolak/i.test(judul) ? [X, 'bg-bahaya-latar text-bahaya']
    : /dibatalkan/i.test(judul) ? [X, 'bg-latar text-teks-sekunder']
    : /clock out/i.test(judul) ? [Clock, 'bg-info-latar text-info']
    : /absensi/i.test(judul) ? [Clock, 'bg-ungu-latar text-ungu']
    : [FileText, 'bg-primer-100 text-primer']
  return <span className={`flex size-10 shrink-0 items-center justify-center rounded-full ${kelas}`} aria-hidden><Svg className="size-5" /></span>
}

export default function ItemNotifikasi({ n, ringkas, onPilih }: { n: Notifikasi; ringkas?: boolean; onPilih?: () => void }) {
  const saya = useProfil().data!
  const tandai = useTandaiDibaca()
  const navigate = useNavigate()
  const buka = async () => {
    if (!n.dibaca) tandai.mutate(n.id)
    onPilih?.()
    const ke = await tujuanNotifikasi(n, saya)
    if (ke) navigate(ke)
  }
  return (
    <li className={n.dibaca ? '' : 'bg-primer-50'}>
      <button type="button" onClick={buka} className="fokus-ring flex w-full gap-3 px-4 py-3 text-left hover:bg-latar">
        {!ringkas && <Ikon judul={n.judul} />}
        <span className="min-w-0 flex-1">
          <span className="flex items-start justify-between gap-2">
            <span className={`text-[15px] ${n.dibaca ? 'font-medium' : 'font-semibold'}`}>{ringkas ? n.pesan : n.judul}</span>
            {!ringkas && <span className="shrink-0 text-sm text-teks-sekunder">{waktuPendek(new Date(n.dibuat_pada))}</span>}
          </span>
          {ringkas ? <span className="block text-[13px] text-teks-sekunder">{waktuPendek(new Date(n.dibuat_pada))}</span>
            : <span className="block text-[15px] text-teks-sekunder">{n.pesan}</span>}
        </span>
        {!n.dibaca && <span className="mt-1.5 size-2.5 shrink-0 rounded-full bg-primer" aria-label="Belum dibaca" />}
      </button>
    </li>
  )
}

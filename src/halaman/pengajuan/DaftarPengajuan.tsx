// OT/LV — Daftar pengajuan sendiri (B1 hal 31 lembur, 35 cuti, 32 kosong, 33 memuat, 34 galat).
// Tab & filter status disimpan di URL agar tombol kembali dari detail mempertahankannya.
import { Link, useSearchParams } from 'react-router'
import { Clock, FileText, Plus } from 'lucide-react'
import { dariTanggalDb, tanggalPanjang } from '../../lib/format'
import { durasiJam, LABEL_JENIS_CUTI, LABEL_STATUS, NADA_STATUS, rentangTanggal, type StatusPengajuan } from '../../lib/pengajuan'
import { Badge, KeadaanGalat, KeadaanKosong, Skeleton } from '../../komponen/keadaan'
import { usePengajuanSaya, type Cuti, type JenisPengajuan, type Lembur } from './data'

const FILTER: (StatusPengajuan | 'semua')[] = ['semua', 'menunggu', 'disetujui', 'ditolak', 'dibatalkan']

export default function DaftarPengajuan() {
  const [params, setParams] = useSearchParams()
  const tab: JenisPengajuan = params.get('tab') === 'cuti' ? 'cuti' : 'lembur'
  const status = (FILTER.find((f) => f === params.get('status')) ?? 'semua')
  const atur = (ubah: { tab?: JenisPengajuan; status?: string }) => {
    const t = ubah.tab ?? tab
    const s = ubah.status ?? status
    setParams({ ...(t === 'cuti' && { tab: t }), ...(s !== 'semua' && { status: s }) }, { replace: true })
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-[22px] leading-7 font-semibold">Pengajuan</h1>
      <div role="tablist" className="-mx-4 grid grid-cols-2 border-b border-garis">
        {(['lembur', 'cuti'] as const).map((t) => (
          <button key={t} role="tab" type="button" aria-selected={tab === t} onClick={() => atur({ tab: t })}
            className={`fokus-ring -mb-px h-12 border-b-2 text-[15px] font-semibold ${tab === t ? 'border-primer text-primer' : 'border-transparent text-teks-sekunder'}`}>
            {t === 'lembur' ? 'Lembur' : 'Cuti / Sakit / Izin'}
          </button>
        ))}
      </div>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {FILTER.map((f) => (
          <button key={f} type="button" aria-pressed={status === f} onClick={() => atur({ status: f })}
            className={`fokus-ring h-9 shrink-0 rounded-full border px-4 text-[15px] font-medium ${status === f ? 'border-primer bg-primer-100 text-primer' : 'border-garis bg-permukaan'}`}>
            {f === 'semua' ? 'Semua' : LABEL_STATUS[f]}
          </button>
        ))}
      </div>
      <Link to={`/pengajuan/${tab}/ajukan`} className="fokus-ring flex h-11 w-fit items-center gap-2 rounded-full bg-primer px-5 font-semibold text-white">
        <Plus className="size-5" aria-hidden /> Ajukan
      </Link>
      {tab === 'lembur' ? <DaftarLembur status={status} /> : <DaftarCuti status={status} />}
    </div>
  )
}

function Kerangka<T extends { id: string; status: StatusPengajuan }>({ q, status, jenis, baris }: {
  q: ReturnType<typeof usePengajuanSaya>; status: StatusPengajuan | 'semua'; jenis: JenisPengajuan; baris: (x: T) => { judul: string; sub: string }
}) {
  if (q.isPending) return <div className="rounded-kartu border border-garis bg-permukaan"><Skeleton baris={5} /></div>
  if (q.isError) return <div className="rounded-kartu border border-garis bg-permukaan"><KeadaanGalat judul="Pengajuan gagal dimuat" onCobaLagi={() => q.refetch()} /></div>
  const isi = (q.data as unknown as T[]).filter((x) => status === 'semua' || x.status === status)
  const nama = jenis === 'lembur' ? 'lembur' : 'cuti, sakit, atau izin'
  if (!isi.length)
    return (
      <div className="rounded-kartu border border-garis bg-permukaan">
        {status === 'semua'
          ? <KeadaanKosong judul={`Belum ada pengajuan ${nama}`} pesan={`Pengajuan ${nama} yang Anda buat akan muncul di sini beserta statusnya.`} />
          : <KeadaanKosong judul={`Tidak ada pengajuan ${LABEL_STATUS[status].toLowerCase()}`} pesan="Pilih filter lain untuk melihat pengajuan lainnya." />}
      </div>
    )
  const Ikon = jenis === 'lembur' ? Clock : FileText
  return (
    <ul className="divide-y divide-garis overflow-hidden rounded-kartu border border-garis bg-permukaan">
      {isi.map((x) => {
        const { judul, sub } = baris(x)
        return (
          <li key={x.id}>
            <Link to={`/pengajuan/${jenis}/${x.id}`} className="fokus-ring flex min-h-16 items-center gap-3 px-4 py-3 hover:bg-latar">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-kontrol bg-primer-100 text-primer" aria-hidden><Ikon className="size-5" /></span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{judul}</span>
                <span className="block truncate text-sm text-teks-sekunder">{sub}</span>
              </span>
              <Badge nada={NADA_STATUS[x.status]}>{LABEL_STATUS[x.status]}</Badge>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

function DaftarLembur({ status }: { status: StatusPengajuan | 'semua' }) {
  return <Kerangka<Lembur> q={usePengajuanSaya('lembur')} status={status} jenis="lembur" baris={(l) => ({
    judul: tanggalPanjang(dariTanggalDb(l.tanggal)),
    sub: `${l.jam_mulai.slice(0, 5)} – ${l.jam_selesai.slice(0, 5)} · ${durasiJam(l.jam_mulai, l.jam_selesai)}`,
  })} />
}

function DaftarCuti({ status }: { status: StatusPengajuan | 'semua' }) {
  return <Kerangka<Cuti> q={usePengajuanSaya('cuti')} status={status} jenis="cuti" baris={(c) => ({
    judul: LABEL_JENIS_CUTI[c.jenis],
    sub: `${rentangTanggal(c.tanggal_mulai, c.tanggal_selesai)} · ${c.jumlah_hari} hari${c.jenis === 'cuti' ? ' kerja' : ` · ${c.alasan}`}`,
  })} />
}

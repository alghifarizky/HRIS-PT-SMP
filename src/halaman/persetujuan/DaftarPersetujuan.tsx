// APR-01, APR-03 — Persetujuan Atasan (B2 hal 4–5 menunggu, 6 riwayat, 8 kosong, 9 memuat, 10 galat).
// Tab jenis & mode Menunggu/Riwayat disimpan di URL agar kembali dari detail tetap di posisi yang sama.
import type { ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router'
import { dariTanggalDb, hariIniDb, inisial, tanggalSingkat, waktuSingkat } from '../../lib/format'
import { durasiJam, LABEL_JENIS_CUTI, LABEL_STATUS, NADA_STATUS, rentangTanggal } from '../../lib/pengajuan'
import { Badge, KeadaanGalat, KeadaanKosong, Skeleton } from '../../komponen/keadaan'
import type { Cuti, JenisPengajuan, Lembur } from '../pengajuan/data'
import { usePersetujuanTim, type Item, type Keputusan } from './data'

export default function DaftarPersetujuan() {
  const [params, setParams] = useSearchParams()
  const tab: JenisPengajuan = params.get('tab') === 'cuti' ? 'cuti' : 'lembur'
  const riwayat = params.get('mode') === 'riwayat'
  const atur = (t: JenisPengajuan, r: boolean) => setParams({ ...(t === 'cuti' && { tab: t }), ...(r && { mode: 'riwayat' }) }, { replace: true })
  const q = usePersetujuanTim()

  return (
    <div className="flex flex-col gap-4">
      <div role="tablist" aria-label="Jenis pengajuan" className="-mx-4 -mt-6 grid grid-cols-2 border-b border-garis bg-permukaan">
        {(['lembur', 'cuti'] as const).map((t) => (
          <button key={t} role="tab" type="button" aria-selected={tab === t} onClick={() => atur(t, riwayat)}
            className={`fokus-ring -mb-px h-12 border-b-2 text-[15px] font-semibold ${tab === t ? 'border-primer text-primer' : 'border-transparent text-teks-sekunder'}`}>
            {t === 'lembur' ? 'Lembur' : 'Cuti / Sakit / Izin'}
            {!!q.data?.menunggu[t].length && <span className="ml-1.5 tabular-nums">{q.data.menunggu[t].length}</span>}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-1 rounded-kartu bg-garis p-1">
        {[false, true].map((r) => (
          <button key={String(r)} type="button" aria-pressed={riwayat === r} onClick={() => atur(tab, r)}
            className={`fokus-ring h-11 rounded-kontrol text-[15px] font-semibold ${riwayat === r ? 'bg-permukaan text-teks shadow-sm' : 'text-teks-sekunder'}`}>
            {r ? 'Riwayat' : 'Menunggu'}
          </button>
        ))}
      </div>

      {q.isPending ? <div className="rounded-kartu border border-garis bg-permukaan"><Skeleton baris={5} /></div>
        : q.isError ? <div className="rounded-kartu border border-garis bg-permukaan"><KeadaanGalat judul="Persetujuan gagal dimuat" onCobaLagi={q.refetch} /></div>
        : riwayat ? <Riwayat jenis={tab} isi={q.data!.riwayat[tab]} />
        : <Menunggu jenis={tab} isi={q.data!.menunggu[tab]} />}
    </div>
  )
}

function Menunggu({ jenis, isi }: { jenis: JenisPengajuan; isi: Item<Lembur | Cuti>[] }) {
  if (!isi.length)
    return <Kosong judul="Tidak ada pengajuan yang menunggu persetujuan Anda" pesan="Pengajuan baru dari tim Anda akan muncul di sini." />
  const hariIni = hariIniDb()
  return (
    <>
      <p className="-mb-1 text-sm text-teks-sekunder">Diurutkan dari yang paling lama menunggu</p>
      <ul className="flex flex-col gap-3">
        {isi.map((x) => {
          const l = jenis === 'lembur' ? (x as Item<Lembur>) : null
          const c = jenis === 'cuti' ? (x as Item<Cuti>) : null
          const mendesak = !!l && l.tanggal === hariIni
          return (
            <Kartu key={x.id} jenis={jenis} x={x} mendesak={mendesak}
              bawah={<>
                <span>Diajukan {waktuSingkat(new Date(x.diajukan_pada))}</span>
                {l?.hari_libur && <Tanda>Hari libur</Tanda>}
                {mendesak && <Tanda>Lembur hari ini</Tanda>}
                {c?.lampiran_path && <Tanda netral>Ada lampiran</Tanda>}
              </>} />
          )
        })}
      </ul>
    </>
  )
}

function Riwayat({ jenis, isi }: { jenis: JenisPengajuan; isi: Item<(Lembur | Cuti) & Keputusan>[] }) {
  if (!isi.length) return <Kosong judul="Belum ada riwayat keputusan" pesan="Pengajuan yang sudah Anda setujui atau tolak akan muncul di sini." />
  return (
    <>
      <p className="-mb-1 text-sm text-teks-sekunder">Status pengajuan saat ini dan keputusan Anda</p>
      <ul className="flex flex-col gap-3">
        {isi.map((x) => (
          <Kartu key={x.id} jenis={jenis} x={x}
            // Badge = status pengajuan saat ini (revisi Al 14 Nov 2026): setelah Atasan setuju tetap "Menunggu persetujuan HR"
            // sampai HR memutuskan; keputusan Atasan sendiri di baris bawah.
            kanan={x.status === 'menunggu' ? <Badge nada="peringatan">Menunggu persetujuan HR</Badge>
              : x.status === 'dibatalkan' ? <Badge nada="netral">Dibatalkan pengaju</Badge>
              : <Badge nada={NADA_STATUS[x.status]}>{x.keputusan === 'ditolak' ? 'Ditolak' : `${LABEL_STATUS[x.status]} HR`}</Badge>}
            bawah={<span>Keputusan Anda: {x.keputusan === 'disetujui' ? 'disetujui' : 'ditolak'}</span>} />
        ))}
      </ul>
    </>
  )
}

function Kartu({ jenis, x, mendesak, kanan, bawah }: { jenis: JenisPengajuan; x: Item<Lembur | Cuti>; mendesak?: boolean; kanan?: ReactNode; bawah: ReactNode }) {
  const l = jenis === 'lembur' ? (x as Item<Lembur>) : null
  const c = jenis === 'cuti' ? (x as Item<Cuti>) : null
  return (
    <li>
      <Link to={`/persetujuan/${jenis}/${x.id}`}
        className={`fokus-ring flex gap-3 rounded-kartu border bg-permukaan p-4 hover:bg-latar ${mendesak ? 'border-peringatan-ikon' : 'border-garis'}`}>
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primer-100 text-sm font-semibold text-primer" aria-hidden>{inisial(x.pengaju.nama)}</span>
        <span className="min-w-0 flex-1">
          <span className="flex items-start justify-between gap-2">
            <span className="min-w-0">
              <span className="block truncate font-semibold">{x.pengaju.nama}</span>
              <span className="block truncate text-sm text-teks-sekunder">{x.pengaju.jabatan ?? '—'}</span>
            </span>
            {kanan}
          </span>
          <span className="mt-2 block font-semibold">{l ? (l.hari_libur ? 'Lembur hari libur' : 'Lembur') : LABEL_JENIS_CUTI[c!.jenis]}</span>
          <span className="block text-[15px]">
            {l ? `${tanggalSingkat(dariTanggalDb(l.tanggal))} · ${l.jam_mulai.slice(0, 5)} – ${l.jam_selesai.slice(0, 5)} · ${durasiJam(l.jam_mulai, l.jam_selesai)}`
              : `${rentangTanggal(c!.tanggal_mulai, c!.tanggal_selesai, true)} · ${c!.jumlah_hari} hari kerja`}
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-2 text-sm text-teks-sekunder">{bawah}</span>
        </span>
      </Link>
    </li>
  )
}

function Tanda({ netral, children }: { netral?: boolean; children: ReactNode }) {
  return <span className={`rounded-full px-2.5 py-0.5 text-[13px] font-semibold ${netral ? 'bg-latar text-teks-sekunder' : 'bg-peringatan-latar text-peringatan'}`}>{children}</span>
}

function Kosong({ judul, pesan }: { judul: string; pesan: string }) {
  return <div className="rounded-kartu border border-garis bg-permukaan"><KeadaanKosong judul={judul} pesan={pesan} /></div>
}

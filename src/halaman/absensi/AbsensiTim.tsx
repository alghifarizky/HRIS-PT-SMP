// ATT-08 — Absensi tim (Atasan): B2 hal 23 (hari ini), 24 (tanggal lain), 25 (libur), 26 (tanpa anggota),
// 27 (memuat), 28 (galat). Cuti/sakit/izin & lembur hari libur menyusul (Fase 4).
import { Link, useSearchParams } from 'react-router'
import { ChevronLeft, ChevronRight, CalendarOff } from 'lucide-react'
import { durasi, jamWib, susunHariTim } from '../../lib/absensi'
import { dariTanggalDb, hariIniDb, tanggalPanjang } from '../../lib/format'
import { Badge, KeadaanGalat, KeadaanKosong, Skeleton } from '../../komponen/keadaan'
import { useAbsensiTim, useAnggotaTim } from './data'
import { badgeAbsensi } from './RiwayatAbsensi'

const geser = (tgl: string, n: number) => {
  const d = new Date(`${tgl}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
const inisial = (nama: string) => nama.split(' ').slice(0, 2).map((k) => k[0]).join('').toUpperCase()

export default function AbsensiTim() {
  const hariIni = hariIniDb()
  const [params, setParams] = useSearchParams()
  // Tanggal masa depan dijepit ke hari ini di aplikasi — Safari iOS mengabaikan atribut max pada input date
  const jepit = (t: string) => (t > hariIni ? hariIni : t)
  const tanggal = jepit(params.get('tanggal') ?? hariIni)
  const pilih = (t: string) => setParams(jepit(t) === hariIni ? {} : { tanggal: jepit(t) }, { replace: true })
  const anggota = useAnggotaTim()
  const hari = useAbsensiTim(tanggal)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-[22px] leading-7 font-semibold">Absensi tim</h1>
        <Link to="/absensi" className="fokus-ring flex min-h-11 items-center rounded-kontrol px-2 text-[15px] font-semibold text-primer">
          Riwayat saya
        </Link>
      </div>

      <div className="flex items-center gap-2 rounded-kartu border border-garis bg-permukaan p-2">
        <button type="button" onClick={() => pilih(geser(tanggal, -1))} aria-label="Hari sebelumnya" className="fokus-ring flex size-11 items-center justify-center rounded-kontrol">
          <ChevronLeft className="size-5" aria-hidden />
        </button>
        <label className="flex-1 text-center">
          <span className="block text-[15px] font-semibold">
            {tanggalPanjang(dariTanggalDb(tanggal))}
            {tanggal === hariIni && <span className="font-normal text-teks-sekunder"> · Hari ini</span>}
          </span>
          <input type="date" value={tanggal} max={hariIni} onChange={(e) => e.target.value && pilih(e.target.value)} aria-label="Pilih tanggal" className="mt-1 h-9 rounded-kontrol border border-garis px-2 text-sm" />
        </label>
        <button type="button" onClick={() => pilih(geser(tanggal, 1))} disabled={tanggal >= hariIni} aria-label="Hari berikutnya" className="fokus-ring flex size-11 items-center justify-center rounded-kontrol disabled:opacity-30">
          <ChevronRight className="size-5" aria-hidden />
        </button>
      </div>

      {anggota.isPending || hari.isPending ? (
        <div className="rounded-kartu border border-garis bg-permukaan"><Skeleton baris={6} /></div>
      ) : anggota.isError || hari.isError ? (
        <div className="rounded-kartu border border-garis bg-permukaan">
          <KeadaanGalat judul="Absensi tim gagal dimuat" onCobaLagi={() => (anggota.refetch(), hari.refetch())} />
        </div>
      ) : !anggota.data.length ? (
        <div className="rounded-kartu border border-garis bg-permukaan">
          <KeadaanKosong judul="Belum ada anggota tim" pesan="Anda belum tercatat sebagai atasan langsung siapa pun. Hubungi HR bila ini keliru." />
        </div>
      ) : !hari.data.jadwal && !hari.data.absensi.length ? (
        <div className="flex flex-col items-center rounded-kartu border border-garis bg-permukaan px-6 py-10 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-latar">
            <CalendarOff className="size-6 text-teks-sekunder" aria-hidden />
          </div>
          <p className="mt-4 text-[17px] font-semibold">Hari libur</p>
          <p className="mt-1 text-[15px] text-teks-sekunder">Tidak ada jadwal kerja. Absensi hanya tercatat untuk lembur hari libur yang disetujui.</p>
        </div>
      ) : (
        <Isi anggota={anggota.data} data={hari.data} tanggal={tanggal} hariIni={hariIni} />
      )}
    </div>
  )
}

function Isi({ anggota, data, tanggal, hariIni }: { anggota: NonNullable<ReturnType<typeof useAnggotaTim>['data']>; data: NonNullable<ReturnType<typeof useAbsensiTim>['data']>; tanggal: string; hariIni: string }) {
  const r = susunHariTim({ anggota, absensi: data.absensi, tanggal, hariIni })
  const lewat = tanggal < hariIni
  return (
    <>
      <dl className="grid grid-cols-3 divide-x divide-garis rounded-kartu border border-garis bg-permukaan py-3 text-center">
        <Angka label="Hadir" nilai={`${r.hadir}/${r.jumlah}`} />
        <Angka label="Terlambat" nilai={String(r.terlambat)} warna={r.terlambat ? 'text-peringatan' : undefined} />
        <Angka label={lewat ? 'Tanpa absensi' : 'Belum clock in'} nilai={String(r.belum)} warna={r.belum && lewat ? 'text-bahaya' : undefined} />
      </dl>
      {/* shortcut: kotak "Cuti/sakit/izin · N menunggu" (desain) menyusul bersama fitur cuti (Fase 4) */}

      <ul className="divide-y divide-garis overflow-hidden rounded-kartu border border-garis bg-permukaan">
        {r.baris.map(({ anggota: a, absensi: ab, status }) => (
          <li key={a.id}>
            <Link to={`/absensi/tim/${a.id}?bulan=${tanggal.slice(0, 7)}`} className="fokus-ring flex min-h-16 items-center gap-3 px-4 py-3 hover:bg-latar">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primer-100 text-sm font-semibold text-primer" aria-hidden>{inisial(a.nama)}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{a.nama}</span>
                <span className="block truncate text-sm text-teks-sekunder">
                  {a.jabatan ?? '—'}
                  {ab && ` · ${jamWib(new Date(ab.jam_masuk))} – ${ab.jam_keluar ? `${jamWib(new Date(ab.jam_keluar))} WIB` : '… WIB'}`}
                  {ab?.jam_keluar && ` · ${durasi(new Date(ab.jam_masuk), new Date(ab.jam_keluar))}`}
                  {status === 'belum_clock_in' && ' · Belum ada catatan'}
                </span>
              </span>
              <span className="shrink-0">
                {ab ? (badgeAbsensi(ab, data.jadwal?.jam_pulang ?? null) ?? <Badge nada="sukses">Tepat waktu</Badge>)
                  : status === 'belum_clock_in' ? <Badge nada="netral">Belum clock in</Badge>
                  : <Badge nada="bahaya">Tanpa absensi</Badge>}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  )
}

function Angka({ label, nilai, warna }: { label: string; nilai: string; warna?: string }) {
  return (
    <div>
      <dd className={`text-[22px] leading-7 font-bold tabular-nums ${warna ?? ''}`}>{nilai}</dd>
      <dt className="text-sm text-teks-sekunder">{label}</dt>
    </div>
  )
}

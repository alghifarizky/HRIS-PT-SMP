// ATT-07 — Riwayat absensi (B1 hal 22 daftar, 24 kosong, 25 memuat, 26 galat). Bulan kalender.
// Hari kerja yang lewat tanpa absensi tampil "Tanpa absensi" (keputusan Al, 14 Nov 2026).
import { Link, useSearchParams } from 'react-router'
import { ChevronRight } from 'lucide-react'
import { durasi, hariIso, jamWib, menitLebihCepat, susunRiwayat } from '../../lib/absensi'
import { dariTanggalDb, hariIniDb } from '../../lib/format'
import { Badge, KeadaanGalat, KeadaanKosong, Skeleton } from '../../komponen/keadaan'
import { useRiwayatAbsensi, type BarisAbsensi, type TargetAbsensi } from './data'

const fmtBulan = new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric', timeZone: 'UTC' })
const fmtHariPendek = new Intl.DateTimeFormat('id-ID', { weekday: 'short', timeZone: 'Asia/Jakarta' })
const bulanIni = () => hariIniDb().slice(0, 7)

/** 12 bulan terakhir (terbaru dulu) sebagai "YYYY-MM". */
function pilihanBulan() {
  const [th, bl] = bulanIni().split('-').map(Number)
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(Date.UTC(th, bl - 1 - i, 1))
    return { nilai: d.toISOString().slice(0, 7), label: fmtBulan.format(d) }
  })
}

/** Satu badge per baris, urutan penting: koreksi HR > auto clock out > terlambat > lebih cepat (desain B1 hal 22). */
export function badgeAbsensi(a: BarisAbsensi, jamPulang: string | null) {
  if (a.dikoreksi_oleh) return <Badge nada="ungu">Dikoreksi HR</Badge>
  if (a.auto_clock_out) return <Badge nada="info">Auto clock out</Badge>
  if (a.terlambat) return <Badge nada="peringatan">Terlambat</Badge>
  const cepat = a.jam_keluar && jamPulang ? menitLebihCepat(new Date(a.jam_keluar), jamPulang) : 0
  return cepat > 0 ? <Badge nada="peringatan">Lebih cepat {cepat} menit</Badge> : null
}

export default function RiwayatAbsensi() {
  return <DaftarRiwayat dasar="/absensi" />
}

/** Riwayat per bulan. `target` = anggota tim (dipakai Atasan); `dasar` = awalan tautan detail harian. */
export function DaftarRiwayat({ target, dasar }: { target?: TargetAbsensi; dasar: string }) {
  const [params, setParams] = useSearchParams()
  const bulan = params.get('bulan') ?? bulanIni()
  const q = useRiwayatAbsensi(bulan, target)
  const pilihan = pilihanBulan()
  const r = q.data && susunRiwayat({ bulan, ...q.data, hariIni: hariIniDb() })
  const jamPulang = (t: string) => (q.data?.libur.has(t) ? null : (q.data?.jamPulang.get(hariIso(t)) ?? null))

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-2 text-sm font-medium">
        Bulan
        <select
          value={bulan}
          onChange={(e) => setParams(e.target.value === bulanIni() ? {} : { bulan: e.target.value }, { replace: true })}
          className="fokus-ring h-12 rounded-kontrol border border-garis bg-permukaan px-3 text-[17px] font-semibold"
        >
          {pilihan.map((b) => (
            <option key={b.nilai} value={b.nilai}>{b.label}</option>
          ))}
        </select>
      </label>

      {q.isPending ? (
        <div className="rounded-kartu border border-garis bg-permukaan"><Skeleton baris={6} /></div>
      ) : q.isError ? (
        <div className="rounded-kartu border border-garis bg-permukaan">
          <KeadaanGalat judul="Riwayat gagal dimuat" onCobaLagi={() => q.refetch()} />
        </div>
      ) : (
        <>
          <dl className="grid grid-cols-3 divide-x divide-garis rounded-kartu border border-garis bg-permukaan py-3 text-center">
            <Angka label="Hari hadir" nilai={r!.hadir} />
            <Angka label="Terlambat" nilai={r!.terlambat} warna={r!.terlambat ? 'text-peringatan' : undefined} />
            <Angka label="Auto clock out" nilai={r!.autoClockOut} />
          </dl>

          {!r!.baris.length ? (
            <div className="rounded-kartu border border-garis bg-permukaan">
              <KeadaanKosong
                judul="Belum ada absensi"
                pesan={`Tidak ada catatan absensi di ${pilihan.find((p) => p.nilai === bulan)?.label ?? bulan}. Pilih bulan lain untuk melihat riwayat.`}
              />
            </div>
          ) : (
            <ul className="divide-y divide-garis overflow-hidden rounded-kartu border border-garis bg-permukaan">
              {r!.baris.map(({ tanggal, absensi: a }) => (
                <li key={tanggal}>
                  <Baris tanggal={tanggal} a={a} jamPulang={jamPulang(tanggal)} dasar={dasar} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}

function Angka({ label, nilai, warna }: { label: string; nilai: number; warna?: string }) {
  return (
    <div>
      <dd className={`text-[22px] leading-7 font-bold tabular-nums ${warna ?? ''}`}>{nilai}</dd>
      <dt className="text-sm text-teks-sekunder">{label}</dt>
    </div>
  )
}

function Baris({ tanggal, a, jamPulang, dasar }: { tanggal: string; a: BarisAbsensi | null; jamPulang: string | null; dasar: string }) {
  const d = dariTanggalDb(tanggal)
  const isi = (
    <>
      <div className="w-10 shrink-0 text-center">
        <p className="text-xs font-semibold text-teks-sekunder uppercase">{fmtHariPendek.format(d).replace('.', '')}</p>
        <p className="text-[22px] leading-7 font-bold tabular-nums">{Number(tanggal.slice(8))}</p>
      </div>
      <div className="min-w-0 flex-1">
        {a ? (
          <>
            <p className="text-[17px] font-semibold tabular-nums">
              {jamWib(new Date(a.jam_masuk))} – {a.jam_keluar ? jamWib(new Date(a.jam_keluar)) : '…'} WIB
            </p>
            <p className="text-sm text-teks-sekunder">
              {!a.jam_keluar ? 'Sedang bekerja' : a.auto_clock_out ? 'Lupa clock out · diisi otomatis' : `Total ${durasi(new Date(a.jam_masuk), new Date(a.jam_keluar))}`}
            </p>
          </>
        ) : (
          <>
            <p className="text-[17px] font-semibold text-teks-sekunder">—</p>
            <p className="text-sm text-teks-sekunder">Tidak ada clock in</p>
          </>
        )}
      </div>
      <div className="shrink-0">{a ? badgeAbsensi(a, jamPulang) : <Badge nada="bahaya">Tanpa absensi</Badge>}</div>
      {a && <ChevronRight className="size-5 shrink-0 text-teks-3" aria-hidden />}
    </>
  )
  return a ? (
    <Link to={`${dasar}/${tanggal}`} className="fokus-ring flex min-h-16 items-center gap-4 px-4 py-3 hover:bg-latar">{isi}</Link>
  ) : (
    <div className="flex min-h-16 items-center gap-4 px-4 py-3">{isi}</div>
  )
}

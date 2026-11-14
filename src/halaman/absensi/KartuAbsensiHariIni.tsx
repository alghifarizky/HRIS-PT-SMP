// Kartu "Absensi hari ini" di Beranda — B1 hal 10 (belum), 11 (sudah masuk), 12 (lengkap), 14 (Sabtu).
// Tombol Clock In primer 56 px; Clock Out gelap (B2 hal 1). Hari libur: tanpa tombol.
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { Camera, CircleCheck } from 'lucide-react'
import { durasi, jamWib, menitLebihCepat } from '../../lib/absensi'
import { dariTanggalDb, tanggalPanjang } from '../../lib/format'
import { Badge, KeadaanGalat, Skeleton } from '../../komponen/keadaan'
import { useAbsensiHariIni } from './data'

const hhmm = (t: string) => t.slice(0, 5)

export default function KartuAbsensiHariIni({ judul = 'Absensi hari ini' }: { judul?: string }) {
  const q = useAbsensiHariIni()

  return (
    <section aria-labelledby="judul-absensi-hari-ini" className="rounded-kartu border border-garis bg-permukaan p-4">
      {q.isPending ? (
        <Skeleton baris={3} />
      ) : q.isError ? (
        <KeadaanGalat judul="Absensi hari ini gagal dimuat" onCobaLagi={() => q.refetch()} />
      ) : (
        <Isi {...q.data} judul={judul} />
      )}
    </section>
  )
}

function Isi({ absensi: a, jadwal, mulaiBekerja, judul }: NonNullable<ReturnType<typeof useAbsensiHariIni>['data']> & { judul: string }) {
  const masuk = a ? new Date(a.jam_masuk) : null
  const keluar = a?.jam_keluar ? new Date(a.jam_keluar) : null
  const cepat = keluar && jadwal ? menitLebihCepat(keluar, jadwal.jam_pulang) : 0

  if (mulaiBekerja && !a) {
    return (
      <>
        <h2 id="judul-absensi-hari-ini" className="text-[17px] leading-6 font-semibold">{judul}</h2>
        <p className="mt-2 rounded-kontrol bg-info-latar p-3 text-[15px] text-info">
          Anda mulai bekerja {tanggalPanjang(dariTanggalDb(mulaiBekerja))}. Clock in tersedia mulai tanggal itu.
        </p>
      </>
    )
  }

  return (
    <>
      <h2 id="judul-absensi-hari-ini" className="text-[17px] leading-6 font-semibold">{judul}</h2>
      <p className="mt-0.5 text-[15px] text-teks-sekunder">
        {jadwal ? `Jam kerja ${hhmm(jadwal.jam_masuk)} – ${hhmm(jadwal.jam_pulang)} WIB` : 'Hari ini libur — tidak ada jadwal kerja.'}
      </p>

      {(jadwal || a) && (
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Kotak label="Jam masuk" jam={masuk}>
            {a && (a.terlambat ? <Badge nada="peringatan">Terlambat</Badge> : <Badge nada="sukses">Tepat waktu</Badge>)}
          </Kotak>
          <Kotak label="Jam keluar" jam={keluar}>
            {a?.auto_clock_out ? <Badge nada="info">Auto clock out</Badge> : cepat > 0 ? <Badge nada="peringatan">Lebih cepat {cepat} menit</Badge> : null}
          </Kotak>
        </div>
      )}

      {jadwal && !a && (
        <Link to="/clock" className="fokus-ring mt-4 flex h-14 items-center justify-center gap-3 rounded-kontrol bg-primer text-lg font-semibold text-white hover:bg-primer-700">
          <Camera className="size-6" aria-hidden /> Clock In
        </Link>
      )}
      {a && !keluar && (
        <Link to="/clock" className="fokus-ring mt-4 flex h-14 items-center justify-center gap-3 rounded-kontrol bg-teks text-lg font-semibold text-white">
          <Camera className="size-6" aria-hidden /> Clock Out
        </Link>
      )}
      {masuk && keluar && (
        <p className="mt-4 flex items-center gap-2 rounded-kontrol bg-sukses-latar px-3 py-2.5 text-[15px] font-semibold text-sukses">
          <CircleCheck className="size-5 text-sukses-ikon" aria-hidden />
          Absensi hari ini lengkap · {durasi(masuk, keluar)}
        </p>
      )}
    </>
  )
}

function Kotak({ label, jam, children }: { label: string; jam: Date | null; children?: ReactNode }) {
  return (
    <div className="rounded-kontrol bg-latar p-3">
      <p className="text-sm text-teks-sekunder">{label}</p>
      <p className="mt-1 text-[22px] leading-7 font-bold tabular-nums">{jam ? `${jamWib(jam)} WIB` : '—'}</p>
      {children && <div className="mt-1.5">{children}</div>}
    </div>
  )
}

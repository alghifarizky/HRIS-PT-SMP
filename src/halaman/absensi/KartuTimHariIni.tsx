// Beranda Atasan — "Tim hari ini" (B2 hal 1): ringkasan absensi bawahan hari ini + tautan Absensi tim.
import { Link } from 'react-router'
import { ChevronRight } from 'lucide-react'
import { susunHariTim } from '../../lib/absensi'
import { hariIniDb } from '../../lib/format'
import { KeadaanGalat, Skeleton } from '../../komponen/keadaan'
import { useAbsensiTim, useAnggotaTim } from './data'

export default function KartuTimHariIni() {
  const hariIni = hariIniDb()
  const anggota = useAnggotaTim()
  const hari = useAbsensiTim(hariIni)
  if (anggota.data && !anggota.data.length) return null // belum punya bawahan

  return (
    <section aria-labelledby="judul-tim-hari-ini" className="rounded-kartu border border-garis bg-permukaan p-4">
      <div className="flex items-center justify-between">
        <h2 id="judul-tim-hari-ini" className="text-[17px] leading-6 font-semibold">Tim hari ini</h2>
        <Link to="/absensi/tim" className="fokus-ring -mr-2 flex min-h-11 items-center gap-1 rounded-kontrol px-2 text-[15px] font-semibold text-primer">
          Absensi tim <ChevronRight className="size-4" aria-hidden />
        </Link>
      </div>
      {anggota.isPending || hari.isPending ? (
        <Skeleton baris={1} />
      ) : anggota.isError || hari.isError ? (
        <KeadaanGalat judul="Ringkasan tim gagal dimuat" onCobaLagi={() => (anggota.refetch(), hari.refetch())} />
      ) : !hari.data.jadwal ? (
        <p className="mt-2 text-[15px] text-teks-sekunder">Hari ini libur — tidak ada jadwal kerja.</p>
      ) : (
        <Ringkas {...susunHariTim({ anggota: anggota.data, absensi: hari.data.absensi, tanggal: hariIni, hariIni })} />
      )}
    </section>
  )
}

function Ringkas({ jumlah, hadir, terlambat, belum }: { jumlah: number; hadir: number; terlambat: number; belum: number }) {
  return (
    <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
      {[
        { label: 'Hadir', nilai: `${hadir}/${jumlah}` },
        { label: 'Terlambat', nilai: String(terlambat), warna: terlambat ? 'text-peringatan' : '' },
        { label: 'Belum clock in', nilai: String(belum) },
      ].map((x) => (
        <div key={x.label} className="rounded-kontrol bg-latar py-3">
          <dd className={`text-[22px] leading-7 font-bold tabular-nums ${x.warna ?? ''}`}>{x.nilai}</dd>
          <dt className="text-sm text-teks-sekunder">{x.label}</dt>
        </div>
      ))}
    </dl>
  )
}

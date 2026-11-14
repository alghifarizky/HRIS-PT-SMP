// ATT-07 — Detail absensi satu hari (B1 hal 23 dikoreksi HR, hal 27 auto clock out).
// Foto lewat signed URL 60 detik (security §5). "Semula" & nama HR dari kolom ringkasan koreksi (trigger).
import type { ReactNode } from 'react'
import { Link, useParams } from 'react-router'
import { ChevronLeft, UserRound } from 'lucide-react'
import { durasi, jamWib, menitLebihCepat, menitTerlambat } from '../../lib/absensi'
import { dariTanggalDb, tanggalPanjang, waktuSingkat } from '../../lib/format'
import { Badge, KeadaanGalat, KeadaanKosong, Skeleton } from '../../komponen/keadaan'
import { useAbsensiTanggal, useFotoSelfie } from './data'
import { badgeAbsensi } from './RiwayatAbsensi'

export default function DetailAbsensi() {
  const tanggal = useParams().tanggal!
  const q = useAbsensiTanggal(tanggal)
  const kembali = (
    <Link to={`/absensi?bulan=${tanggal.slice(0, 7)}`} className="fokus-ring -ml-2 inline-flex min-h-11 items-center gap-1 rounded-kontrol px-2 text-[15px] font-semibold text-primer">
      <ChevronLeft className="size-5" aria-hidden /> Riwayat absensi
    </Link>
  )

  if (q.isPending) return <>{kembali}<Skeleton baris={6} /></>
  if (q.isError) return <>{kembali}<KeadaanGalat judul="Detail absensi gagal dimuat" onCobaLagi={() => q.refetch()} /></>
  const { absensi: a, jadwal } = q.data
  if (!a) return <>{kembali}<KeadaanKosong judul="Tidak ada absensi" pesan="Tidak ada catatan clock in pada tanggal ini." /></>

  const masuk = new Date(a.jam_masuk)
  const keluar = a.jam_keluar ? new Date(a.jam_keluar) : null
  const terlambat = jadwal ? menitTerlambat(masuk, jadwal.jam_masuk) : 0
  const cepat = keluar && jadwal ? menitLebihCepat(keluar, jadwal.jam_pulang) : 0

  return (
    <div className="flex flex-col gap-4">
      {kembali}
      <div className="flex items-start justify-between gap-3">
        <h1 className="text-[22px] leading-7 font-semibold">{tanggalPanjang(dariTanggalDb(tanggal))}</h1>
        {badgeAbsensi(a, jadwal?.jam_pulang ?? null)}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <KartuFoto
          label="Clock in"
          path={a.foto_masuk_path}
          jam={masuk}
          keterangan={a.jam_masuk_semula ? <span className="text-ungu">Semula {jamWib(new Date(a.jam_masuk_semula))} WIB</span> : a.foto_masuk_path ? 'Sesuai foto' : 'Diisi HR'}
        />
        <KartuFoto
          label="Clock out"
          path={a.foto_keluar_path}
          jam={keluar}
          keterangan={
            a.jam_keluar_semula ? <span className="text-ungu">Semula {jamWib(new Date(a.jam_keluar_semula))} WIB</span>
            : !keluar ? 'Belum clock out'
            : a.auto_clock_out ? 'Diisi otomatis'
            : a.foto_keluar_path ? 'Sesuai foto'
            : 'Diisi HR'
          }
        />
      </div>

      <dl className="divide-y divide-garis rounded-kartu border border-garis bg-permukaan px-4">
        <Baris label="Total jam kerja">{keluar ? durasi(masuk, keluar) : 'Sedang bekerja'}</Baris>
        <Baris label="Jadwal">{jadwal ? `${jadwal.jam_masuk.slice(0, 5)} – ${jadwal.jam_pulang.slice(0, 5)} WIB` : 'Hari libur'}</Baris>
        <Baris label="Status kehadiran">
          {a.terlambat ? <Badge nada="peringatan">Terlambat {terlambat} menit</Badge> : <Badge nada="sukses">Tepat waktu</Badge>}
        </Baris>
        {cepat > 0 && (
          <Baris label="Pulang">
            <Badge nada="peringatan">Lebih cepat {cepat} menit</Badge>
          </Baris>
        )}
      </dl>

      {a.dikoreksi_oleh && a.alasan_koreksi && (
        <section className="rounded-kartu border border-ungu-latar bg-ungu-latar/50 p-4">
          <h2 className="text-[15px] font-semibold text-ungu">Catatan koreksi HR</h2>
          <p className="mt-1 text-[15px] leading-[22px]">{a.alasan_koreksi}</p>
          {(a.dikoreksi_oleh_nama || a.dikoreksi_pada) && (
            <p className="mt-2 text-sm text-teks-sekunder">
              {[a.dikoreksi_oleh_nama, a.dikoreksi_pada && `${waktuSingkat(new Date(a.dikoreksi_pada))} WIB`].filter(Boolean).join(' · ')}
            </p>
          )}
        </section>
      )}
      {a.auto_clock_out && (
        <p className="rounded-kartu bg-info-latar p-4 text-[15px] leading-[22px] text-info">
          Jam keluar diisi otomatis oleh sistem sesuai jam pulang{jadwal ? ` (${jadwal.jam_pulang.slice(0, 5)})` : ''}. Hubungi HR bila perlu koreksi.
        </p>
      )}
    </div>
  )
}

function KartuFoto({ label, path, jam, keterangan }: { label: string; path: string | null; jam: Date | null; keterangan: ReactNode }) {
  const foto = useFotoSelfie(path)
  return (
    <div className="overflow-hidden rounded-kartu border border-garis bg-permukaan">
      <div className="flex aspect-[3/4] items-center justify-center bg-teks-sekunder/20">
        {foto.data ? (
          <img src={foto.data} alt={`Foto selfie ${label.toLowerCase()}`} className="size-full object-cover" />
        ) : (
          <span className="flex flex-col items-center gap-1 text-sm text-teks-sekunder">
            <UserRound className="size-10" aria-hidden />
            {path ? (foto.isError ? 'Foto gagal dimuat' : 'Memuat foto…') : 'Tanpa foto selfie'}
          </span>
        )}
      </div>
      <div className="p-3">
        <p className="text-sm text-teks-sekunder">{label}</p>
        <p className="text-[19px] font-bold tabular-nums">{jam ? `${jamWib(jam)} WIB` : '—'}</p>
        <p className="text-sm text-teks-sekunder">{keterangan}</p>
      </div>
    </div>
  )
}

function Baris({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 text-[15px]">
      <dt className="text-teks-sekunder">{label}</dt>
      <dd className="text-right font-semibold">{children}</dd>
    </div>
  )
}

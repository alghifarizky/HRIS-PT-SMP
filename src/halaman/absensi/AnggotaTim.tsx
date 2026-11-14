// ATT-08 — Riwayat absensi anggota (B2 hal 29) & Profil anggota tim (B2 hal 30: tanpa gaji, slip, KTP, alamat,
// tanggal lahir). Data anggota dari RPC anggota_tim (Atasan tidak bisa membaca baris pengguna bawahan).
import type { ReactNode } from 'react'
import { Link, useParams } from 'react-router'
import { ChevronLeft } from 'lucide-react'
import { useProfil } from '../../auth/sesi'
import { dariTanggalDb, tanggalPanjang } from '../../lib/format'
import { KeadaanGalat, KeadaanKosong, Skeleton } from '../../komponen/keadaan'
import { useAnggotaTim, type AnggotaTim } from './data'
import { DaftarRiwayat } from './RiwayatAbsensi'

const inisial = (nama: string) => nama.split(' ').slice(0, 2).map((k) => k[0]).join('').toUpperCase()

/** Ambil satu anggota dari daftar tim; tampilkan state muat/galat/tidak ditemukan. */
function DenganAnggota({ isi }: { isi: (a: AnggotaTim) => ReactNode }) {
  const { id } = useParams()
  const q = useAnggotaTim()
  const kembali = (
    <Link to="/absensi/tim" className="fokus-ring -ml-2 inline-flex min-h-11 items-center gap-1 rounded-kontrol px-2 text-[15px] font-semibold text-primer">
      <ChevronLeft className="size-5" aria-hidden /> Absensi tim
    </Link>
  )
  if (q.isPending) return <>{kembali}<Skeleton baris={6} /></>
  if (q.isError) return <>{kembali}<KeadaanGalat judul="Data anggota gagal dimuat" onCobaLagi={() => q.refetch()} /></>
  const a = q.data.find((x) => x.id === id)
  if (!a) return <>{kembali}<KeadaanKosong judul="Anggota tidak ditemukan" pesan="Karyawan ini bukan anggota tim Anda." /></>
  return (
    <div className="flex flex-col gap-4">
      {kembali}
      {isi(a)}
    </div>
  )
}

export function RiwayatAnggota() {
  return (
    <DenganAnggota
      isi={(a) => (
        <>
          <div className="flex items-center gap-3">
            <span className="flex size-12 items-center justify-center rounded-full bg-primer-100 font-semibold text-primer" aria-hidden>{inisial(a.nama)}</span>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-[19px] font-semibold">{a.nama}</h1>
              <p className="truncate text-sm text-teks-sekunder">{a.jabatan ?? '—'}</p>
            </div>
            <Link to={`/absensi/tim/${a.id}/profil`} className="fokus-ring flex h-11 items-center rounded-kontrol border border-garis bg-permukaan px-4 font-semibold">Profil</Link>
          </div>
          <DaftarRiwayat target={{ id: a.id, tanggal_masuk: a.tanggal_masuk }} dasar={`/absensi/tim/${a.id}`} />
        </>
      )}
    />
  )
}

export function ProfilAnggota() {
  const namaSaya = useProfil().data!.nama
  return (
    <DenganAnggota
      isi={(a) => (
        <>
          <div className="flex items-center gap-4">
            <span className="flex size-14 items-center justify-center rounded-full bg-primer-100 text-lg font-semibold text-primer" aria-hidden>{inisial(a.nama)}</span>
            <div>
              <h1 className="text-[22px] leading-7 font-semibold">{a.nama}</h1>
              <p className="text-[15px] text-teks-sekunder">{a.jabatan ?? '—'}</p>
            </div>
          </div>
          <section className="rounded-kartu border border-garis bg-permukaan px-4 pt-4 pb-1">
            <h2 className="text-[13px] font-semibold tracking-wide text-teks-sekunder uppercase">Data karyawan</h2>
            <dl className="mt-1 divide-y divide-garis">
              <Baris label="Nama lengkap">{a.nama}</Baris>
              <Baris label="NIK karyawan"><span className="tabular-nums">{a.nik ?? '—'}</span></Baris>
              <Baris label="Jabatan">{a.jabatan ?? '—'}</Baris>
              <Baris label="Tanggal masuk">{a.tanggal_masuk ? tanggalPanjang(dariTanggalDb(a.tanggal_masuk)) : '—'}</Baris>
              <Baris label="Atasan">{namaSaya}</Baris>
            </dl>
          </section>
          <p className="rounded-kartu bg-info-latar p-4 text-[15px] text-info">Gaji, slip gaji, No. KTP, alamat, dan tanggal lahir hanya dapat dilihat oleh HR.</p>
          <Link to={`/absensi/tim/${a.id}`} className="fokus-ring flex h-12 items-center justify-center rounded-kontrol border border-garis bg-permukaan font-semibold hover:bg-latar">
            Lihat riwayat absensi
          </Link>
        </>
      )}
    />
  )
}

function Baris({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 text-[15px]">
      <dt className="text-teks-sekunder">{label}</dt>
      <dd className="text-right font-semibold">{children}</dd>
    </div>
  )
}

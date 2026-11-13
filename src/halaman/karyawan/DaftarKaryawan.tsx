// EMP-01 — desain B3A hal 4 (daftar), 5 (hasil cari kosong), 6 (memuat), 7 (galat); Direksi read-only B4 hal 27.
// Saringan disimpan di URL (?q=&peran=&status=&hal=) — juga dipakai kolom "Cari karyawan" di top bar panel.
import type { ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router'
import { ChevronLeft, ChevronRight, Plus, SearchX } from 'lucide-react'
import { useProfil, type Peran } from '../../auth/sesi'
import { LABEL_PERAN } from '../../navigasi'
import { dariTanggalDb, tanggalPendek } from '../../lib/format'
import { Tombol } from '../../komponen/form'
import { Badge, KeadaanGalat, Skeleton } from '../../komponen/keadaan'
import { useDaftarKaryawan } from './data'
import { potongHalaman, saringKaryawan, type Saringan } from './saring'

const kelasKontrol = 'fokus-ring h-11 w-full rounded-kontrol border border-garis bg-permukaan px-3 text-[15px]'

export default function DaftarKaryawan() {
  const peranSaya = useProfil().data!.role
  const q = useDaftarKaryawan()
  const [params, setParams] = useSearchParams()
  const saringan: Saringan = {
    q: params.get('q') ?? '',
    peran: (params.get('peran') as Peran) ?? '',
    status: (params.get('status') as Saringan['status']) ?? '',
  }
  const ubah = (kunci: string, nilai: string) =>
    setParams(
      (p) => {
        if (nilai) p.set(kunci, nilai)
        else p.delete(kunci)
        if (kunci !== 'hal') p.delete('hal') // saringan berubah → kembali ke halaman 1
        return p
      },
      { replace: true },
    )

  const semua = q.data ?? []
  const tersaring = saringKaryawan(semua, saringan)
  const hal = potongHalaman(tersaring, Number(params.get('hal')) || 1)
  const aktif = semua.filter((k) => k.aktif).length

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] leading-[34px] font-semibold">Daftar karyawan</h1>
          {q.data && (
            <p className="mt-1 text-[15px] text-teks-sekunder">
              {semua.length} akun · {aktif} aktif · {semua.length - aktif} nonaktif
            </p>
          )}
        </div>
        {peranSaya === 'hr' && (
          <Link
            to="/panel/karyawan/tambah"
            className="fokus-ring flex h-11 items-center gap-2 rounded-kontrol bg-primer px-5 text-base font-semibold text-white hover:bg-primer-700"
          >
            <Plus className="size-5" aria-hidden /> Tambah karyawan
          </Link>
        )}
      </div>

      <div className="mt-6 grid grid-cols-[1fr_220px_220px] gap-4">
        <label className="flex flex-col gap-2 text-sm font-medium">
          Cari
          <input type="search" value={saringan.q} onChange={(e) => ubah('q', e.target.value)} placeholder="Nama atau NIK" className={`${kelasKontrol} placeholder:text-teks-3`} />
        </label>
        <label className="flex flex-col gap-2 text-sm font-medium">
          Peran
          <select value={saringan.peran} onChange={(e) => ubah('peran', e.target.value)} className={kelasKontrol}>
            <option value="">Semua peran</option>
            {(Object.keys(LABEL_PERAN) as Peran[]).map((r) => (
              <option key={r} value={r}>
                {LABEL_PERAN[r]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-2 text-sm font-medium">
          Status
          <select value={saringan.status} onChange={(e) => ubah('status', e.target.value)} className={kelasKontrol}>
            <option value="">Semua status</option>
            <option value="aktif">Aktif</option>
            <option value="nonaktif">Nonaktif</option>
          </select>
        </label>
      </div>

      <section aria-label="Daftar karyawan" className="mt-4 overflow-hidden rounded-kartu border border-garis bg-permukaan">
        {q.isPending ? (
          <Skeleton baris={8} />
        ) : q.isError ? (
          <KeadaanGalat judul="Data karyawan gagal dimuat" onCobaLagi={() => q.refetch()} />
        ) : !tersaring.length ? (
          <div className="flex flex-col items-center px-6 py-12 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-latar">
              <SearchX className="size-6 text-teks-sekunder" aria-hidden />
            </div>
            <p className="mt-4 text-[17px] leading-6 font-semibold">
              {saringan.q.trim() ? `Tidak ada karyawan yang cocok dengan “${saringan.q.trim()}”` : 'Tidak ada karyawan yang cocok'}
            </p>
            <p className="mt-1 text-[15px] text-teks-sekunder">Periksa ejaan atau hapus filter peran dan status.</p>
            <Tombol varian="sekunder" className="mt-4" onClick={() => setParams({}, { replace: true })}>
              Hapus filter
            </Tombol>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[15px]">
                <thead className="text-[13px] font-semibold tracking-wide text-teks-sekunder uppercase">
                  <tr className="border-b border-garis">
                    <th scope="col" className="px-5 py-3">NIK</th>
                    <th scope="col" className="px-5 py-3">Nama</th>
                    <th scope="col" className="px-5 py-3">Jabatan</th>
                    <th scope="col" className="px-5 py-3">Peran</th>
                    <th scope="col" className="px-5 py-3">Atasan</th>
                    <th scope="col" className="px-5 py-3">Tgl masuk</th>
                    <th scope="col" className="px-5 py-3 text-right">Saldo cuti</th>
                    <th scope="col" className="px-5 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-garis">
                  {hal.isi.map((k) => (
                    <tr key={k.id} className={k.aktif ? '' : 'text-teks-3'}>
                      <td className="px-5 py-3 whitespace-nowrap tabular-nums">{k.nik ?? '—'}</td>
                      <th scope="row" className={`px-5 py-3 font-semibold ${k.aktif ? '' : 'font-medium'}`}>
                        {/* shortcut: sementara langsung ke Edit (HR); jadi ke halaman detail di langkah 2.4d */}
                        {peranSaya === 'hr' ? (
                          <Link to={`/panel/karyawan/${k.id}/edit`} className="fokus-ring rounded hover:text-primer hover:underline">
                            {k.nama}
                          </Link>
                        ) : (
                          k.nama
                        )}
                      </th>
                      <td className="px-5 py-3">{k.jabatan ?? '—'}</td>
                      <td className="px-5 py-3">{LABEL_PERAN[k.role]}</td>
                      <td className="px-5 py-3">{k.atasan?.nama ?? '—'}</td>
                      <td className="px-5 py-3 whitespace-nowrap tabular-nums">{k.tanggal_masuk ? tanggalPendek(dariTanggalDb(k.tanggal_masuk)) : '—'}</td>
                      <td className="px-5 py-3 text-right whitespace-nowrap tabular-nums">{k.aktif && k.saldo_cuti != null ? `${k.saldo_cuti} hari` : '—'}</td>
                      <td className="px-5 py-3">{k.aktif ? <Badge nada="sukses">Aktif</Badge> : <Badge nada="netral">Nonaktif</Badge>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between gap-4 border-t border-garis px-5 py-3">
              <p className="text-sm text-teks-sekunder tabular-nums">
                Menampilkan {hal.dari}–{hal.sampai} dari {tersaring.length}
              </p>
              {hal.jumlahHalaman > 1 && (
                <nav aria-label="Halaman" className="flex gap-2">
                  <TombolHalaman label="Halaman sebelumnya" disabled={hal.halaman === 1} onClick={() => ubah('hal', String(hal.halaman - 1))}>
                    <ChevronLeft className="size-4" aria-hidden />
                  </TombolHalaman>
                  {Array.from({ length: hal.jumlahHalaman }, (_, i) => i + 1).map((n) => (
                    <TombolHalaman key={n} label={`Halaman ${n}`} aktif={n === hal.halaman} onClick={() => ubah('hal', String(n))}>
                      {n}
                    </TombolHalaman>
                  ))}
                  <TombolHalaman label="Halaman berikutnya" disabled={hal.halaman === hal.jumlahHalaman} onClick={() => ubah('hal', String(hal.halaman + 1))}>
                    <ChevronRight className="size-4" aria-hidden />
                  </TombolHalaman>
                </nav>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  )
}

function TombolHalaman(p: { label: string; aktif?: boolean; disabled?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={p.label}
      aria-current={p.aktif ? 'page' : undefined}
      disabled={p.disabled}
      onClick={p.onClick}
      className={`fokus-ring flex size-11 items-center justify-center rounded-kontrol border text-[15px] tabular-nums disabled:opacity-40 ${p.aktif ? 'border-primer bg-primer-50 font-semibold text-primer' : 'border-garis bg-permukaan hover:bg-latar'}`}
    >
      {p.children}
    </button>
  )
}

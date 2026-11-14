// Log audit — B3C hal 16 (daftar), 17–18 (panel detail). Hanya-baca; HR (RLS: HR & Direksi membaca).
// Filter & paging di server (log terus bertambah). Saringan disimpan di URL.
import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { uraikanLog, type BarisLog } from '../../lib/audit'
import { dariTanggalDb, hariIniDb, tahunIni, tanggalPendek, waktuSingkat } from '../../lib/format'
import { NAMA_HARI } from '../../lib/jadwal'
import { LABEL_PERAN } from '../../navigasi'
import type { Peran } from '../../auth/sesi'
import { Badge, KeadaanGalat, KeadaanKosong, Skeleton } from '../../komponen/keadaan'
import Laci from '../../komponen/Laci'
import { useDaftarKaryawan } from '../karyawan/data'

const PER_HALAMAN = 25
const SISTEM = 'sistem'

type Log = BarisLog & {
  id: string
  tabel: string
  baris_id: string
  alasan: string | null
  pada: string
  pelaku: { nama: string; role: Peran } | null
}

const OBJEK: Record<string, string> = { pengguna: 'Karyawan', absensi: 'Absensi', jadwal_kerja: 'Jadwal kerja', hari_libur: 'Hari libur', pengaturan: 'Pengaturan' }
const fmtTglObjek = new Intl.DateTimeFormat('id-ID', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Jakarta' })
const AKSI: Record<Log['aksi'], { label: string; nada: 'sukses' | 'info' | 'bahaya' | 'ungu' }> = {
  insert: { label: 'Tambah', nada: 'sukses' },
  update: { label: 'Ubah', nada: 'info' },
  delete: { label: 'Hapus', nada: 'bahaya' },
  lihat_ktp: { label: 'Lihat No. KTP', nada: 'ungu' },
}
const kelasKontrol = 'fokus-ring h-11 w-full rounded-kontrol border border-garis bg-permukaan px-3 text-[15px]'

export default function LogAudit() {
  const [params, setParams] = useSearchParams()
  const [dipilih, setDipilih] = useState<Log | null>(null)
  const daftar = useDaftarKaryawan()
  const s = {
    dari: params.get('dari') ?? `${tahunIni()}-01-01`,
    sampai: params.get('sampai') ?? hariIniDb(),
    oleh: params.get('oleh') ?? '',
    objek: params.get('objek') ?? '',
    aksi: params.get('aksi') ?? '',
    hal: Math.max(1, Number(params.get('hal')) || 1),
  }
  const ubah = (kunci: string, nilai: string) =>
    setParams(
      (p) => {
        if (nilai) p.set(kunci, nilai)
        else p.delete(kunci)
        if (kunci !== 'hal') p.delete('hal')
        return p
      },
      { replace: true },
    )

  const q = useQuery({
    queryKey: ['log_audit', s],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      let k = supabase
        .from('log_audit')
        .select('id, tabel, baris_id, aksi, nilai_lama, nilai_baru, alasan, pada, pelaku:pengguna!oleh(nama, role)', { count: 'exact' })
        .gte('pada', `${s.dari}T00:00:00+07:00`)
        .lte('pada', `${s.sampai}T23:59:59.999+07:00`)
        .order('pada', { ascending: false })
        .range((s.hal - 1) * PER_HALAMAN, s.hal * PER_HALAMAN - 1)
      if (s.oleh === SISTEM) k = k.is('oleh', null)
      else if (s.oleh) k = k.eq('oleh', s.oleh)
      if (s.objek) k = k.eq('tabel', s.objek)
      if (s.aksi) k = k.eq('aksi', s.aksi)
      const { data, error, count } = await k
      if (error) throw error
      const baris = data as unknown as Log[]
      // Label objek absensi ("Absensi: Nama, Jum 13 Nov") — ambil pemilik & tanggal baris absensi di halaman ini
      const idAbsensi = [...new Set(baris.filter((l) => l.tabel === 'absensi').map((l) => l.baris_id))]
      const absensi = new Map<string, { tanggal: string; pengguna_id: string }>()
      if (idAbsensi.length) {
        const { data: ab, error: eAb } = await supabase.from('absensi').select('id, tanggal, pengguna_id').in('id', idAbsensi)
        if (eAb) throw eAb
        for (const a of ab as { id: string; tanggal: string; pengguna_id: string }[]) absensi.set(a.id, a)
      }
      return { baris, total: count ?? 0, absensi }
    },
  })

  const namaPengguna = (id: string) => daftar.data?.find((p) => p.id === id)?.nama ?? '(tidak dikenal)'
  const objek = (l: Log) => {
    if (l.tabel === 'pengguna') return `Karyawan: ${namaPengguna(l.baris_id)}`
    if (l.tabel === 'absensi') {
      // baris sudah dihapus → pakai nilai lama di log
      const a = q.data?.absensi.get(l.baris_id) ?? (l.nilai_lama as { tanggal?: string; pengguna_id?: string } | null)
      return a?.tanggal && a.pengguna_id ? `Absensi: ${namaPengguna(a.pengguna_id)}, ${fmtTglObjek.format(dariTanggalDb(a.tanggal)).replace('.', '')}` : 'Absensi'
    }
    if (l.tabel === 'jadwal_kerja') return `Jadwal kerja: ${NAMA_HARI[Number(l.baris_id)] ?? l.baris_id}`
    if (l.tabel === 'hari_libur') return `Hari libur: ${tanggalPendek(dariTanggalDb(l.baris_id))}`
    return OBJEK[l.tabel] ?? l.tabel
  }
  const oleh = (l: Log) => (l.pelaku ? `${l.pelaku.nama} (${LABEL_PERAN[l.pelaku.role]})` : 'Sistem')
  const ringkasan = (l: Log) => {
    const { judul, perubahan } = uraikanLog(l, namaPengguna, l.tabel)
    if (!perubahan.length) return judul
    const p = perubahan[0]
    const teks = l.aksi === 'update' ? `${p.label} ${p.lama} → ${p.baru}` : `${judul}: ${p.baru !== '—' ? p.baru : p.lama}`
    return perubahan.length > 1 ? `${teks} (+${perubahan.length - 1} lainnya)` : teks
  }

  const total = q.data?.total ?? 0
  const jumlahHalaman = Math.max(1, Math.ceil(total / PER_HALAMAN))

  return (
    <div>
      <h1 className="text-[28px] leading-[34px] font-semibold">Log audit</h1>
      <p className="mt-1 text-[15px] text-teks-sekunder">Catatan semua perubahan data · hanya-baca, tidak bisa diubah atau dihapus</p>

      <div className="mt-6 grid grid-cols-[1.4fr_1fr_1fr_1fr] gap-4 rounded-kartu border border-garis bg-permukaan p-4">
        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium">Rentang tanggal</legend>
          <div className="mt-2 flex items-center gap-2">
            <input type="date" aria-label="Dari tanggal" value={s.dari} max={s.sampai} onChange={(e) => ubah('dari', e.target.value)} className={kelasKontrol} />
            <span className="text-teks-sekunder">–</span>
            <input type="date" aria-label="Sampai tanggal" value={s.sampai} min={s.dari} onChange={(e) => ubah('sampai', e.target.value)} className={kelasKontrol} />
          </div>
        </fieldset>
        <label className="flex flex-col gap-2 text-sm font-medium">
          Pengguna
          <select value={s.oleh} onChange={(e) => ubah('oleh', e.target.value)} className={kelasKontrol}>
            <option value="">Semua pengguna</option>
            <option value={SISTEM}>Sistem</option>
            {(daftar.data ?? []).map((p) => (
              <option key={p.id} value={p.id}>{p.nama} ({LABEL_PERAN[p.role]})</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-2 text-sm font-medium">
          Objek
          <select value={s.objek} onChange={(e) => ubah('objek', e.target.value)} className={kelasKontrol}>
            <option value="">Semua objek</option>
            {Object.entries(OBJEK).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-2 text-sm font-medium">
          Aksi
          <select value={s.aksi} onChange={(e) => ubah('aksi', e.target.value)} className={kelasKontrol}>
            <option value="">Semua aksi</option>
            {Object.entries(AKSI).map(([v, a]) => (
              <option key={v} value={v}>{a.label}</option>
            ))}
          </select>
        </label>
      </div>

      <section aria-label="Entri log audit" className="mt-4 overflow-hidden rounded-kartu border border-garis bg-permukaan">
        {q.isPending ? (
          <Skeleton baris={8} />
        ) : q.isError ? (
          <KeadaanGalat judul="Log audit gagal dimuat" onCobaLagi={() => q.refetch()} />
        ) : !q.data.baris.length ? (
          <KeadaanKosong judul="Tidak ada entri" pesan="Tidak ada catatan untuk saringan ini. Ubah rentang tanggal atau saringan lain." />
        ) : (
          <>
            <table className={`w-full text-left text-[15px] ${q.isFetching ? 'opacity-60' : ''}`}>
              <thead className="text-[13px] font-semibold tracking-wide text-teks-sekunder uppercase">
                <tr className="border-b border-garis">
                  <th scope="col" className="px-5 py-3">Waktu</th>
                  <th scope="col" className="px-5 py-3">Oleh</th>
                  <th scope="col" className="px-5 py-3">Objek</th>
                  <th scope="col" className="px-5 py-3">Aksi</th>
                  <th scope="col" className="px-5 py-3">Ringkasan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-garis">
                {q.data.baris.map((l) => {
                  const [tgl, jam] = waktuSingkat(new Date(l.pada)).split(' · ')
                  return (
                    <tr key={l.id} className={`cursor-pointer hover:bg-latar ${dipilih?.id === l.id ? 'bg-primer-50' : ''}`} onClick={() => setDipilih(l)}>
                      <td className="px-5 py-3 whitespace-nowrap">
                        <button type="button" onClick={() => setDipilih(l)} className="fokus-ring rounded text-left">
                          <span className="block font-semibold">{tgl}</span>
                          <span className="block text-sm text-teks-sekunder tabular-nums">{jam}</span>
                        </button>
                      </td>
                      <td className="px-5 py-3">{oleh(l)}</td>
                      <td className="px-5 py-3">{objek(l)}</td>
                      <td className="px-5 py-3"><Badge nada={AKSI[l.aksi].nada}>{AKSI[l.aksi].label}</Badge></td>
                      <td className="px-5 py-3 text-teks-sekunder">{ringkasan(l)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <div className="flex items-center justify-between gap-4 border-t border-garis px-5 py-3">
              <p className="text-sm text-teks-sekunder">
                {total} entri · urut terbaru di atas · No. KTP selalu tersamar di log
              </p>
              {jumlahHalaman > 1 && (
                <nav aria-label="Halaman" className="flex items-center gap-2">
                  <span className="text-sm text-teks-sekunder tabular-nums">Halaman {s.hal} dari {jumlahHalaman}</span>
                  <button type="button" aria-label="Halaman sebelumnya" disabled={s.hal === 1} onClick={() => ubah('hal', String(s.hal - 1))} className="fokus-ring flex size-11 items-center justify-center rounded-kontrol border border-garis disabled:opacity-40">
                    <ChevronLeft className="size-4" aria-hidden />
                  </button>
                  <button type="button" aria-label="Halaman berikutnya" disabled={s.hal >= jumlahHalaman} onClick={() => ubah('hal', String(s.hal + 1))} className="fokus-ring flex size-11 items-center justify-center rounded-kontrol border border-garis disabled:opacity-40">
                    <ChevronRight className="size-4" aria-hidden />
                  </button>
                </nav>
              )}
            </div>
          </>
        )}
      </section>

      {dipilih && <DetailLog l={dipilih} judul={objek(dipilih)} oleh={oleh(dipilih)} namaPengguna={namaPengguna} onTutup={() => setDipilih(null)} />}
    </div>
  )
}

function DetailLog({ l, judul, oleh, namaPengguna, onTutup }: { l: Log; judul: string; oleh: string; namaPengguna: (id: string) => string; onTutup: () => void }) {
  const { perubahan } = uraikanLog(l, namaPengguna, l.tabel)
  return (
    <Laci judul={judul} subjudul={`${waktuSingkat(new Date(l.pada))} · ${oleh}`} onTutup={onTutup}>
      <p className="text-[15px]">
        Aksi: <strong className="font-semibold">{AKSI[l.aksi].label}</strong>
      </p>
      {l.aksi === 'lihat_ktp' ? (
        <p className="mt-4 rounded-kontrol bg-latar p-4 text-[15px] text-teks-sekunder">No. KTP lengkap dilihat. Nomornya tidak disimpan di log.</p>
      ) : perubahan.length ? (
        <table className="mt-4 w-full overflow-hidden rounded-kartu border border-garis text-left text-[15px]">
          <thead className="bg-latar text-[13px] font-semibold tracking-wide text-teks-sekunder uppercase">
            <tr>
              <th scope="col" className="px-4 py-2.5">Field</th>
              <th scope="col" className="px-4 py-2.5">Nilai lama</th>
              <th scope="col" className="px-4 py-2.5">Nilai baru</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-garis">
            {perubahan.map((p) => (
              <tr key={p.label}>
                <th scope="row" className="px-4 py-2.5 font-medium">{p.label}</th>
                <td className="px-4 py-2.5 text-bahaya">{p.lama === '—' ? '—' : <s>{p.lama}</s>}</td>
                <td className="px-4 py-2.5 font-semibold text-sukses">{p.baru}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="mt-4 text-[15px] text-teks-sekunder">Tidak ada rincian perubahan.</p>
      )}
      {l.alasan && (
        <div className="mt-5">
          <p className="text-sm text-teks-sekunder">Alasan</p>
          <p className="mt-1 rounded-kontrol bg-latar p-4 text-[15px]">{l.alasan}</p>
        </div>
      )}
    </Laci>
  )
}

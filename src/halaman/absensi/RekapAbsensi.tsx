// ATT-09 — Rekap absensi HR (B3A hal 21 rekap, 22–24 koreksi, 25 tambah manual, 26 kosong, 27 memuat, 28 galat).
// Aturan koreksi ada di trigger jaga_absensi: alasan wajib, terlambat dihitung ulang, "semula", Dikoreksi HR.
// Cuti/sakit/izin menyusul (Fase 4).
import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { HEADER_ALASAN, kodeAlasan } from '../../lib/alasan'
import { durasi, hariIso, jamWib, susunRekap, type StatusTim } from '../../lib/absensi'
import { jamValid, rapikanJam } from '../../lib/jadwal'
import { dariTanggalDb, hariIniDb, tanggalPanjang } from '../../lib/format'
import { BannerGalat, Field, Input, Tombol } from '../../komponen/form'
import { Badge, KeadaanGalat, KeadaanKosong, Skeleton } from '../../komponen/keadaan'
import Laci from '../../komponen/Laci'
import { useToast } from '../../komponen/toast'
import { KOLOM_ABSENSI, useFotoSelfie, type BarisAbsensi } from './data'
import { badgeAbsensi } from './RiwayatAbsensi'

type Karyawan = { id: string; nama: string; jabatan: string | null; tanggal_masuk: string | null; aktif: boolean; tanggal_nonaktif: string | null }
type Absen = BarisAbsensi & { pengguna_id: string }
type Baris = { tanggal: string; karyawan: Karyawan; absensi: Absen | null; status: StatusTim }

const PER_MUAT = 25
const MAKS_HARI = 31
const fmtTglTabel = new Intl.DateTimeFormat('id-ID', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Jakarta' })
const tglTabel = (t: string) => fmtTglTabel.format(dariTanggalDb(t)).replace('.', '')
const hhmm = (s: string | null) => (s ? jamWib(new Date(s)) : '')
const keIso = (tanggal: string, jam: string) => `${tanggal}T${jam}:00+07:00`
const geser = (t: string, n: number) => {
  const d = new Date(`${t}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
const inisial = (nama: string) => nama.split(' ').slice(0, 2).map((k) => k[0]).join('').toUpperCase()
const kelasKontrol = 'fokus-ring h-11 w-full rounded-kontrol border border-garis bg-permukaan px-3 text-[15px]'

const STATUS: Record<string, string> = {
  tepat: 'Tepat waktu', terlambat: 'Terlambat', belum: 'Belum clock in / tanpa absensi', berjalan: 'Berjalan', auto: 'Auto clock out', koreksi: 'Dikoreksi HR',
}
function cocokStatus(b: Baris, s: string) {
  const a = b.absensi
  switch (s) {
    case 'tepat': return !!a && !a.terlambat
    case 'terlambat': return !!a?.terlambat
    case 'belum': return !a
    case 'berjalan': return !!a && !a.jam_keluar
    case 'auto': return !!a?.auto_clock_out
    case 'koreksi': return !!a?.dikoreksi_oleh
    default: return true
  }
}

function useDataRekap(dari: string, sampai: string) {
  return useQuery({
    queryKey: ['rekap_absensi', dari, sampai],
    queryFn: async () => {
      const [karyawan, absensi, libur, jadwal] = await Promise.all([
        supabase.from('pengguna').select('id, nama, jabatan, tanggal_masuk, aktif, tanggal_nonaktif').neq('role', 'direksi').order('nama'),
        supabase.from('absensi').select(`pengguna_id, ${KOLOM_ABSENSI}`).gte('tanggal', dari).lte('tanggal', sampai),
        supabase.from('hari_libur').select('tanggal').gte('tanggal', dari).lte('tanggal', sampai),
        supabase.from('jadwal_kerja').select('hari, jam_masuk, jam_pulang'),
      ])
      for (const r of [karyawan, absensi, libur, jadwal]) if (r.error) throw r.error
      const setLibur = new Set((libur.data as { tanggal: string }[]).map((l) => l.tanggal))
      const perHari = new Map((jadwal.data as { hari: number; jam_masuk: string; jam_pulang: string }[]).map((j) => [j.hari, j]))
      return {
        karyawan: karyawan.data as Karyawan[],
        absensi: absensi.data as Absen[],
        /** Jadwal tanggal itu; null = hari libur / Minggu. */
        jadwal: (t: string) => (setLibur.has(t) ? null : (perHari.get(hariIso(t)) ?? null)),
      }
    },
  })
}

export default function RekapAbsensi() {
  const hariIni = hariIniDb()
  const [params, setParams] = useSearchParams()
  const jepit = (t: string) => (t > hariIni ? hariIni : t)
  const sampai = jepit(params.get('sampai') ?? hariIni)
  const dari = (() => {
    const d = params.get('dari') ?? sampai
    const batas = geser(sampai, -(MAKS_HARI - 1))
    return d > sampai ? sampai : d < batas ? batas : d
  })()
  const filterKaryawan = params.get('karyawan') ?? ''
  const filterStatus = params.get('status') ?? ''
  const ubah = (kunci: string, nilai: string) =>
    setParams((p) => {
      if (nilai) p.set(kunci, nilai)
      else p.delete(kunci)
      return p
    }, { replace: true })

  const [batas, setBatas] = useState(PER_MUAT)
  const [koreksi, setKoreksi] = useState<Baris | null>(null)
  const [tambah, setTambah] = useState<{ karyawanId?: string; tanggal?: string } | null>(null)
  const q = useDataRekap(dari, sampai)

  const semua = q.data ? susunRekap({ karyawan: q.data.karyawan, absensi: q.data.absensi, dari, sampai, hariIni, hariKerja: (t) => !!q.data!.jadwal(t) }) : []
  const tersaring = semua.filter((b) => (!filterKaryawan || b.karyawan.id === filterKaryawan) && cocokStatus(b, filterStatus))
  const tampil = tersaring.slice(0, batas)

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] leading-[34px] font-semibold">Rekap absensi</h1>
          <p className="mt-1 text-[15px] text-teks-sekunder">Pilih rentang hingga {MAKS_HARI} hari. Koreksi & tambah manual wajib beralasan dan tercatat di Log audit.</p>
        </div>
        <Tombol onClick={() => setTambah({})}>
          <Plus className="size-5" aria-hidden /> Tambah absensi manual
        </Tombol>
      </div>

      <div className="mt-6 grid grid-cols-[1.3fr_1fr_1fr] gap-4">
        <fieldset>
          <legend className="text-sm font-medium">Tanggal / rentang</legend>
          <div className="mt-2 flex items-center gap-2">
            <input type="date" aria-label="Dari tanggal" value={dari} max={sampai} onChange={(e) => (ubah('dari', e.target.value), setBatas(PER_MUAT))} className={kelasKontrol} />
            <span className="text-teks-sekunder">–</span>
            <input type="date" aria-label="Sampai tanggal" value={sampai} min={dari} max={hariIni} onChange={(e) => (ubah('sampai', e.target.value), setBatas(PER_MUAT))} className={kelasKontrol} />
          </div>
        </fieldset>
        <label className="flex flex-col gap-2 text-sm font-medium">
          Karyawan
          <select value={filterKaryawan} onChange={(e) => (ubah('karyawan', e.target.value), setBatas(PER_MUAT))} className={kelasKontrol}>
            <option value="">Semua karyawan{q.data ? ` (${q.data.karyawan.filter((k) => k.aktif).length})` : ''}</option>
            {(q.data?.karyawan ?? []).map((k) => <option key={k.id} value={k.id}>{k.nama}{k.aktif ? '' : ' (nonaktif)'}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-2 text-sm font-medium">
          Status
          <select value={filterStatus} onChange={(e) => (ubah('status', e.target.value), setBatas(PER_MUAT))} className={kelasKontrol}>
            <option value="">Semua status</option>
            {Object.entries(STATUS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
      </div>

      <section aria-label="Rekap absensi" className="mt-4 overflow-hidden rounded-kartu border border-garis bg-permukaan">
        {q.isPending ? (
          <Skeleton baris={8} />
        ) : q.isError ? (
          <KeadaanGalat judul="Rekap absensi gagal dimuat" onCobaLagi={() => q.refetch()} />
        ) : !tersaring.length ? (
          <KeadaanKosong
            judul="Tidak ada absensi untuk filter ini"
            pesan={dari === sampai && !q.data.jadwal(dari) ? `${tanggalPanjang(dariTanggalDb(dari))} adalah hari libur. Pilih rentang lain atau hapus filter status.` : 'Pilih rentang lain atau hapus filter karyawan dan status.'}
          />
        ) : (
          <>
            <table className="w-full text-left text-[15px]">
              <thead className="text-[13px] font-semibold tracking-wide text-teks-sekunder uppercase">
                <tr className="border-b border-garis">
                  <th scope="col" className="px-5 py-3">Tanggal</th>
                  <th scope="col" className="px-5 py-3">Karyawan</th>
                  <th scope="col" className="px-5 py-3">Masuk</th>
                  <th scope="col" className="px-5 py-3">Keluar</th>
                  <th scope="col" className="px-5 py-3">Total</th>
                  <th scope="col" className="px-5 py-3">Status</th>
                  <th scope="col" className="px-5 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-garis">
                {tampil.map((b) => {
                  const a = b.absensi
                  const jadwal = q.data.jadwal(b.tanggal)
                  return (
                    <tr key={`${b.tanggal}-${b.karyawan.id}`}>
                      <td className="px-5 py-3 whitespace-nowrap">{tglTabel(b.tanggal)}</td>
                      <th scope="row" className="px-5 py-3 font-normal">
                        <span className="flex items-center gap-3">
                          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primer-100 text-[13px] font-semibold text-primer" aria-hidden>{inisial(b.karyawan.nama)}</span>
                          <span>
                            <span className="block font-semibold">{b.karyawan.nama}</span>
                            <span className="block text-sm text-teks-sekunder">{b.karyawan.jabatan ?? '—'}</span>
                          </span>
                        </span>
                      </th>
                      <td className="px-5 py-3 tabular-nums">{a ? hhmm(a.jam_masuk) : '—'}</td>
                      <td className="px-5 py-3 tabular-nums">{a?.jam_keluar ? hhmm(a.jam_keluar) : '—'}</td>
                      <td className="px-5 py-3 tabular-nums">{a ? (a.jam_keluar ? durasi(new Date(a.jam_masuk), new Date(a.jam_keluar)) : 'Berjalan') : '—'}</td>
                      <td className="px-5 py-3">
                        {a ? (badgeAbsensi(a, jadwal?.jam_pulang ?? null) ?? <Badge nada="sukses">Tepat waktu</Badge>)
                          : b.status === 'belum_clock_in' ? <Badge nada="netral">Belum clock in</Badge>
                          : <Badge nada="bahaya">Tanpa absensi</Badge>}
                      </td>
                      <td className="px-5 py-2 text-right">
                        {a ? (
                          <Tombol varian="sekunder" className="h-10 px-4" onClick={() => setKoreksi(b)}>Koreksi</Tombol>
                        ) : (
                          <Tombol varian="sekunder" className="h-10 px-4" onClick={() => setTambah({ karyawanId: b.karyawan.id, tanggal: b.tanggal })}>Tambah</Tombol>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <div className="flex items-center justify-between gap-4 border-t border-garis px-5 py-3">
              <p className="text-sm text-teks-sekunder">Menampilkan {tampil.length} dari {tersaring.length} catatan</p>
              {tampil.length < tersaring.length && <Tombol varian="sekunder" onClick={() => setBatas((n) => n + PER_MUAT)}>Muat lebih banyak</Tombol>}
            </div>
          </>
        )}
      </section>

      {koreksi?.absensi && q.data && <LaciKoreksi b={koreksi as Baris & { absensi: Absen }} jadwal={q.data.jadwal(koreksi.tanggal)} onTutup={() => setKoreksi(null)} />}
      {tambah && q.data && <LaciTambah awal={tambah} karyawan={q.data.karyawan} jadwal={q.data.jadwal} hariIni={hariIni} onTutup={() => setTambah(null)} />}
    </div>
  )
}

/** Isian jam 24 jam (teks) — sama dengan jadwal kerja: dirapikan saat keluar fokus. */
function IsianJam({ id, label, nilai, onUbah, galat }: { id: string; label: string; nilai: string; onUbah: (v: string) => void; galat?: boolean }) {
  return (
    <Input id={id} aria-label={label} inputMode="numeric" placeholder="07:00" maxLength={5} value={nilai} galat={galat} onChange={(e) => onUbah(e.target.value)} onBlur={(e) => onUbah(rapikanJam(e.target.value))} className="w-[110px] tabular-nums" />
  )
}

function useSimpanAbsensi(onTutup: () => void) {
  const qc = useQueryClient()
  const toast = useToast()
  return async (kerja: () => PromiseLike<{ error: { code?: string; message: string } | null }>, pesanSukses: string) => {
    const { error } = await kerja()
    if (error) {
      if (error.code === '23505') return 'Karyawan ini sudah punya absensi pada tanggal tersebut — gunakan Koreksi.'
      if (/Alasan koreksi|Jam masuk harus|jam_keluar_setelah_masuk/.test(error.message)) return error.message.includes('jam_keluar') ? 'Jam keluar tidak boleh sebelum jam masuk.' : error.message
      return 'Gagal menyimpan. Periksa koneksi Anda, lalu coba lagi — isian Anda tidak hilang.'
    }
    await qc.invalidateQueries({ queryKey: ['rekap_absensi'] })
    toast(pesanSukses)
    onTutup()
    return null
  }
}

function LaciKoreksi({ b, jadwal, onTutup }: { b: Baris & { absensi: Absen }; jadwal: { jam_masuk: string; jam_pulang: string } | null; onTutup: () => void }) {
  const a = b.absensi
  const [masuk, setMasuk] = useState(hhmm(a.jam_masuk))
  const [keluar, setKeluar] = useState(hhmm(a.jam_keluar))
  const [alasan, setAlasan] = useState('')
  const [galat, setGalat] = useState<string | null>(null)
  const [menyimpan, setMenyimpan] = useState(false)
  const simpan = useSimpanAbsensi(onTutup)
  const fotoMasuk = useFotoSelfie(a.foto_masuk_path)
  const fotoKeluar = useFotoSelfie(a.foto_keluar_path)

  const valid = jamValid(masuk) && (!keluar || jamValid(keluar)) && (!keluar || keluar >= masuk)
  const totalBaru = valid && keluar ? durasi(new Date(keIso(b.tanggal, masuk)), new Date(keIso(b.tanggal, keluar))) : '—'
  const berubah = masuk !== hhmm(a.jam_masuk) || keluar !== hhmm(a.jam_keluar)

  const kirim = async () => {
    if (!alasan.trim()) return setGalat('Alasan koreksi wajib diisi agar tercatat di Log audit.')
    setMenyimpan(true)
    const ringkas = [masuk !== hhmm(a.jam_masuk) && `Jam masuk ${hhmm(a.jam_masuk)} → ${masuk}`, keluar !== hhmm(a.jam_keluar) && `Jam keluar ${hhmm(a.jam_keluar) || '—'} → ${keluar}`].filter(Boolean).join(', ')
    const g = await simpan(
      // header x-alasan: alasan koreksi ini tercatat di log audit walau teksnya sama dengan sebelumnya
      () => supabase.from('absensi').update({ jam_masuk: keIso(b.tanggal, masuk), jam_keluar: keluar ? keIso(b.tanggal, keluar) : null, alasan_koreksi: alasan.trim() }).eq('id', a.id).setHeader(HEADER_ALASAN, kodeAlasan(alasan)),
      `Koreksi absensi ${b.karyawan.nama} disimpan. ${ringkas} · tercatat di Log audit.`,
    )
    setMenyimpan(false)
    setGalat(g)
  }

  return (
    <Laci judul="Koreksi absensi" subjudul={`${b.karyawan.nama} · ${b.karyawan.jabatan ?? '—'} · ${tanggalPanjang(dariTanggalDb(b.tanggal))}`} onTutup={onTutup}>
      <div className="flex flex-col gap-5">
        <p className="flex items-center gap-2 text-[15px]">Status saat ini {badgeAbsensi(a, jadwal?.jam_pulang ?? null) ?? <Badge nada="sukses">Tepat waktu</Badge>}</p>
        <table className="w-full overflow-hidden rounded-kartu border border-garis text-left text-[15px]">
          <thead className="bg-latar text-[13px] font-semibold text-teks-sekunder">
            <tr><th className="px-4 py-2" /><th className="px-4 py-2">Lama</th><th className="px-4 py-2">Baru</th></tr>
          </thead>
          <tbody className="divide-y divide-garis">
            <tr>
              <th scope="row" className="px-4 py-2 font-medium">Jam masuk</th>
              <td className="px-4 py-2 tabular-nums">{hhmm(a.jam_masuk)} WIB</td>
              <td className="px-4 py-2"><IsianJam id="koreksi-masuk" label="Jam masuk baru" nilai={masuk} onUbah={setMasuk} galat={!jamValid(masuk)} /></td>
            </tr>
            <tr>
              <th scope="row" className="px-4 py-2 font-medium">Jam keluar</th>
              <td className="px-4 py-2 tabular-nums">
                {a.jam_keluar ? `${hhmm(a.jam_keluar)} WIB` : '—'}
                {a.auto_clock_out && <span className="block text-xs text-info">diisi otomatis</span>}
              </td>
              <td className="px-4 py-2"><IsianJam id="koreksi-keluar" label="Jam keluar baru" nilai={keluar} onUbah={setKeluar} galat={!!keluar && (!jamValid(keluar) || keluar < masuk)} /></td>
            </tr>
            <tr>
              <th scope="row" className="px-4 py-2 font-medium">Total</th>
              <td className="px-4 py-2 tabular-nums">{a.jam_keluar ? durasi(new Date(a.jam_masuk), new Date(a.jam_keluar)) : 'Berjalan'}</td>
              <td className={`px-4 py-2 font-semibold tabular-nums ${berubah ? 'text-sukses' : ''}`}>{totalBaru}</td>
            </tr>
          </tbody>
        </table>

        <div>
          <p className="text-sm font-medium">Foto selfie</p>
          <div className="mt-2 grid grid-cols-2 gap-3">
            {[{ label: `Masuk · ${hhmm(a.jam_masuk)}`, f: fotoMasuk, ada: !!a.foto_masuk_path }, { label: a.jam_keluar ? `Keluar · ${hhmm(a.jam_keluar)}` : 'Keluar', f: fotoKeluar, ada: !!a.foto_keluar_path }].map((x) => (
              <figure key={x.label} className="overflow-hidden rounded-kartu border border-garis">
                {x.f.data ? <img src={x.f.data} alt={`Foto ${x.label}`} className="aspect-[4/3] w-full object-cover" /> : (
                  <div className="flex aspect-[4/3] items-center justify-center bg-latar px-2 text-center text-sm text-teks-sekunder">
                    {x.ada ? 'Memuat foto…' : a.auto_clock_out && x.label.startsWith('Keluar') ? 'Tanpa foto (auto clock out)' : 'Tanpa foto'}
                  </div>
                )}
                <figcaption className="px-3 py-1.5 text-sm text-teks-sekunder">{x.label}</figcaption>
              </figure>
            ))}
          </div>
        </div>

        <Field id="alasan-koreksi" label="Alasan koreksi" wajib bantuan="Perubahan dicatat di Log audit atas nama Anda, dengan nilai lama dan baru.">
          <textarea id="alasan-koreksi" rows={3} value={alasan} onChange={(e) => setAlasan(e.target.value)} className="fokus-ring w-full rounded-kontrol border border-garis bg-permukaan px-4 py-3 text-[15px]" />
        </Field>
        {galat && <BannerGalat>{galat}</BannerGalat>}
        <div className="flex justify-end gap-3">
          <Tombol varian="sekunder" onClick={onTutup}>Batal</Tombol>
          <Tombol onClick={kirim} memproses={menyimpan} disabled={!valid || !berubah}>Simpan koreksi</Tombol>
        </div>
      </div>
    </Laci>
  )
}

function LaciTambah({ awal, karyawan, jadwal, hariIni, onTutup }: {
  awal: { karyawanId?: string; tanggal?: string }
  karyawan: Karyawan[]
  jadwal: (t: string) => { jam_masuk: string; jam_pulang: string } | null
  hariIni: string
  onTutup: () => void
}) {
  const [karyawanId, setKaryawanId] = useState(awal.karyawanId ?? '')
  const [tanggal, setTanggal] = useState(awal.tanggal ?? hariIni)
  const j = jadwal(tanggal)
  const [masuk, setMasuk] = useState(j?.jam_masuk.slice(0, 5) ?? '07:00')
  const [keluar, setKeluar] = useState(j?.jam_pulang.slice(0, 5) ?? '15:00')
  const [alasan, setAlasan] = useState('')
  const [galat, setGalat] = useState<string | null>(null)
  const [menyimpan, setMenyimpan] = useState(false)
  const simpan = useSimpanAbsensi(onTutup)
  const k = karyawan.find((x) => x.id === karyawanId)
  const belumMulai = !!k?.tanggal_masuk && tanggal < k.tanggal_masuk
  const valid = !!karyawanId && !!tanggal && tanggal <= hariIni && jamValid(masuk) && jamValid(keluar) && keluar >= masuk && !belumMulai

  const kirim = async () => {
    if (!alasan.trim()) return setGalat('Alasan koreksi wajib diisi agar tercatat di Log audit.')
    setMenyimpan(true)
    const g = await simpan(
      () => supabase.from('absensi').insert({ pengguna_id: karyawanId, tanggal, jam_masuk: keIso(tanggal, masuk), jam_keluar: keIso(tanggal, keluar), alasan_koreksi: alasan.trim() }).setHeader(HEADER_ALASAN, kodeAlasan(alasan)),
      `Absensi manual ${k?.nama ?? ''} ${tanggalPanjang(dariTanggalDb(tanggal))} disimpan · tercatat di Log audit.`,
    )
    setMenyimpan(false)
    setGalat(g)
  }

  return (
    <Laci judul="Tambah absensi manual" subjudul="Untuk karyawan yang tidak tercatat clock in / clock out" onTutup={onTutup}>
      <div className="flex flex-col gap-5">
        <Field id="tambah-karyawan" label="Karyawan" wajib galat={belumMulai ? `Belum mulai bekerja pada tanggal ini (mulai ${tanggalPanjang(dariTanggalDb(k!.tanggal_masuk!))}).` : undefined}>
          <select id="tambah-karyawan" value={karyawanId} onChange={(e) => setKaryawanId(e.target.value)} className={kelasKontrol}>
            <option value="">Pilih karyawan</option>
            {karyawan.filter((x) => x.aktif).map((x) => <option key={x.id} value={x.id}>{x.nama}{x.jabatan ? ` · ${x.jabatan}` : ''}</option>)}
          </select>
        </Field>
        <Field id="tambah-tanggal" label="Tanggal" wajib bantuan={j ? `Jadwal hari itu: ${j.jam_masuk.slice(0, 5)} – ${j.jam_pulang.slice(0, 5)} WIB` : 'Hari libur — tidak ada jadwal kerja.'}>
          <Input id="tambah-tanggal" type="date" value={tanggal} max={hariIni} onChange={(e) => setTanggal(e.target.value > hariIni ? hariIni : e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field id="tambah-masuk" label="Jam masuk" wajib><IsianJam id="tambah-masuk" label="Jam masuk" nilai={masuk} onUbah={setMasuk} galat={!jamValid(masuk)} /></Field>
          <Field id="tambah-keluar" label="Jam keluar" wajib galat={jamValid(masuk) && jamValid(keluar) && keluar < masuk ? 'Jam keluar sebelum jam masuk.' : undefined}>
            <IsianJam id="tambah-keluar" label="Jam keluar" nilai={keluar} onUbah={setKeluar} galat={!jamValid(keluar) || keluar < masuk} />
          </Field>
        </div>
        <p className="rounded-kontrol bg-latar p-3 text-sm text-teks-sekunder">Absensi manual tidak memiliki foto selfie dan otomatis ditandai <strong className="font-semibold text-teks">Dikoreksi HR</strong>.</p>
        <Field id="alasan-tambah" label="Alasan koreksi" wajib bantuan="Perubahan dicatat di Log audit atas nama Anda.">
          <textarea id="alasan-tambah" rows={3} value={alasan} onChange={(e) => setAlasan(e.target.value)} placeholder="Contoh: HP rusak, clock in dicatat manual atas konfirmasi atasan." className="fokus-ring w-full rounded-kontrol border border-garis bg-permukaan px-4 py-3 text-[15px] placeholder:text-teks-3" />
        </Field>
        {galat && <BannerGalat>{galat}</BannerGalat>}
        <div className="flex justify-end gap-3">
          <Tombol varian="sekunder" onClick={onTutup}>Batal</Tombol>
          <Tombol onClick={kirim} memproses={menyimpan} disabled={!valid}>Simpan absensi</Tombol>
        </div>
      </div>
    </Laci>
  )
}

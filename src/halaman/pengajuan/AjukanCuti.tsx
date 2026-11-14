// LV-01–03, LV-05 — Ajukan cuti / sakit / izin (B1 hal 29 normal, hal 30 saldo tidak cukup).
// Hitungan & aturan dicerminkan di form; penentu akhir RPC ajukan_cuti. Lampiran diunggah dulu, dihapus lagi bila
// pengajuan ditolak server (policy lampiran_hapus_yatim).
import { useEffect, useState, type ReactNode } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate } from 'react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, CircleAlert, FileText, Upload, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useProfil } from '../../auth/sesi'
import { dariTanggalDb, hariIniDb, tanggalPanjang } from '../../lib/format'
import { tambahHari } from '../../lib/absensi'
import { hariKerjaKe, hariKerjaMundur, ringkasCuti, type JenisCuti, type Kalender } from '../../lib/pengajuan'
import { siapkanLampiran, ukuranFile } from '../../lib/lampiran'
import { BannerGalat, Field, Input, Tombol } from '../../komponen/form'
import { KeadaanGalat, Skeleton } from '../../komponen/keadaan'
import { useToast } from '../../komponen/toast'

const skema = z.object({
  jenis: z.enum(['cuti', 'sakit', 'izin']),
  mulai: z.string().min(1, 'Tanggal mulai wajib diisi.'),
  selesai: z.string().min(1, 'Tanggal selesai wajib diisi.'),
  alasan: z.string().trim().min(1, 'Alasan wajib diisi.').max(500, 'Alasan maksimal 500 karakter.'),
})
type Isian = z.infer<typeof skema>

/** Saldo tersedia (saldo − cuti yang masih menunggu, sama dengan cek server) + kalender kerja. */
function useDataCuti() {
  const id = useProfil().data!.id
  const hariIni = hariIniDb()
  return useQuery({
    queryKey: ['data_cuti', id],
    queryFn: async () => {
      const [saya, menunggu, jadwal, libur] = await Promise.all([
        supabase.from('pengguna').select('saldo_cuti').eq('id', id).single(),
        supabase.from('pengajuan_cuti').select('jumlah_hari').eq('pengguna_id', id).eq('jenis', 'cuti').eq('status', 'menunggu'),
        supabase.from('jadwal_kerja').select('hari'),
        supabase.from('hari_libur').select('tanggal, keterangan').gte('tanggal', tambahHari(hariIni, -45)),
      ])
      for (const r of [saya, menunggu, jadwal, libur]) if (r.error) throw r.error
      const saldo = (saya.data as { saldo_cuti: number | null }).saldo_cuti ?? 0
      const ditahan = (menunggu.data as { jumlah_hari: number }[]).reduce((n, c) => n + c.jumlah_hari, 0)
      const kalender: Kalender = {
        hariKerja: new Set((jadwal.data as { hari: number }[]).map((j) => j.hari)),
        libur: new Map((libur.data as { tanggal: string; keterangan: string }[]).map((l) => [l.tanggal, l.keterangan])),
      }
      return { saldo, ditahan, sisa: Math.max(0, saldo - ditahan), kalender }
    },
  })
}

export default function AjukanCuti() {
  const q = useDataCuti()
  const kembali = (
    <Link to="/pengajuan?tab=cuti" className="fokus-ring -ml-2 inline-flex min-h-11 items-center gap-1 rounded-kontrol px-2 text-[15px] font-semibold text-primer">
      <ChevronLeft className="size-5" aria-hidden /> Pengajuan
    </Link>
  )
  if (q.isPending) return <>{kembali}<Skeleton baris={6} /></>
  if (q.isError) return <>{kembali}<KeadaanGalat judul="Data saldo & kalender gagal dimuat" onCobaLagi={() => q.refetch()} /></>
  return <Form data={q.data} kembali={kembali} />
}

type Lampiran = { blob: Blob; ext: string; nama: string }

function Form({ data, kembali }: { data: NonNullable<ReturnType<typeof useDataCuti>['data']>; kembali: ReactNode }) {
  const hariIni = hariIniDb()
  const uid = useProfil().data!.id
  const navigate = useNavigate()
  const toast = useToast()
  const qc = useQueryClient()
  const [galatServer, setGalatServer] = useState<string | null>(null)
  const [lampiran, setLampiran] = useState<Lampiran | null>(null)
  const [galatLampiran, setGalatLampiran] = useState<string | null>(null)
  const [menyiapkan, setMenyiapkan] = useState(false)
  const { register, handleSubmit, setValue, control, formState: { errors, isSubmitting } } =
    useForm<Isian>({ resolver: zodResolver(skema), defaultValues: { jenis: 'cuti', mulai: hariIni, selesai: hariIni, alasan: '' } })
  const [jenis, mulai, selesai] = useWatch({ control, name: ['jenis', 'mulai', 'selesai'] })

  // Tanggal selesai mengikuti bila tanggal mulai digeser melewatinya
  useEffect(() => {
    if (mulai && selesai < mulai) setValue('selesai', mulai)
  }, [mulai, selesai, setValue])

  const paling = jenis === 'sakit' ? hariKerjaMundur(hariIni, 3, data.kalender) : hariIni
  const label = { cuti: 'cuti', sakit: 'sakit', izin: 'izin' }[jenis as JenisCuti]
  const galatMulai = errors.mulai?.message ?? (mulai && mulai < paling
    ? (jenis === 'sakit' ? `Pengajuan sakit paling lambat 3 hari kerja setelahnya (mulai ${tanggalPanjang(dariTanggalDb(paling))}).` : `Tanggal mulai ${label} tidak boleh sebelum hari ini.`)
    : undefined)
  const galatSelesai = errors.selesai?.message ?? (selesai && mulai && selesai.slice(0, 4) !== mulai.slice(0, 4)
    ? 'Tidak boleh melewati pergantian tahun — ajukan terpisah per tahun.' : undefined)
  const tanggalOk = !!mulai && !!selesai && selesai >= mulai && !galatMulai && !galatSelesai
  const r = tanggalOk ? ringkasCuti(mulai, selesai, data.kalender) : null
  const kurang = jenis === 'cuti' && r ? r.jumlah > data.sisa : false
  const batas = kurang ? hariKerjaKe(mulai, data.sisa, data.kalender) : null

  const pilihFile = async (file: File | undefined) => {
    setGalatLampiran(null)
    if (!file) return
    setMenyiapkan(true)
    try {
      setLampiran({ ...(await siapkanLampiran(file)), nama: file.name })
    } catch (e) {
      setGalatLampiran((e as Error).message)
    } finally {
      setMenyiapkan(false)
    }
  }

  const kirim = handleSubmit(async (v) => {
    setGalatServer(null)
    if (!r || !r.jumlah || kurang) return
    let path: string | null = null
    if (lampiran) {
      path = `${uid}/${crypto.randomUUID()}.${lampiran.ext}`
      const { error } = await supabase.storage.from('lampiran').upload(path, lampiran.blob, { contentType: lampiran.blob.type || undefined })
      if (error) return setGalatServer('Lampiran gagal diunggah. Periksa koneksi Anda, lalu coba lagi.')
    }
    const { data: hasil, error } = await supabase.rpc('ajukan_cuti', { jenis: v.jenis, tanggal_mulai: v.mulai, tanggal_selesai: v.selesai, alasan: v.alasan, lampiran_path: path })
    if (error) {
      if (path) await supabase.storage.from('lampiran').remove([path]) // jangan tinggalkan file yatim
      return setGalatServer(['23514', '23505', '42501'].includes(error.code) ? error.message : 'Pengajuan gagal dikirim. Periksa koneksi Anda, lalu coba lagi.')
    }
    await Promise.all([qc.invalidateQueries({ queryKey: ['pengajuan', 'cuti'] }), qc.invalidateQueries({ queryKey: ['data_cuti'] })])
    toast(`Pengajuan ${label} terkirim.`)
    navigate(`/pengajuan/cuti/${(hasil as { id: string }).id}`, { replace: true })
  })

  return (
    <div>
      {kembali}
      <h1 className="mt-2 text-[22px] leading-7 font-semibold">Ajukan cuti / sakit / izin</h1>
      <form onSubmit={kirim} noValidate className="mt-4 flex flex-col gap-4">
        {galatServer && <BannerGalat>{galatServer}</BannerGalat>}
        <div role="radiogroup" aria-label="Jenis pengajuan" className="grid grid-cols-3 gap-1 rounded-kartu bg-latar p-1">
          {(['cuti', 'sakit', 'izin'] as const).map((j) => (
            <label key={j} className={`fokus-ring flex h-11 cursor-pointer items-center justify-center rounded-kontrol text-[15px] font-semibold has-focus-visible:ring-2 ${jenis === j ? 'bg-permukaan text-teks shadow-sm' : 'text-teks-sekunder'}`}>
              <input type="radio" value={j} className="sr-only" {...register('jenis')} />
              {j[0].toUpperCase() + j.slice(1)}
            </label>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field id="mulai" label="Tanggal mulai" wajib galat={galatMulai}>
            {/* Safari iOS mengabaikan min — dicek juga di atas & di server */}
            <Input id="mulai" type="date" min={paling} galat={!!galatMulai} {...register('mulai')} />
          </Field>
          <Field id="selesai" label="Tanggal selesai" wajib galat={galatSelesai}>
            <Input id="selesai" type="date" min={mulai} galat={!!galatSelesai} {...register('selesai')} />
          </Field>
        </div>

        {r && (
          <div className="overflow-hidden rounded-kartu border border-garis bg-permukaan">
            <dl className={`grid ${jenis === 'cuti' ? 'grid-cols-2 divide-x divide-garis' : ''} border-b border-garis`}>
              <div className="bg-latar px-4 py-3">
                <dt className="text-sm text-teks-sekunder">Jumlah hari kerja</dt>
                <dd className="text-[22px] font-bold tabular-nums">{r.jumlah} hari</dd>
              </div>
              {jenis === 'cuti' && (
                <div className="px-4 py-3">
                  <dt className="text-sm text-teks-sekunder">Sisa saldo cuti</dt>
                  <dd className={`text-[22px] font-bold tabular-nums ${kurang ? 'text-bahaya' : ''}`}>{data.sisa} hari</dd>
                </div>
              )}
            </dl>
            <p className="px-4 py-3 text-sm text-teks-sekunder">
              Senin–Sabtu.{r.tidakDihitung.length > 0 && ` Tidak dihitung: ${r.tidakDihitung.join(', ')}.`}
              {jenis === 'cuti' && !kurang && ` Sisa setelah disetujui: ${data.sisa - r.jumlah} hari.`}
              {jenis === 'cuti' && data.ditahan > 0 && ` ${data.ditahan} hari lain masih menunggu persetujuan.`}
              {jenis !== 'cuti' && ` ${jenis === 'sakit' ? 'Sakit' : 'Izin'} tidak memotong saldo cuti.`}
            </p>
          </div>
        )}
        {r && r.jumlah === 0 && <BannerGalat>Rentang tanggal tidak berisi hari kerja.</BannerGalat>}
        {kurang && (
          <p role="alert" className="flex gap-3 rounded-kartu bg-bahaya-latar p-4 text-[15px] leading-[22px] text-bahaya">
            <CircleAlert className="mt-0.5 size-5 shrink-0 text-bahaya-ikon" aria-hidden />
            <span>
              <strong>Saldo cuti tidak cukup.</strong> Anda mengajukan {r!.jumlah} hari kerja, sisa saldo {data.sisa} hari.
              {batas ? ` Ubah tanggal selesai paling lambat ${tanggalPanjang(dariTanggalDb(batas))}.` : ' Ajukan sebagai izin atau hubungi HR.'}
            </span>
          </p>
        )}

        <Field id="alasan" label="Alasan" wajib galat={errors.alasan?.message}>
          <textarea id="alasan" rows={3} maxLength={500} aria-invalid={!!errors.alasan} {...register('alasan')}
            placeholder={jenis === 'sakit' ? 'Contoh: Demam, istirahat sesuai surat dokter.' : 'Contoh: Acara keluarga di luar kota.'}
            className={`fokus-ring w-full rounded-kontrol border bg-permukaan px-4 py-3 text-[15px] placeholder:text-teks-3 ${errors.alasan ? 'border-bahaya-ikon' : 'border-garis'}`} />
        </Field>

        <div>
          <p className="text-sm leading-5 font-medium">Lampiran <span className="font-normal text-teks-sekunder">(opsional)</span></p>
          {lampiran ? (
            <div className="mt-2 flex items-center gap-3 rounded-kartu border border-garis bg-permukaan px-4 py-3">
              <FileText className="size-5 shrink-0 text-primer" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-semibold">{lampiran.nama}</span>
                <span className="block text-sm text-teks-sekunder">{ukuranFile(lampiran.blob.size)}</span>
              </span>
              <button type="button" onClick={() => setLampiran(null)} aria-label="Hapus lampiran" className="fokus-ring flex size-11 items-center justify-center rounded-kontrol text-teks-sekunder">
                <X className="size-5" aria-hidden />
              </button>
            </div>
          ) : (
            <label className="fokus-ring mt-2 flex min-h-16 cursor-pointer items-center justify-center gap-2 rounded-kartu border-2 border-dashed border-garis bg-latar px-4 text-[15px] has-focus-visible:ring-2">
              <input type="file" accept="image/*,application/pdf" className="sr-only" onChange={(e) => { pilihFile(e.target.files?.[0]); e.target.value = '' }} />
              <Upload className="size-5 text-primer" aria-hidden />
              {menyiapkan ? <span className="text-teks-sekunder">Menyiapkan file…</span>
                : <span><span className="font-semibold text-primer">Pilih foto atau PDF</span><span className="text-teks-sekunder"> · maks. 5 MB</span></span>}
            </label>
          )}
          {galatLampiran && <p className="mt-2 flex items-center gap-1.5 text-sm text-bahaya"><CircleAlert className="size-4 shrink-0 text-bahaya-ikon" aria-hidden />{galatLampiran}</p>}
        </div>

        <Tombol type="submit" memproses={isSubmitting} disabled={menyiapkan || kurang || !r?.jumlah} className="mt-2">Ajukan</Tombol>
      </form>
    </div>
  )
}

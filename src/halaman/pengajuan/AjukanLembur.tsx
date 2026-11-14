// OT-01–03 — Ajukan lembur (B1 hal 36 hari kerja, hal 28 hari libur). Aturan dicek di form (cekLembur) agar
// pengguna tahu lebih awal; penentu akhir tetap RPC ajukan_lembur (waktu server).
import { useEffect, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate } from 'react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Info } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { dariTanggalDb, hariIniDb, tanggalPanjang } from '../../lib/format'
import { jamWib } from '../../lib/absensi'
import { jamValid, rapikanJam } from '../../lib/jadwal'
import { cekLembur, teksDurasi } from '../../lib/pengajuan'
import { BannerGalat, Field, Input, Tombol } from '../../komponen/form'
import { InputTanggal } from '../../komponen/inputKhusus'
import { useToast } from '../../komponen/toast'
import type { Jadwal } from '../absensi/data'

const jam = z.string().refine(jamValid, 'Isi jam format 24 jam, mis. 15:00.')
const skema = z.object({
  tanggal: z.string().min(1, 'Tanggal lembur wajib diisi.'),
  mulai: jam,
  selesai: jam,
  alasan: z.string().trim().min(1, 'Alasan wajib diisi.').max(500, 'Alasan maksimal 500 karakter.'),
})
type Isian = z.infer<typeof skema>

/** Jadwal & nama tanggal merah untuk satu tanggal. jadwal null = hari libur. */
function useHari(tanggal: string) {
  return useQuery({
    queryKey: ['hari', tanggal],
    enabled: /^\d{4}-\d{2}-\d{2}$/.test(tanggal),
    queryFn: async () => {
      const [jadwal, libur] = await Promise.all([
        supabase.rpc('jadwal_tanggal', { tgl: tanggal }),
        supabase.from('hari_libur').select('keterangan').eq('tanggal', tanggal).maybeSingle(),
      ])
      if (jadwal.error) throw jadwal.error
      if (libur.error) throw libur.error
      return { jadwal: ((jadwal.data as Jadwal[])[0] ?? null) as Jadwal | null, libur: (libur.data as { keterangan: string } | null)?.keterangan ?? null }
    },
  })
}

export default function AjukanLembur() {
  const hariIni = hariIniDb()
  const navigate = useNavigate()
  const toast = useToast()
  const qc = useQueryClient()
  const [galatServer, setGalatServer] = useState<string | null>(null)
  const { register, handleSubmit, setValue, control, getFieldState, formState: { errors, isSubmitting } } =
    useForm<Isian>({ resolver: zodResolver(skema), defaultValues: { tanggal: hariIni, mulai: '', selesai: '', alasan: '' } })
  const [tanggal, mulai, selesai] = useWatch({ control, name: ['tanggal', 'mulai', 'selesai'] })
  const hari = useHari(tanggal)
  const jadwal = hari.data?.jadwal ?? null

  // Hari kerja: jam mulai default = jam pulang, selama belum diubah pengguna
  useEffect(() => {
    if (jadwal && !getFieldState('mulai').isDirty) setValue('mulai', jadwal.jam_pulang.slice(0, 5))
  }, [jadwal, getFieldState, setValue])

  const lengkap = hari.data && jamValid(mulai) && jamValid(selesai)
  // oxlint-disable-next-line react/purity -- jam sekarang memang dibaca tiap render (batas waktu pengajuan)
  const jamSekarang = jamWib(new Date())
  const cek = hari.data
    ? cekLembur({ tanggal, mulai: jamValid(mulai) ? mulai : '00:00', selesai: jamValid(selesai) ? selesai : '00:00', jamPulang: jadwal?.jam_pulang ?? null, hariIni, jamSekarang })
    : null
  const galatTanggal = errors.tanggal?.message ?? cek?.galat.tanggal
  const galatMulai = errors.mulai?.message ?? (jamValid(mulai) ? cek?.galat.mulai : undefined)
  const galatSelesai = errors.selesai?.message ?? (lengkap ? cek?.galat.selesai : undefined)

  const kirim = handleSubmit(async (v) => {
    setGalatServer(null)
    if (!cek || Object.keys(cek.galat).length) return
    const { data, error } = await supabase.rpc('ajukan_lembur', { tanggal: v.tanggal, jam_mulai: v.mulai, jam_selesai: v.selesai, alasan: v.alasan })
    if (error) {
      // Pesan aturan dari database (23514/23505/42501) sudah ramah pengguna
      return setGalatServer(['23514', '23505', '42501'].includes(error.code) ? error.message : 'Pengajuan gagal dikirim. Periksa koneksi Anda, lalu coba lagi.')
    }
    await qc.invalidateQueries({ queryKey: ['pengajuan', 'lembur'] })
    toast('Pengajuan lembur terkirim.')
    navigate(`/pengajuan/lembur/${(data as { id: string }).id}`, { replace: true })
  })

  const kolomJam = (nama: 'mulai' | 'selesai', label: string, galat?: string) => (
    <Field id={nama} label={label} wajib galat={galat}>
      <Input id={nama} inputMode="numeric" placeholder="15:00" maxLength={5} galat={!!galat} className="tabular-nums"
        {...register(nama, { onBlur: (e) => setValue(nama, rapikanJam(e.target.value), { shouldDirty: true }) })} />
    </Field>
  )

  return (
    <div>
      <form onSubmit={kirim} noValidate className="flex flex-col gap-4">
        {hari.data && (
          <p className="flex gap-3 rounded-kartu bg-info-latar p-4 text-[15px] leading-[22px] text-info">
            <Info className="mt-0.5 size-5 shrink-0" aria-hidden />
            {jadwal
              ? `Pengajuan lembur paling lambat jam pulang (${jadwal.jam_pulang.slice(0, 5)}) di hari yang sama.`
              : 'Lembur hari libur diajukan paling lambat sebelum jam mulai lembur.'}
          </p>
        )}
        {galatServer && <BannerGalat>{galatServer}</BannerGalat>}

        <Field id="tanggal" label="Tanggal lembur" wajib galat={galatTanggal}
          bantuan={hari.isError ? 'Jadwal tanggal ini gagal dimuat — coba pilih ulang.'
            : hari.data && (jadwal
              ? `${tanggalPanjang(dariTanggalDb(tanggal))} · hari kerja ${jadwal.jam_masuk.slice(0, 5)}–${jadwal.jam_pulang.slice(0, 5)}`
              : `Hari libur (${hari.data.libur ?? 'Minggu'}) — dihitung sebagai lembur hari libur.`)}>
          {/* Safari iOS mengabaikan min — tanggal lampau juga ditolak cekLembur & server */}
          <InputTanggal id="tanggal" nilai={tanggal} min={hariIni} galat={!!galatTanggal} {...register('tanggal')} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          {kolomJam('mulai', 'Jam mulai', galatMulai)}
          {kolomJam('selesai', 'Jam selesai', galatSelesai)}
        </div>

        <div className="flex items-center justify-between rounded-kartu border border-garis bg-latar px-4 py-3">
          <span className="text-[15px] text-teks-sekunder">Estimasi durasi</span>
          <span className="text-[19px] font-bold tabular-nums">{lengkap && cek && cek.menit > 0 ? teksDurasi(cek.menit) : '—'}</span>
        </div>

        <Field id="alasan" label="Alasan" wajib galat={errors.alasan?.message}>
          <textarea id="alasan" rows={4} maxLength={500} placeholder="Contoh: Closing stok mingguan dan input faktur pemasok."
            aria-invalid={!!errors.alasan} {...register('alasan')}
            className={`fokus-ring w-full rounded-kontrol border bg-permukaan px-4 py-3 text-[15px] placeholder:text-teks-3 ${errors.alasan ? 'border-bahaya-ikon' : 'border-garis'}`} />
        </Field>

        <Tombol type="submit" memproses={isSubmitting} disabled={!hari.data} className="mt-2">Ajukan</Tombol>
      </form>
    </div>
  )
}

// MST-03 — B3C hal 15. Teks periode mengikuti tanggal cut-off.
import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { BannerGalat, Field, Input, Tombol } from '../../komponen/form'
import { KeadaanGalat, Skeleton } from '../../komponen/keadaan'
import { useToast } from '../../komponen/toast'

const bulat = (min: number, max: number, satuan = '') => {
  const s = satuan && ` ${satuan}`
  return z.number({ error: 'Wajib diisi.' }).int('Harus bilangan bulat.').min(min, `Minimal ${min}${s}.`).max(max, `Maksimal ${max}${s}.`)
}

const skema = z.object({ jatah_cuti_tahunan: bulat(0, 365, 'hari'), tanggal_cut_off: bulat(1, 28) })
type Isian = z.infer<typeof skema>

export default function Pengaturan() {
  const q = useQuery({
    queryKey: ['pengaturan'],
    queryFn: async () => {
      const { data, error } = await supabase.from('pengaturan').select('jatah_cuti_tahunan, tanggal_cut_off').single()
      if (error) throw error
      return data as Isian
    },
  })

  return (
    <section aria-labelledby="judul-pengaturan" className="max-w-[720px] rounded-kartu border border-garis bg-permukaan">
      <h2 id="judul-pengaturan" className="px-6 pt-5 text-[17px] leading-6 font-semibold">
        Cuti & payroll
      </h2>
      {q.isPending ? (
        <Skeleton baris={3} />
      ) : q.isError ? (
        <KeadaanGalat judul="Pengaturan gagal dimuat" onCobaLagi={() => q.refetch()} />
      ) : (
        <FormPengaturan awal={q.data} />
      )}
    </section>
  )
}

function FormPengaturan({ awal }: { awal: Isian }) {
  const qc = useQueryClient()
  const toast = useToast()
  const [galat, setGalat] = useState(false)
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<Isian>({ resolver: zodResolver(skema), defaultValues: awal })
  const cutOff = useWatch({ control, name: 'tanggal_cut_off' })

  const simpan = handleSubmit(async (v) => {
    setGalat(false)
    const { data, error } = await supabase.from('pengaturan').update(v).eq('id', 1).select('jatah_cuti_tahunan, tanggal_cut_off')
    if (error || !data.length) return setGalat(true)
    reset(data[0] as Isian)
    await qc.invalidateQueries({ queryKey: ['pengaturan'] })
    toast('Pengaturan disimpan.')
  })

  return (
    <form onSubmit={simpan} noValidate className="flex flex-col gap-5 px-6 pt-4 pb-5">
      {galat && <BannerGalat>Pengaturan gagal disimpan. Periksa koneksi Anda, lalu coba lagi.</BannerGalat>}
      <Field id="jatah" label="Jatah cuti tahunan" galat={errors.jatah_cuti_tahunan?.message}>
        <div className="flex items-center gap-3">
          <Input id="jatah" type="number" inputMode="numeric" min={0} max={365} className="w-[120px]" galat={!!errors.jatah_cuti_tahunan} {...register('jatah_cuti_tahunan', { valueAsNumber: true })} />
          <span className="text-[15px] text-teks-sekunder">hari per tahun</span>
        </div>
        <p className="mt-2 text-sm text-teks-sekunder">
          Saldo cuti direset setiap 1 Januari; sisa hangus. Karyawan baru mendapat jatah proporsional (bulan penuh tersisa).
        </p>
      </Field>
      <Field id="cutoff" label="Tanggal cut-off payroll" galat={errors.tanggal_cut_off?.message}>
        <div className="flex items-center gap-3">
          <Input id="cutoff" type="number" inputMode="numeric" min={1} max={28} className="w-[120px]" galat={!!errors.tanggal_cut_off} {...register('tanggal_cut_off', { valueAsNumber: true })} />
          <span className="text-[15px] text-teks-sekunder">setiap bulan</span>
        </div>
        {Number.isInteger(cutOff) && cutOff >= 1 && cutOff <= 28 && (
          <p className="mt-2 text-sm text-teks-sekunder">
            Periode {cutOff + 1} bulan lalu – {cutOff} bulan ini.
          </p>
        )}
      </Field>
      <div className="flex justify-end border-t border-garis pt-5">
        <Tombol type="submit" memproses={isSubmitting} disabled={!isDirty}>
          Simpan perubahan
        </Tombol>
      </div>
    </form>
  )
}

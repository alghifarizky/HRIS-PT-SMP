// MST-02 — B3C hal 12–14. Tambahan di luar desain (keputusan Al, 13 Nov 2026): isian & badge jenis
// (libur nasional / cuti bersama — PRD §6.7), dialog ubah memakai form tambah, konfirmasi hapus.
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { dariTanggalDb, namaHari, tahunIni, tanggalPendek } from '../../lib/format'
import { BannerGalat, Field, Input, Tombol } from '../../komponen/form'
import { Badge, KeadaanGalat, KeadaanKosong, Skeleton } from '../../komponen/keadaan'
import Dialog from '../../komponen/Dialog'
import { useToast } from '../../komponen/toast'

type Jenis = 'libur_nasional' | 'cuti_bersama'
type HariLiburBaris = { tanggal: string; jenis: Jenis; keterangan: string }

const JENIS: Record<Jenis, { label: string; nada: 'peringatan' | 'info' }> = {
  libur_nasional: { label: 'Libur nasional', nada: 'peringatan' },
  cuti_bersama: { label: 'Cuti bersama', nada: 'info' },
}

export default function HariLibur() {
  const [tahun, setTahun] = useState(tahunIni)
  const [form, setForm] = useState<{ awal?: HariLiburBaris } | null>(null)
  const [hapus, setHapus] = useState<HariLiburBaris | null>(null)

  const q = useQuery({
    queryKey: ['hari_libur', tahun],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('hari_libur')
        .select('tanggal, jenis, keterangan')
        .gte('tanggal', `${tahun}-01-01`)
        .lte('tanggal', `${tahun}-12-31`)
        .order('tanggal')
      if (error) throw error
      return data as HariLiburBaris[]
    },
  })

  const t0 = tahunIni()
  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <label className="flex items-center gap-3 text-[15px] text-teks-sekunder">
          Tahun
          <select
            value={tahun}
            onChange={(e) => setTahun(Number(e.target.value))}
            className="fokus-ring h-11 rounded-kontrol border border-garis bg-permukaan px-3 font-semibold text-teks"
          >
            {[t0 - 1, t0, t0 + 1].map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
        <Tombol onClick={() => setForm({})}>
          <Plus className="size-5" aria-hidden /> Tambah hari libur
        </Tombol>
      </div>

      <p className="mt-4 rounded-kontrol bg-info-latar px-4 py-2.5 text-[15px] text-info">
        Tambahkan hari raya keagamaan & cuti bersama sesuai SKB pemerintah tahun berjalan. Cuti bersama memotong saldo cuti karyawan.
      </p>

      <section aria-label={`Hari libur ${tahun}`} className="mt-4 rounded-kartu border border-garis bg-permukaan">
        {q.isPending ? (
          <Skeleton baris={5} />
        ) : q.isError ? (
          <KeadaanGalat judul="Hari libur gagal dimuat" onCobaLagi={() => q.refetch()} />
        ) : !q.data.length ? (
          <KeadaanKosong judul={`Belum ada hari libur di ${tahun}`} pesan="Tambahkan tanggal merah dan cuti bersama tahun ini." />
        ) : (
          <table className="w-full text-left text-[15px]">
            <thead className="bg-latar text-[13px] font-semibold tracking-wide text-teks-sekunder uppercase">
              <tr>
                <th scope="col" className="px-5 py-3">Tanggal</th>
                <th scope="col" className="px-5 py-3">Hari</th>
                <th scope="col" className="px-5 py-3">Jenis</th>
                <th scope="col" className="px-5 py-3">Keterangan</th>
                <th scope="col" className="px-5 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-garis">
              {q.data.map((h) => {
                const d = dariTanggalDb(h.tanggal)
                return (
                  <tr key={h.tanggal}>
                    <th scope="row" className="px-5 py-3 font-semibold tabular-nums">{tanggalPendek(d)}</th>
                    <td className="px-5 py-3 text-teks-sekunder">{namaHari(d)}</td>
                    <td className="px-5 py-3"><Badge nada={JENIS[h.jenis].nada}>{JENIS[h.jenis].label}</Badge></td>
                    <td className="px-5 py-3">{h.keterangan}</td>
                    <td className="px-3 py-1 text-right whitespace-nowrap">
                      <button type="button" onClick={() => setForm({ awal: h })} aria-label={`Ubah ${h.keterangan}, ${tanggalPendek(d)}`} className="fokus-ring inline-flex size-11 items-center justify-center rounded-kontrol text-teks-sekunder hover:bg-latar">
                        <Pencil className="size-5" aria-hidden />
                      </button>
                      <button type="button" onClick={() => setHapus(h)} aria-label={`Hapus ${h.keterangan}, ${tanggalPendek(d)}`} className="fokus-ring inline-flex size-11 items-center justify-center rounded-kontrol text-bahaya-ikon hover:bg-bahaya-latar">
                        <Trash2 className="size-5" aria-hidden />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </section>

      {form && <FormHariLibur awal={form.awal} onTutup={() => setForm(null)} onTersimpan={(t) => setTahun(Number(t.slice(0, 4)))} />}
      {hapus && <KonfirmasiHapus h={hapus} onTutup={() => setHapus(null)} />}
    </div>
  )
}

const skema = z.object({
  tanggal: z.string().min(1, 'Tanggal wajib diisi.'),
  jenis: z.enum(['libur_nasional', 'cuti_bersama']),
  keterangan: z.string().trim().min(1, 'Keterangan wajib diisi.').max(100, 'Keterangan maksimal 100 karakter.'),
})
type Isian = z.infer<typeof skema>

function FormHariLibur({ awal, onTutup, onTersimpan }: { awal?: HariLiburBaris; onTutup: () => void; onTersimpan: (tanggal: string) => void }) {
  const qc = useQueryClient()
  const toast = useToast()
  const [galat, setGalat] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Isian>({ resolver: zodResolver(skema), defaultValues: awal ?? { jenis: 'libur_nasional' } })

  const simpan = handleSubmit(async (v) => {
    setGalat(null)
    const { data, error } = awal
      ? await supabase.from('hari_libur').update(v).eq('tanggal', awal.tanggal).select('tanggal')
      : await supabase.from('hari_libur').insert(v).select('tanggal')
    if (error?.code === '23505') return setError('tanggal', { message: 'Tanggal ini sudah terdaftar.' })
    // RLS menolak UPDATE tanpa error — 0 baris berarti tidak tersimpan
    if (error || !data?.length) return setGalat('Hari libur gagal disimpan. Periksa koneksi Anda, lalu coba lagi.')
    await qc.invalidateQueries({ queryKey: ['hari_libur'] })
    toast(awal ? 'Hari libur diperbarui.' : 'Hari libur ditambahkan.')
    onTersimpan(v.tanggal)
    onTutup()
  })

  return (
    <Dialog judul={awal ? 'Ubah hari libur' : 'Tambah hari libur'} onTutup={onTutup}>
      <form onSubmit={simpan} noValidate className="flex flex-col gap-4">
        {galat && <BannerGalat>{galat}</BannerGalat>}
        <Field id="tanggal" label="Tanggal" galat={errors.tanggal?.message}>
          <Input id="tanggal" type="date" galat={!!errors.tanggal} {...register('tanggal')} />
        </Field>
        <fieldset>
          <legend className="text-sm leading-5 font-medium">Jenis</legend>
          <div className="mt-2 grid grid-cols-2 gap-1 rounded-kontrol bg-latar p-1">
            {(Object.keys(JENIS) as Jenis[]).map((j) => (
              <label key={j} className="relative">
                <input type="radio" value={j} {...register('jenis')} className="peer sr-only" />
                <span className="flex h-10 cursor-pointer items-center justify-center rounded-[6px] text-[15px] text-teks-sekunder peer-checked:bg-permukaan peer-checked:font-semibold peer-checked:text-teks peer-checked:shadow-sm peer-focus-visible:ring-3 peer-focus-visible:ring-primer-100">
                  {JENIS[j].label}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <Field id="keterangan" label="Keterangan" galat={errors.keterangan?.message}>
          <Input id="keterangan" placeholder="Contoh: Hari Raya Idulfitri" galat={!!errors.keterangan} {...register('keterangan')} />
        </Field>
        <div className="mt-2 flex justify-end gap-3">
          <Tombol varian="sekunder" onClick={onTutup}>
            Batal
          </Tombol>
          <Tombol type="submit" memproses={isSubmitting}>
            Simpan
          </Tombol>
        </div>
      </form>
    </Dialog>
  )
}

function KonfirmasiHapus({ h, onTutup }: { h: HariLiburBaris; onTutup: () => void }) {
  const qc = useQueryClient()
  const toast = useToast()
  const tgl = tanggalPendek(dariTanggalDb(h.tanggal))
  const m = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.from('hari_libur').delete().eq('tanggal', h.tanggal).select('tanggal')
      if (error) throw error
      if (!data.length) throw new Error('tanpa izin')
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['hari_libur'] })
      toast('Hari libur dihapus.')
      onTutup()
    },
  })

  return (
    <Dialog judul={`Hapus hari libur ${tgl}?`} onTutup={onTutup}>
      <p className="text-[15px] leading-[22px] text-teks-sekunder">
        <strong className="font-semibold text-teks">{h.keterangan}</strong> ({JENIS[h.jenis].label.toLowerCase()}) akan dihapus. Tindakan ini tercatat di Log audit.
      </p>
      {m.isError && (
        <div className="mt-4">
          <BannerGalat>Hari libur gagal dihapus. Periksa koneksi Anda, lalu coba lagi.</BannerGalat>
        </div>
      )}
      <div className="mt-6 flex justify-end gap-3">
        <Tombol varian="sekunder" onClick={onTutup}>
          Batal
        </Tombol>
        <Tombol varian="bahaya" onClick={() => m.mutate()} memproses={m.isPending}>
          Ya, hapus
        </Tombol>
      </div>
    </Dialog>
  )
}

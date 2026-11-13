// EMP-02/03 — desain B3A hal 8 (form), 9 (galat validasi), 10 (menyimpan), 11 (sukses).
// Label "Email kantor" → "Email" (karyawan memakai email pribadi — keputusan Al, 13 Nov 2026).
// Pilihan atasan: peran Karyawan → pengguna aktif berperan Atasan; Atasan/HR → Direksi (opsional).
import { useEffect, useState, type ReactNode } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate } from 'react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CircleAlert } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { skemaEmail } from '../../lib/validasi'
import { jatahProporsional } from '../../lib/cuti'
import { dariTanggalDb, hariIniDb, tahunIni, tanggalPendek } from '../../lib/format'
import { LABEL_PERAN } from '../../navigasi'
import { Field, Input, Tombol } from '../../komponen/form'
import { InputKtp, InputRupiah } from '../../komponen/inputKhusus'
import { useToast } from '../../komponen/toast'
import { useDaftarKaryawan } from './data'

const kelasSelect = 'fokus-ring h-12 w-full rounded-kontrol border bg-permukaan px-3 text-[15px] lg:h-11'

const skema = z
  .object({
    email: skemaEmail,
    role: z.enum(['karyawan', 'atasan', 'hr']),
    atasan_id: z.string(),
    nama: z.string().trim().min(1, 'Nama lengkap wajib diisi.').max(100, 'Maksimal 100 karakter.'),
    tanggal_lahir: z.string(),
    no_ktp: z.string(),
    status_menikah: z.enum(['belum_menikah', 'menikah']),
    jumlah_tanggungan: z.number({ error: 'Wajib diisi.' }).int('Harus bilangan bulat.').min(0, 'Minimal 0.').max(20, 'Maksimal 20.'),
    alamat: z.string().trim().max(300, 'Maksimal 300 karakter.'),
    nik: z.string().trim().min(1, 'NIK karyawan wajib diisi.').max(30, 'Maksimal 30 karakter.'),
    jabatan: z.string().trim().min(1, 'Jabatan wajib diisi.').max(100, 'Maksimal 100 karakter.'),
    tanggal_masuk: z.string().min(1, 'Tanggal masuk wajib diisi.'),
    gaji_pokok: z.number({ error: 'Gaji pokok wajib diisi.' }).min(0, 'Minimal Rp 0.').max(999_999_999_999, 'Nominal terlalu besar.'),
  })
  .superRefine((v, ctx) => {
    if (v.role === 'karyawan' && !v.atasan_id)
      ctx.addIssue({ code: 'custom', path: ['atasan_id'], message: 'Atasan langsung wajib diisi untuk peran Karyawan.' })
    if (v.no_ktp && v.no_ktp.length !== 16)
      ctx.addIssue({ code: 'custom', path: ['no_ktp'], message: `No. KTP harus 16 digit angka (terisi ${v.no_ktp.length}).` })
  })
type Isian = z.infer<typeof skema>

const LABEL_ISIAN: Record<keyof Isian, string> = {
  email: 'email', role: 'peran', atasan_id: 'atasan langsung', nama: 'nama lengkap', tanggal_lahir: 'tanggal lahir',
  no_ktp: 'No. KTP', status_menikah: 'status menikah', jumlah_tanggungan: 'jumlah tanggungan', alamat: 'alamat',
  nik: 'NIK karyawan', jabatan: 'jabatan', tanggal_masuk: 'tanggal masuk', gaji_pokok: 'gaji pokok',
}
const daftarKalimat = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')}${xs.length > 2 ? ',' : ''} dan ${xs.at(-1)}`)
const kosongJadiNull = (s: string) => (s.trim() ? s.trim() : null)

export default function TambahKaryawan() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const toast = useToast()
  const [galat, setGalat] = useState<string | null>(null)
  const daftar = useDaftarKaryawan()
  const pengaturan = useQuery({
    queryKey: ['pengaturan'],
    queryFn: async () => {
      const { data, error } = await supabase.from('pengaturan').select('jatah_cuti_tahunan, tanggal_cut_off').single()
      if (error) throw error
      return data as { jatah_cuti_tahunan: number; tanggal_cut_off: number }
    },
  })

  const {
    register,
    control,
    handleSubmit,
    setValue,
    setError,
    getFieldState,
    formState: { errors, isSubmitting, submitCount },
  } = useForm<Isian>({
    resolver: zodResolver(skema),
    defaultValues: {
      email: '', role: 'karyawan', atasan_id: '', nama: '', tanggal_lahir: '', no_ktp: '', status_menikah: 'belum_menikah',
      jumlah_tanggungan: 0, alamat: '', nik: '', jabatan: '', tanggal_masuk: '', gaji_pokok: NaN,
    },
  })
  const [role, tanggalMasuk] = useWatch({ control, name: ['role', 'tanggal_masuk'] })

  // Usulan NIK mengikuti tahun masuk; tidak menimpa NIK yang sudah diketik HR
  const tahunMasuk = tanggalMasuk ? Number(tanggalMasuk.slice(0, 4)) : tahunIni()
  const usulan = useQuery({
    queryKey: ['usulan_nik', tahunMasuk],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('usulan_nik', { tahun_masuk: tahunMasuk })
      if (error) throw error
      return data as string
    },
  })
  useEffect(() => {
    if (usulan.data && !getFieldState('nik').isDirty) setValue('nik', usulan.data)
  }, [usulan.data, getFieldState, setValue])

  const pilihanAtasan = (daftar.data ?? []).filter((k) => k.aktif && k.role === (role === 'karyawan' ? 'atasan' : 'direksi'))

  const simpan = handleSubmit(async (v) => {
    setGalat(null)
    const data = {
      email: v.email, nama: v.nama, role: v.role, atasan_id: kosongJadiNull(v.atasan_id), nik: v.nik, jabatan: v.jabatan,
      tanggal_lahir: kosongJadiNull(v.tanggal_lahir), alamat: kosongJadiNull(v.alamat), tanggal_masuk: v.tanggal_masuk,
      no_ktp: kosongJadiNull(v.no_ktp), status_menikah: v.status_menikah, jumlah_tanggungan: v.jumlah_tanggungan, gaji_pokok: v.gaji_pokok,
    }
    const { error } = await supabase.functions.invoke('akun', {
      body: { aksi: 'undang', redirectTo: `${window.location.origin}/atur-password`, data },
    })
    if (error) {
      const isi = await (error as { context?: Response }).context?.json?.().catch(() => null)
      const pesan: string = isi?.galat ?? 'Karyawan gagal disimpan. Periksa koneksi Anda, lalu coba lagi.'
      if (pesan.startsWith('Email')) return setError('email', { message: pesan }, { shouldFocus: true })
      if (pesan.startsWith('NIK')) return setError('nik', { message: pesan }, { shouldFocus: true })
      return setGalat(pesan)
    }
    await qc.invalidateQueries({ queryKey: ['karyawan'] })
    qc.removeQueries({ queryKey: ['usulan_nik'] })
    toast(`${v.nama} ditambahkan. Undangan dikirim ke ${v.email}.`)
    navigate('/panel/karyawan')
  })

  const isianSalah = (Object.keys(errors) as (keyof Isian)[]).map((k) => LABEL_ISIAN[k])
  const saldo = tanggalMasuk && pengaturan.data ? jatahProporsional(pengaturan.data.jatah_cuti_tahunan, tanggalMasuk, hariIniDb()) : null
  const tahun = tahunIni()

  return (
    <div>
      <nav aria-label="Breadcrumb" className="text-sm text-teks-sekunder">
        <Link to="/panel/karyawan" className="fokus-ring rounded text-primer hover:underline">Karyawan</Link> › Tambah karyawan
      </nav>
      <h1 className="mt-2 text-[28px] leading-[34px] font-semibold">Tambah karyawan</h1>
      <p className="mt-1 text-[15px] text-teks-sekunder">
        Isian bertanda <span className="text-bahaya-ikon">*</span> wajib diisi.
      </p>

      {(galat || (submitCount > 0 && isianSalah.length > 0)) && (
        <div role="alert" className="mt-6 flex gap-3 rounded-kartu bg-bahaya-latar p-4 text-[15px] text-bahaya">
          <CircleAlert className="mt-0.5 size-5 shrink-0 text-bahaya-ikon" aria-hidden />
          <span>
            {galat ?? (
              <>
                <strong className="font-semibold">{isianSalah.length} isian perlu diperbaiki</strong> sebelum disimpan: {daftarKalimat(isianSalah)}.
              </>
            )}
          </span>
        </div>
      )}

      <form onSubmit={simpan} noValidate className="mt-6 grid grid-cols-[1fr_336px] items-start gap-6">
        <div className="flex flex-col gap-6">
          <Bagian judul="Akun">
            <Field id="email" label="Email" wajib galat={errors.email?.message} bantuan="Undangan untuk membuat password dikirim ke email ini.">
              <Input id="email" type="email" autoComplete="off" placeholder="nama@gmail.com" galat={!!errors.email} {...register('email')} />
            </Field>
            <Field id="role" label="Peran" wajib>
              <select id="role" className={`${kelasSelect} border-garis`} {...register('role', { onChange: () => setValue('atasan_id', '') })}>
                {(['karyawan', 'atasan', 'hr'] as const).map((r) => (
                  <option key={r} value={r}>{LABEL_PERAN[r]}</option>
                ))}
              </select>
            </Field>
            <Field id="atasan_id" label="Atasan langsung" wajib={role === 'karyawan'} galat={errors.atasan_id?.message}>
              <select id="atasan_id" aria-invalid={!!errors.atasan_id || undefined} className={`${kelasSelect} ${errors.atasan_id ? 'border-bahaya-ikon' : 'border-garis'}`} {...register('atasan_id')}>
                <option value="">{role === 'karyawan' ? 'Pilih atasan langsung' : 'Tanpa atasan'}</option>
                {pilihanAtasan.map((a) => (
                  <option key={a.id} value={a.id}>{a.nama}{a.jabatan ? ` · ${a.jabatan}` : ''}</option>
                ))}
              </select>
            </Field>
          </Bagian>

          <Bagian judul="Data pribadi">
            <Field id="nama" label="Nama lengkap" wajib galat={errors.nama?.message}>
              <Input id="nama" autoComplete="off" galat={!!errors.nama} {...register('nama')} />
            </Field>
            <Field id="tanggal_lahir" label="Tanggal lahir">
              <Input id="tanggal_lahir" type="date" {...register('tanggal_lahir')} />
            </Field>
            <Field id="no_ktp" label="No. KTP" galat={errors.no_ktp?.message} bantuan="Selalu ditampilkan tersamar. Hanya HR & Direksi yang dapat melihat nomor lengkap.">
              <Controller name="no_ktp" control={control} render={({ field }) => <InputKtp id="no_ktp" nilai={field.value} onUbah={field.onChange} onBlur={field.onBlur} galat={!!errors.no_ktp} />} />
            </Field>
            <Field id="status_menikah" label="Status menikah">
              <select id="status_menikah" className={`${kelasSelect} border-garis`} {...register('status_menikah')}>
                <option value="belum_menikah">Belum menikah</option>
                <option value="menikah">Menikah</option>
              </select>
            </Field>
            <Field id="jumlah_tanggungan" label="Jumlah tanggungan" galat={errors.jumlah_tanggungan?.message}>
              <Input id="jumlah_tanggungan" type="number" inputMode="numeric" min={0} max={20} galat={!!errors.jumlah_tanggungan} {...register('jumlah_tanggungan', { valueAsNumber: true })} />
            </Field>
            <div className="col-span-3">
              <Field id="alamat" label="Alamat" galat={errors.alamat?.message}>
                <textarea id="alamat" rows={3} className="fokus-ring w-full rounded-kontrol border border-garis bg-permukaan px-4 py-3 text-[15px]" {...register('alamat')} />
              </Field>
            </div>
          </Bagian>

          <Bagian judul="Kepegawaian">
            <Field id="nik" label="NIK karyawan" wajib galat={errors.nik?.message} bantuan="Diusulkan otomatis, boleh diubah.">
              <Input id="nik" autoComplete="off" galat={!!errors.nik} className="tabular-nums" {...register('nik')} />
            </Field>
            <Field id="jabatan" label="Jabatan" wajib galat={errors.jabatan?.message}>
              <Input id="jabatan" autoComplete="off" galat={!!errors.jabatan} {...register('jabatan')} />
            </Field>
            <Field id="tanggal_masuk" label="Tanggal masuk" wajib galat={errors.tanggal_masuk?.message}>
              <Input id="tanggal_masuk" type="date" galat={!!errors.tanggal_masuk} {...register('tanggal_masuk')} />
            </Field>
            <Field id="gaji_pokok" label="Gaji pokok" wajib galat={errors.gaji_pokok?.message}>
              <Controller name="gaji_pokok" control={control} render={({ field }) => <InputRupiah id="gaji_pokok" nilai={field.value} onUbah={field.onChange} onBlur={field.onBlur} galat={!!errors.gaji_pokok} />} />
            </Field>
          </Bagian>

          <div className="flex justify-end gap-3">
            <Tombol varian="sekunder" onClick={() => navigate('/panel/karyawan')}>Batal</Tombol>
            <Tombol type="submit" memproses={isSubmitting}>Simpan & kirim undangan</Tombol>
          </div>
        </div>

        <aside className="flex flex-col gap-4">
          <div className="rounded-kartu border border-garis bg-permukaan p-5">
            <h2 className="text-[17px] leading-6 font-semibold">Saldo cuti (otomatis)</h2>
            {saldo ? (
              <>
                <p className="mt-1 text-[15px] text-teks-sekunder">
                  Masuk {tanggalPendek(dariTanggalDb(tanggalMasuk))} → jatah {tahun}
                </p>
                <p className="mt-2 text-[28px] leading-[34px] font-bold tabular-nums">{saldo.hari} hari</p>
                <p className="mt-2 text-sm text-teks-sekunder">
                  {saldo.jenis === 'penuh' && 'Masuk sebelum tahun ini — jatah penuh.'}
                  {saldo.jenis === 'tahun_depan' && `Mulai bekerja tahun depan — jatah ${tahun + 1} diberikan saat reset 1 Januari.`}
                  {saldo.jenis === 'proporsional' &&
                    `Bulan penuh tersisa: ${saldo.bulan.length ? daftarKalimat(saldo.bulan) : 'tidak ada'}. Mulai 1 Jan ${tahun + 1} mendapat jatah penuh ${pengaturan.data!.jatah_cuti_tahunan} hari.`}
                </p>
              </>
            ) : (
              <p className="mt-2 text-sm text-teks-sekunder">Isi tanggal masuk untuk melihat jatah cuti tahun ini.</p>
            )}
            {pengaturan.data && (
              <p className="mt-4 rounded-kontrol bg-latar p-3 text-[13px] leading-[18px] text-teks-sekunder">
                Jatah {pengaturan.data.jatah_cuti_tahunan} hari per tahun, sama untuk semua. Reset setiap 1 Januari; sisa tahun lalu hangus. Karyawan baru: proporsional per bulan penuh tersisa.
              </p>
            )}
          </div>
          <div className="rounded-kartu border border-garis bg-permukaan p-5">
            <h2 className="text-[17px] leading-6 font-semibold">Yang terjadi setelah disimpan</h2>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-teks-sekunder">
              <li>Undangan membuat password dikirim ke email karyawan.</li>
              <li>Muncul di tim atasan langsung dan di Absensi.</li>
              <li>Perubahan data tercatat di Log audit.</li>
            </ul>
          </div>
        </aside>
      </form>
    </div>
  )
}

function Bagian({ judul, children }: { judul: string; children: ReactNode }) {
  return (
    <fieldset className="rounded-kartu border border-garis bg-permukaan px-5 pt-2 pb-5">
      <legend className="px-2 text-[17px] leading-6 font-semibold">{judul}</legend>
      <div className="mt-2 grid grid-cols-3 gap-x-4 gap-y-5">{children}</div>
    </fieldset>
  )
}

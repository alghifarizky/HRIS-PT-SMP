// Form karyawan bersama — Tambah (B3A hal 8–11, EMP-02/03) & Edit (B3A hal 12 karyawan, hal 13 Direksi).
// Keputusan Al (13 Nov 2026): label "Email" (email pribadi); wajib = email, peran, nama, NIK, jabatan, tanggal
// masuk, gaji (+ atasan untuk Karyawan); Direksi tanpa atasan/gaji/saldo & NIK opsional.
// Atasan: peran Karyawan → pengguna aktif berperan Atasan (dijaga trigger DB); Atasan/HR → Direksi (opsional).
// No. KTP saat edit: tersamar, nomor lengkap hanya lewat "Tampilkan" (RPC lihat_ktp, tercatat di log audit).
import { useEffect, useState, type ReactNode } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate } from 'react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CircleAlert, Info } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { skemaEmail } from '../../lib/validasi'
import { HEADER_ALASAN, kodeAlasan } from '../../lib/alasan'
import { jatahProporsional } from '../../lib/cuti'
import { dariTanggalDb, hariIniDb, tahunIni, tanggalPendek } from '../../lib/format'
import { LABEL_PERAN } from '../../navigasi'
import { useProfil } from '../../auth/sesi'
import { Field, Input, Tombol } from '../../komponen/form'
import { InputKtp, InputRupiah } from '../../komponen/inputKhusus'
import { useToast } from '../../komponen/toast'
import { useDaftarKaryawan, type DetailKaryawan } from './data'

export type DataKaryawan = DetailKaryawan

const kelasSelect = 'fokus-ring h-12 w-full rounded-kontrol border bg-permukaan px-3 text-[15px] lg:h-11'

const skema = z
  .object({
    email: skemaEmail,
    role: z.enum(['karyawan', 'atasan', 'hr', 'direksi']),
    atasan_id: z.string(),
    nama: z.string().trim().min(1, 'Nama lengkap wajib diisi.').max(100, 'Maksimal 100 karakter.'),
    tanggal_lahir: z.string(),
    no_ktp: z.string(),
    status_menikah: z.enum(['belum_menikah', 'menikah']),
    jumlah_tanggungan: z.number({ error: 'Wajib diisi.' }).int('Harus bilangan bulat.').min(0, 'Minimal 0.').max(20, 'Maksimal 20.'),
    alamat: z.string().trim().max(300, 'Maksimal 300 karakter.'),
    nik: z.string().trim().max(30, 'Maksimal 30 karakter.'),
    jabatan: z.string().trim().min(1, 'Jabatan wajib diisi.').max(100, 'Maksimal 100 karakter.'),
    tanggal_masuk: z.string(),
    alasan: z.string().trim().max(200, 'Maksimal 200 karakter.'),
    gaji_pokok: z.union([z.number().min(0, 'Minimal Rp 0.').max(999_999_999_999, 'Nominal terlalu besar.'), z.nan()]),
  })
  .superRefine((v, ctx) => {
    const salah = (path: string, message: string) => ctx.addIssue({ code: 'custom', path: [path], message })
    if (v.no_ktp && v.no_ktp.length !== 16) salah('no_ktp', `No. KTP harus 16 digit angka (terisi ${v.no_ktp.length}).`)
    if (v.role === 'direksi') return
    if (v.role === 'karyawan' && !v.atasan_id) salah('atasan_id', 'Atasan langsung wajib diisi untuk peran Karyawan.')
    if (!v.nik) salah('nik', 'NIK karyawan wajib diisi.')
    if (!v.tanggal_masuk) salah('tanggal_masuk', 'Tanggal masuk wajib diisi.')
    if (Number.isNaN(v.gaji_pokok)) salah('gaji_pokok', 'Gaji pokok wajib diisi.')
  })
type Isian = z.infer<typeof skema>

const LABEL_ISIAN: Record<keyof Isian, string> = {
  email: 'email', role: 'peran', atasan_id: 'atasan langsung', nama: 'nama lengkap', tanggal_lahir: 'tanggal lahir',
  no_ktp: 'No. KTP', status_menikah: 'status menikah', jumlah_tanggungan: 'jumlah tanggungan', alamat: 'alamat',
  nik: 'NIK karyawan', jabatan: 'jabatan', tanggal_masuk: 'tanggal masuk', gaji_pokok: 'gaji pokok', alasan: 'alasan perubahan',
}
const daftarKalimat = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')}${xs.length > 2 ? ',' : ''} dan ${xs.at(-1)}`)
const kosongJadiNull = (s: string) => (s.trim() ? s.trim() : null)
const pesanGagal = 'Data gagal disimpan. Periksa koneksi Anda, lalu coba lagi.'

/** Pesan dari Edge Function `akun` (JSON { galat }) atau pesan umum. */
async function pesanFungsi(error: unknown) {
  const isi = await (error as { context?: Response }).context?.json?.().catch(() => null)
  return (isi?.galat as string | undefined) ?? pesanGagal
}

export default function FormKaryawan({ awal }: { awal?: DataKaryawan }) {
  const edit = !!awal
  const navigate = useNavigate()
  const qc = useQueryClient()
  const toast = useToast()
  const idSaya = useProfil().data!.id
  const [galat, setGalat] = useState<string | null>(null)
  const [ktpDibuka, setKtpDibuka] = useState(!awal?.no_ktp_tersamar) // belum ada KTP → langsung bisa diisi
  const [membukaKtp, setMembukaKtp] = useState(false)
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
      email: awal?.email ?? '', role: awal?.role ?? 'karyawan', atasan_id: awal?.atasan_id ?? '', nama: awal?.nama ?? '',
      tanggal_lahir: awal?.tanggal_lahir ?? '', no_ktp: '', status_menikah: awal?.status_menikah ?? 'belum_menikah',
      jumlah_tanggungan: awal?.jumlah_tanggungan ?? 0, alamat: awal?.alamat ?? '', nik: awal?.nik ?? '', jabatan: awal?.jabatan ?? '',
      tanggal_masuk: awal?.tanggal_masuk ?? '', gaji_pokok: awal?.gaji_pokok ?? NaN, alasan: '',
    },
  })
  const [role, tanggalMasuk, gajiPokok, atasanId] = useWatch({ control, name: ['role', 'tanggal_masuk', 'gaji_pokok', 'atasan_id'] })
  // Alasan wajib bila gaji pokok, peran, atau atasan berubah (dijaga juga trigger wajib_alasan_pengguna)
  const perluAlasan =
    edit &&
    (role !== awal.role ||
      (role === 'direksi' ? '' : atasanId) !== (awal.atasan_id ?? '') ||
      (role === 'direksi' || Number.isNaN(gajiPokok) ? null : gajiPokok) !== (awal.gaji_pokok == null ? null : Number(awal.gaji_pokok)))
  const direksi = role === 'direksi'
  const akunSendiri = awal?.id === idSaya

  // Usulan NIK (hanya saat tambah) mengikuti tahun masuk; tidak menimpa NIK yang sudah diketik HR
  const tahunMasuk = tanggalMasuk ? Number(tanggalMasuk.slice(0, 4)) : tahunIni()
  const usulan = useQuery({
    queryKey: ['usulan_nik', tahunMasuk],
    enabled: !edit,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('usulan_nik', { tahun_masuk: tahunMasuk })
      if (error) throw error
      return data as string
    },
  })
  useEffect(() => {
    if (usulan.data && !getFieldState('nik').isDirty) setValue('nik', usulan.data)
  }, [usulan.data, getFieldState, setValue])

  // Atasan yang masih membawahi tidak boleh diganti perannya (trigger validasi_atasan) — beri tahu sebelum simpan
  const jumlahBawahan = (daftar.data ?? []).filter((k) => k.atasan_id === awal?.id && k.aktif && k.role === 'karyawan').length
  const terhalangBawahan = edit && awal.role === 'atasan' && role !== 'atasan' && jumlahBawahan > 0

  const pilihanAtasan = (daftar.data ?? []).filter(
    (k) => k.aktif && k.id !== awal?.id && k.role === (role === 'karyawan' ? 'atasan' : 'direksi'),
  )

  const tampilkanKtp = async () => {
    setMembukaKtp(true)
    const { data, error } = await supabase.rpc('lihat_ktp', { target: awal!.id })
    setMembukaKtp(false)
    if (error) return setGalat('No. KTP gagal ditampilkan. Periksa koneksi Anda, lalu coba lagi.')
    setValue('no_ktp', (data as string | null) ?? '')
    setKtpDibuka(true)
  }

  const simpan = handleSubmit(async (v) => {
    setGalat(null)
    const data = {
      nama: v.nama, jabatan: v.jabatan, nik: kosongJadiNull(v.nik), tanggal_lahir: kosongJadiNull(v.tanggal_lahir),
      alamat: kosongJadiNull(v.alamat), tanggal_masuk: kosongJadiNull(v.tanggal_masuk), status_menikah: v.status_menikah,
      jumlah_tanggungan: v.jumlah_tanggungan,
      atasan_id: direksi ? null : kosongJadiNull(v.atasan_id),
      gaji_pokok: direksi || Number.isNaN(v.gaji_pokok) ? null : v.gaji_pokok,
      ...(ktpDibuka ? { no_ktp: kosongJadiNull(v.no_ktp) } : {}), // KTP tak dibuka → tidak dikirim, tetap seperti semula
    }

    if (!edit) {
      const { error } = await supabase.functions.invoke('akun', {
        body: { aksi: 'undang', redirectTo: `${window.location.origin}/atur-password`, data: { ...data, email: v.email, role: v.role } },
      })
      if (error) return tanganiPesan(await pesanFungsi(error))
      await qc.invalidateQueries({ queryKey: ['karyawan'] })
      qc.removeQueries({ queryKey: ['usulan_nik'] })
      toast(`${v.nama} ditambahkan. Undangan dikirim ke ${v.email}.`)
      return navigate('/panel/karyawan')
    }

    if (perluAlasan && !v.alasan) {
      return setError('alasan', { message: 'Alasan wajib diisi karena gaji pokok, peran, atau atasan berubah.' }, { shouldFocus: true })
    }
    const kueri = supabase
      .from('pengguna')
      .update({ ...data, ...(v.role !== awal.role ? { role: v.role } : {}) })
      .eq('id', awal.id)
    if (v.alasan) kueri.setHeader(HEADER_ALASAN, kodeAlasan(v.alasan))
    const { data: hasil, error } = await kueri.select('id')
    if (error) {
      // Pesan trigger DB sudah Bahasa Indonesia (mis. "Budi masih membawahi 3 karyawan. …")
      if (error.code === '23505') return tanganiPesan(error.message.includes('nik') ? 'NIK sudah dipakai karyawan lain.' : pesanGagal)
      if (error.code === '23514' && /membawahi|Atasan langsung|Tanggal masuk|Alasan/.test(error.message)) return setGalat(error.message)
      if (error.code === '42501') return setGalat('Anda tidak berwenang melakukan perubahan ini.')
      return setGalat(pesanGagal)
    }
    if (!hasil.length) return setGalat('Anda tidak berwenang mengubah data karyawan ini.')

    if (v.email !== awal.email) {
      const { error: eEmail } = await supabase.functions.invoke('akun', { body: { aksi: 'ubah_email', id: awal.id, email: v.email } })
      if (eEmail) {
        await qc.invalidateQueries({ queryKey: ['karyawan'] })
        const pesan = await pesanFungsi(eEmail)
        return setError('email', { message: `Data lain tersimpan, tetapi email belum berubah: ${pesan}` }, { shouldFocus: true })
      }
    }
    await qc.invalidateQueries({ queryKey: ['karyawan'] })
    toast(`Perubahan data ${v.nama} disimpan.`)
    navigate(`/panel/karyawan/${awal.id}`)
  })

  function tanganiPesan(pesan: string) {
    if (pesan.startsWith('Email')) return setError('email', { message: pesan }, { shouldFocus: true })
    if (pesan.startsWith('NIK')) return setError('nik', { message: pesan }, { shouldFocus: true })
    setGalat(pesan)
  }

  const isianSalah = (Object.keys(errors) as (keyof Isian)[]).map((k) => LABEL_ISIAN[k])
  const tahun = tahunIni()
  const saldo = !edit && tanggalMasuk && pengaturan.data ? jatahProporsional(pengaturan.data.jatah_cuti_tahunan, tanggalMasuk, hariIniDb()) : null
  const judul = edit ? `Edit karyawan: ${awal.nama}` : 'Tambah karyawan'

  return (
    <div>
      <nav aria-label="Breadcrumb" className="text-sm text-teks-sekunder">
        <Link to="/panel/karyawan" className="fokus-ring rounded text-primer hover:underline">Karyawan</Link>
        {edit ? (
          <>
            {' › '}
            <Link to={`/panel/karyawan/${awal.id}`} className="fokus-ring rounded text-primer hover:underline">{awal.nama}</Link> › Edit
          </>
        ) : (
          ' › Tambah karyawan'
        )}
      </nav>
      <h1 className="mt-2 text-[28px] leading-[34px] font-semibold">{judul}</h1>
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
            {direksi && (
              <p className="col-span-3 flex gap-3 rounded-kontrol bg-info-latar p-3 text-[15px] text-info">
                <Info className="mt-0.5 size-5 shrink-0 text-info-ikon" aria-hidden />
                Direksi tidak mengikuti absensi dan payroll. Atasan langsung, gaji pokok, dan saldo cuti tidak diperlukan.
              </p>
            )}
            <Field
              id="email"
              label="Email"
              wajib
              galat={errors.email?.message}
              bantuan={direksi ? 'Email Direksi hanya dapat diubah developer.' : edit ? 'Mengubah email juga mengubah email untuk login.' : 'Undangan untuk membuat password dikirim ke email ini.'}
            >
              {/* Isian terkunci tidak di-register (RHF mengirim undefined untuk input disabled); nilai tetap dari data awal */}
              {edit && direksi ? (
                <Input id="email" readOnly value={awal.email} className="bg-latar text-teks-sekunder" />
              ) : (
                <Input id="email" type="email" autoComplete="off" placeholder="nama@gmail.com" galat={!!errors.email} {...register('email')} />
              )}
            </Field>
            <Field id="role" label="Peran" wajib bantuan={akunSendiri ? 'Peran akun sendiri tidak dapat diubah.' : undefined}>
              {direksi || akunSendiri ? (
                <Input id="role" readOnly value={LABEL_PERAN[role]} className="bg-latar text-teks-sekunder" />
              ) : (
                <select id="role" className={`${kelasSelect} border-garis`} {...register('role', { onChange: () => setValue('atasan_id', '') })}>
                  {(['karyawan', 'atasan', 'hr'] as const).map((r) => (
                    <option key={r} value={r}>{LABEL_PERAN[r]}</option>
                  ))}
                </select>
              )}
            </Field>
            {terhalangBawahan && (
              <p role="alert" className="col-span-3 flex gap-3 rounded-kontrol bg-peringatan-latar p-3 text-[15px] text-peringatan">
                <CircleAlert className="mt-0.5 size-5 shrink-0 text-peringatan-ikon" aria-hidden />
                {awal.nama} masih membawahi {jumlahBawahan} karyawan. Pindahkan dulu ke atasan lain sebelum mengubah perannya.
              </p>
            )}
            {!direksi && (
              <Field id="atasan_id" label="Atasan langsung" wajib={role === 'karyawan'} galat={errors.atasan_id?.message}>
                <select id="atasan_id" aria-invalid={!!errors.atasan_id || undefined} className={`${kelasSelect} ${errors.atasan_id ? 'border-bahaya-ikon' : 'border-garis'}`} {...register('atasan_id')}>
                  <option value="">{role === 'karyawan' ? 'Pilih atasan langsung' : 'Tanpa atasan'}</option>
                  {pilihanAtasan.map((a) => (
                    <option key={a.id} value={a.id}>{a.nama}{a.jabatan ? ` · ${a.jabatan}` : ''}</option>
                  ))}
                </select>
              </Field>
            )}
          </Bagian>

          <Bagian judul="Data pribadi">
            <Field id="nama" label="Nama lengkap" wajib galat={errors.nama?.message}>
              <Input id="nama" autoComplete="off" galat={!!errors.nama} {...register('nama')} />
            </Field>
            <Field id="tanggal_lahir" label="Tanggal lahir">
              <Input id="tanggal_lahir" type="date" {...register('tanggal_lahir')} />
            </Field>
            <Field id="no_ktp" label="No. KTP" galat={errors.no_ktp?.message} bantuan="Selalu ditampilkan tersamar. Hanya HR & Direksi yang dapat melihat nomor lengkap.">
              {ktpDibuka ? (
                <Controller name="no_ktp" control={control} render={({ field }) => <InputKtp id="no_ktp" nilai={field.value} onUbah={field.onChange} onBlur={field.onBlur} galat={!!errors.no_ktp} />} />
              ) : (
                <div className="flex items-center gap-2">
                  <Input id="no_ktp" readOnly value={awal?.no_ktp_tersamar ?? ''} className="bg-latar tabular-nums" />
                  <Tombol varian="sekunder" onClick={tampilkanKtp} memproses={membukaKtp} className="shrink-0 border-0 bg-transparent px-2 text-primer">
                    Tampilkan
                  </Tombol>
                </div>
              )}
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
            <Field id="nik" label="NIK karyawan" wajib={!direksi} galat={errors.nik?.message} bantuan={edit ? undefined : 'Diusulkan otomatis, boleh diubah.'}>
              <Input id="nik" autoComplete="off" galat={!!errors.nik} className="tabular-nums" {...register('nik')} />
            </Field>
            <Field id="jabatan" label="Jabatan" wajib galat={errors.jabatan?.message}>
              <Input id="jabatan" autoComplete="off" galat={!!errors.jabatan} {...register('jabatan')} />
            </Field>
            <Field id="tanggal_masuk" label="Tanggal masuk" wajib={!direksi} galat={errors.tanggal_masuk?.message}>
              <Input id="tanggal_masuk" type="date" galat={!!errors.tanggal_masuk} {...register('tanggal_masuk')} />
            </Field>
            {!direksi && (
              <Field id="gaji_pokok" label="Gaji pokok" wajib galat={errors.gaji_pokok?.message} bantuan={edit ? 'Perubahan gaji tercatat di Log audit dan berlaku di payroll berikutnya.' : undefined}>
                <Controller name="gaji_pokok" control={control} render={({ field }) => <InputRupiah id="gaji_pokok" nilai={field.value} onUbah={field.onChange} onBlur={field.onBlur} galat={!!errors.gaji_pokok} />} />
              </Field>
            )}
          </Bagian>

          {edit && (
            <Bagian judul="Alasan perubahan">
              <div className="col-span-3">
                <Field
                  id="alasan"
                  label="Alasan perubahan"
                  wajib={perluAlasan}
                  galat={errors.alasan?.message}
                  bantuan="Wajib bila gaji pokok, peran, atau atasan berubah. Tercatat di Riwayat perubahan."
                >
                  <textarea id="alasan" rows={2} placeholder="Contoh: Penyesuaian gaji tahunan 2026." aria-invalid={!!errors.alasan || undefined} className={`fokus-ring w-full rounded-kontrol border bg-permukaan px-4 py-3 text-[15px] placeholder:text-teks-3 ${errors.alasan ? 'border-bahaya-ikon' : 'border-garis'}`} {...register('alasan')} />
                </Field>
              </div>
            </Bagian>
          )}

          <div className="flex justify-end gap-3">
            <Tombol varian="sekunder" onClick={() => navigate(edit ? `/panel/karyawan/${awal.id}` : '/panel/karyawan')}>Batal</Tombol>
            <Tombol type="submit" memproses={isSubmitting} disabled={terhalangBawahan}>{edit ? 'Simpan perubahan' : 'Simpan & kirim undangan'}</Tombol>
          </div>
        </div>

        <aside className="flex flex-col gap-4">
          {!direksi && (
            <div className="rounded-kartu border border-garis bg-permukaan p-5">
              <h2 className="text-[17px] leading-6 font-semibold">Saldo cuti (otomatis)</h2>
              {edit ? (
                <>
                  <p className="mt-1 text-[15px] text-teks-sekunder">Sisa saldo cuti {tahun}</p>
                  <p className="mt-2 text-[28px] leading-[34px] font-bold tabular-nums">{awal.saldo_cuti ?? 0} hari</p>
                  {/* shortcut: rincian "terpakai · hangus 31 Des" (desain hal 12) menyusul bersama fitur cuti (Fase 4) */}
                </>
              ) : saldo ? (
                <>
                  <p className="mt-1 text-[15px] text-teks-sekunder">Masuk {tanggalPendek(dariTanggalDb(tanggalMasuk))} → jatah {tahun}</p>
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
          )}
          <div className="rounded-kartu border border-garis bg-permukaan p-5">
            <h2 className="text-[17px] leading-6 font-semibold">Yang terjadi setelah disimpan</h2>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-teks-sekunder">
              <li>{edit ? 'Tidak ada undangan baru; karyawan tetap memakai password lamanya.' : 'Undangan membuat password dikirim ke email karyawan.'}</li>
              {!direksi && <li>Muncul di tim atasan langsung dan di Absensi.</li>}
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

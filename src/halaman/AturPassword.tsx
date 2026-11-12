// AUTH-03 & undangan akun (AUTH-02) — tujuan link email. Tidak ada di desain; mengikuti gaya halaman Masuk
// (keputusan Al, 12 Nov 2026).
// Link email (supabase/templates/*.html) membawa ?token_hash=…&type=recovery|invite. Token baru diverifikasi
// saat pengguna menekan "Simpan password", agar pemindai link / membuka di HP tidak menghabiskan link.
// Pengirim link WAJIB memberi redirectTo = <origin>/atur-password (template memakai {{ .RedirectTo }}).
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { LinkIcon } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { skemaPasswordBaru } from '../lib/validasi'
import { useSesi } from '../auth/sesi'
import HalamanAuth from '../komponen/HalamanAuth'
import { BannerGalat, Field, InputPassword, TombolPrimer } from '../komponen/form'

const skema = z
  .object({ password: skemaPasswordBaru, ulangi: z.string().min(1, 'Ulangi password baru.') })
  .refine((v) => v.password === v.ulangi, { path: ['ulangi'], message: 'Password tidak sama.' })
type Isian = z.infer<typeof skema>

const JENIS_TOKEN = ['recovery', 'invite'] as const
type JenisToken = (typeof JENIS_TOKEN)[number]

export default function AturPassword() {
  const sesi = useSesi()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [galat, setGalat] = useState<string | null>(null)
  const [linkGagal, setLinkGagal] = useState(false)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Isian>({ resolver: zodResolver(skema) })

  const tokenHash = params.get('token_hash')
  const jenis = params.get('type') as JenisToken | null
  const adaToken = !!tokenHash && JENIS_TOKEN.includes(jenis as JenisToken)

  if (sesi === undefined) return null // SesiProvider masih membaca sesi tersimpan
  if (linkGagal || (!adaToken && !sesi)) return <LinkTidakBerlaku />

  const simpan = handleSubmit(async ({ password }) => {
    setGalat(null)
    if (adaToken) {
      const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash!, type: jenis! })
      if (error) {
        if (error.code === 'otp_expired' || error.status === 403) return setLinkGagal(true)
        return setGalat('Password gagal disimpan. Periksa koneksi internet Anda, lalu coba lagi.')
      }
      // Token sudah terpakai & sesi terbentuk — percobaan berikutnya cukup updateUser
      setParams({}, { replace: true })
    }
    const { error } = await supabase.auth.updateUser({ password })
    if (!error) return navigate('/', { replace: true })
    setGalat(
      error.code === 'same_password'
        ? 'Password baru harus berbeda dari password lama.'
        : error.code === 'weak_password'
          ? 'Password terlalu lemah. Gunakan kombinasi huruf dan angka.'
          : 'Password gagal disimpan. Periksa koneksi internet Anda, lalu coba lagi.',
    )
  })

  return (
    <HalamanAuth>
      <h1 className="text-[28px] leading-[34px] font-bold">{jenis === 'invite' ? 'Buat password' : 'Buat password baru'}</h1>
      <p className="mt-2 text-[15px] leading-[22px] text-teks-sekunder">
        {sesi && !adaToken ? (
          <>
            Untuk akun <strong className="font-semibold text-teks">{sesi.user.email}</strong>.{' '}
          </>
        ) : null}
        Minimal 8 karakter.
      </p>
      <form onSubmit={simpan} noValidate className="mt-8 flex flex-col gap-4">
        {galat && <BannerGalat>{galat}</BannerGalat>}
        <Field id="password" label="Password baru" galat={errors.password?.message}>
          <InputPassword id="password" autoComplete="new-password" placeholder="Minimal 8 karakter" galat={!!errors.password} {...register('password')} />
        </Field>
        <Field id="ulangi" label="Ulangi password baru" galat={errors.ulangi?.message}>
          <InputPassword id="ulangi" autoComplete="new-password" placeholder="Ketik ulang password" galat={!!errors.ulangi} {...register('ulangi')} />
        </Field>
        <TombolPrimer type="submit" memproses={isSubmitting} className="mt-4">
          Simpan password
        </TombolPrimer>
      </form>
    </HalamanAuth>
  )
}

function LinkTidakBerlaku() {
  return (
    <HalamanAuth kembaliKe="/masuk">
      <div className="mt-6 flex flex-col items-center text-center">
        <div className="flex size-[72px] items-center justify-center rounded-full bg-bahaya-latar">
          <LinkIcon className="size-8 text-bahaya-ikon" aria-hidden />
        </div>
        <h1 className="mt-6 text-[22px] leading-7 font-semibold">Link tidak berlaku</h1>
        <p className="mt-3 text-[15px] leading-[22px] text-teks-sekunder">
          Link sudah kedaluwarsa (berlaku 30 menit) atau sudah dipakai. Minta link baru, atau hubungi HR.
        </p>
      </div>
      <Link
        to="/lupa-password"
        className="fokus-ring mt-8 flex h-12 items-center justify-center rounded-kontrol bg-primer text-base font-semibold text-white hover:bg-primer-700"
      >
        Minta link baru
      </Link>
    </HalamanAuth>
  )
}

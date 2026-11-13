// Ganti password dari Profil (mobile). Tidak ada layar khusus di desain — mengikuti gaya form Masuk.
// Wajib password saat ini (diverifikasi dengan login ulang) agar HP yang tidak terkunci tidak cukup untuk mengganti.
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate } from 'react-router'
import { ChevronLeft } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { skemaPasswordBaru } from '../../lib/validasi'
import { useSesi } from '../../auth/sesi'
import { BannerGalat, Field, InputPassword, Tombol } from '../../komponen/form'
import { useToast } from '../../komponen/toast'

const skema = z
  .object({
    lama: z.string().min(1, 'Password saat ini wajib diisi.'),
    password: skemaPasswordBaru,
    ulangi: z.string().min(1, 'Ulangi password baru.'),
  })
  .refine((v) => v.password === v.ulangi, { path: ['ulangi'], message: 'Password tidak sama.' })
  .refine((v) => v.password !== v.lama, { path: ['password'], message: 'Password baru harus berbeda dari password saat ini.' })
type Isian = z.infer<typeof skema>

export default function GantiPassword() {
  const email = useSesi()!.user.email!
  const navigate = useNavigate()
  const toast = useToast()
  const [galat, setGalat] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Isian>({ resolver: zodResolver(skema) })

  const simpan = handleSubmit(async ({ lama, password }) => {
    setGalat(null)
    const { error: eLama } = await supabase.auth.signInWithPassword({ email, password: lama })
    if (eLama) {
      if (eLama.code === 'invalid_credentials') return setError('lama', { message: 'Password saat ini salah.' }, { shouldFocus: true })
      return setGalat('Password gagal diganti. Periksa koneksi internet Anda, lalu coba lagi.')
    }
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      return setGalat(error.code === 'weak_password' ? 'Password terlalu lemah. Gunakan kombinasi huruf dan angka.' : 'Password gagal diganti. Periksa koneksi internet Anda, lalu coba lagi.')
    }
    toast('Password berhasil diganti.')
    navigate(-1)
  })

  return (
    <div>
      <Link to="/profil" className="fokus-ring -ml-2 inline-flex min-h-11 items-center gap-1 rounded-kontrol px-2 text-[15px] font-semibold text-primer">
        <ChevronLeft className="size-5" aria-hidden /> Profil
      </Link>
      <h1 className="mt-2 text-[22px] leading-7 font-semibold">Ganti password</h1>
      <p className="mt-1 text-[15px] text-teks-sekunder">Untuk akun {email}. Minimal 8 karakter.</p>
      <form onSubmit={simpan} noValidate className="mt-6 flex flex-col gap-4">
        {galat && <BannerGalat>{galat}</BannerGalat>}
        <Field id="lama" label="Password saat ini" wajib galat={errors.lama?.message}>
          <InputPassword id="lama" autoComplete="current-password" galat={!!errors.lama} {...register('lama')} />
        </Field>
        <Field id="password" label="Password baru" wajib galat={errors.password?.message}>
          <InputPassword id="password" autoComplete="new-password" placeholder="Minimal 8 karakter" galat={!!errors.password} {...register('password')} />
        </Field>
        <Field id="ulangi" label="Ulangi password baru" wajib galat={errors.ulangi?.message}>
          <InputPassword id="ulangi" autoComplete="new-password" galat={!!errors.ulangi} {...register('ulangi')} />
        </Field>
        <Tombol type="submit" memproses={isSubmitting} className="mt-2">
          Simpan password
        </Tombol>
      </form>
    </div>
  )
}

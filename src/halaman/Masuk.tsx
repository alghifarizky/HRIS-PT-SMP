// AUTH-01 — desain: Batch 1 hal 6 (normal) & 7 (error kredensial). Teks disesuaikan: karyawan login
// dengan email pribadi yang didaftarkan HR, bukan email kantor (keputusan Al, 13 Nov 2026).
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link } from 'react-router'
import { supabase } from '../lib/supabase'
import HalamanAuth from '../komponen/HalamanAuth'
import { BannerGalat, Field, Input, InputPassword, Tombol } from '../komponen/form'
import { skemaEmail } from '../lib/validasi'

const skema = z.object({ email: skemaEmail, password: z.string().min(1, 'Password wajib diisi.') })
type Isian = z.infer<typeof skema>

const PESAN_KREDENSIAL = 'Email atau password salah. Periksa kembali, atau hubungi HR bila lupa akun.'
const PESAN_GANGGUAN = 'Gagal masuk. Periksa koneksi internet Anda, lalu coba lagi.'

export default function Masuk() {
  const [galat, setGalat] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Isian>({ resolver: zodResolver(skema) })

  const masuk = handleSubmit(async ({ email, password }) => {
    setGalat(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    // Sukses: SesiProvider menerima SIGNED_IN, router mengarahkan ke beranda
    if (error) setGalat(error.code === 'invalid_credentials' ? PESAN_KREDENSIAL : PESAN_GANGGUAN)
  })

  return (
    <HalamanAuth>
      {/* Logo resmi menggantikan kotak "SMP" di desain (keputusan Al, 13 Nov 2026) */}
      <img src="/logo-smp.png" alt="Logo PT. Sumber Migas Pantara" width={56} height={56} className="size-14" />

      <h1 className="mt-6 text-[28px] leading-[34px] font-bold">HRIS PT. SMP</h1>
      <p className="mt-2 text-[15px] leading-[22px] text-teks-sekunder">Masuk dengan email pribadi yang sudah didaftarkan HR.</p>

      <form onSubmit={masuk} noValidate className="mt-8 flex flex-col gap-4">
        {galat && <BannerGalat>{galat}</BannerGalat>}
        <Field id="email" label="Email" galat={errors.email?.message}>
          <Input id="email" type="email" autoComplete="username" inputMode="email" placeholder="nama@gmail.com" galat={!!errors.email} {...register('email')} />
        </Field>
        <Field id="password" label="Password" galat={errors.password?.message}>
          <InputPassword
            id="password"
            autoComplete="current-password"
            placeholder="Masukkan password"
            galat={!!errors.password || galat === PESAN_KREDENSIAL}
            {...register('password')}
          />
        </Field>
        <Link to="/lupa-password" className="fokus-ring flex min-h-11 items-center self-end rounded-kontrol text-[15px] font-semibold text-primer">
          Lupa password?
        </Link>
        <Tombol type="submit" memproses={isSubmitting} className="mt-2">
          Masuk
        </Tombol>
      </form>

      <footer className="mt-auto pt-12 text-center">
        <p className="text-[15px] text-teks-sekunder">Email belum terdaftar? Hubungi HR.</p>
        {/* shortcut: versi ditulis manual, ambil dari package.json saat ada proses rilis */}
        <p className="mt-2 text-sm text-teks-3">Versi 1.0.0</p>
      </footer>
    </HalamanAuth>
  )
}

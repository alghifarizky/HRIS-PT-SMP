// AUTH-03 — desain: Batch 1 hal 8 (form) & 9 (link terkirim)
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link } from 'react-router'
import { Mail } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { skemaEmail } from '../lib/validasi'
import { urlAturPassword } from '../lib/aplikasi'
import HalamanAuth from '../komponen/HalamanAuth'
import { BannerGalat, Field, Input, Tombol } from '../komponen/form'

const skema = z.object({ email: skemaEmail })
type Isian = z.infer<typeof skema>

const JEDA_KIRIM_ULANG = 60 // detik — sama dengan auth.email.max_frequency

async function kirimLink(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: urlAturPassword(),
  })
  if (!error) return null
  return error.code === 'over_email_send_rate_limit'
    ? 'Terlalu banyak permintaan. Tunggu sebentar, lalu coba lagi.'
    : 'Link gagal dikirim. Periksa koneksi internet Anda, lalu coba lagi.'
}

export default function LupaPassword() {
  const [terkirimKe, setTerkirimKe] = useState<string | null>(null)
  const [galat, setGalat] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Isian>({ resolver: zodResolver(skema) })

  const kirim = handleSubmit(async ({ email }) => {
    setGalat(null)
    // Supabase tidak memberi tahu apakah email terdaftar — sengaja, agar daftar akun tidak bisa ditebak
    const g = await kirimLink(email)
    if (g) setGalat(g)
    else setTerkirimKe(email)
  })

  if (terkirimKe) return <Terkirim email={terkirimKe} />

  return (
    <HalamanAuth kembaliKe="/masuk">
      <h1 className="text-[28px] leading-[34px] font-bold">Lupa password</h1>
      <p className="mt-2 text-[15px] leading-[22px] text-teks-sekunder">
        Masukkan email yang terdaftar di aplikasi. Kami akan mengirim link untuk membuat password baru.
      </p>
      <form onSubmit={kirim} noValidate className="mt-8 flex flex-col gap-6">
        {galat && <BannerGalat>{galat}</BannerGalat>}
        <Field id="email" label="Email" galat={errors.email?.message}>
          <Input id="email" type="email" autoComplete="username" inputMode="email" placeholder="nama@gmail.com" galat={!!errors.email} {...register('email')} />
        </Field>
        <Tombol type="submit" memproses={isSubmitting}>
          Kirim link reset
        </Tombol>
      </form>
      <p className="mt-6 text-[15px] leading-[22px] text-teks-sekunder">Tidak bisa membuka email tersebut? Hubungi HR untuk reset manual.</p>
    </HalamanAuth>
  )
}

function Terkirim({ email }: { email: string }) {
  const [sisa, setSisa] = useState(JEDA_KIRIM_ULANG)
  const [mengirim, setMengirim] = useState(false)
  const [galat, setGalat] = useState<string | null>(null)

  useEffect(() => {
    if (sisa <= 0) return
    const t = setTimeout(() => setSisa((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [sisa])

  const kirimUlang = async () => {
    setMengirim(true)
    setGalat(null)
    const g = await kirimLink(email)
    setMengirim(false)
    if (g) setGalat(g)
    else setSisa(JEDA_KIRIM_ULANG)
  }

  return (
    <HalamanAuth kembaliKe="/masuk">
      <div className="mt-6 flex flex-col items-center text-center">
        <div className="flex size-[72px] items-center justify-center rounded-full bg-sukses-latar">
          <Mail className="size-8 text-sukses-ikon" aria-hidden />
        </div>
        <h1 className="mt-6 text-[22px] leading-7 font-semibold">Link reset terkirim</h1>
        <p className="mt-3 text-[15px] leading-[22px] text-teks-sekunder" aria-live="polite">
          Kami sudah mengirim link ke <strong className="font-semibold text-teks">{email}</strong>. Link berlaku 30 menit. Periksa juga folder Spam.
        </p>
      </div>
      {galat && (
        <div className="mt-6">
          <BannerGalat>{galat}</BannerGalat>
        </div>
      )}
      <Link
        to="/masuk"
        className="fokus-ring mt-8 flex h-12 items-center justify-center rounded-kontrol bg-primer text-base font-semibold text-white hover:bg-primer-700"
      >
        Kembali ke halaman masuk
      </Link>
      {sisa > 0 ? (
        <p className="mt-6 text-center text-[15px] text-teks-sekunder tabular-nums">
          Kirim ulang dalam 0:{String(sisa).padStart(2, '0')}
        </p>
      ) : (
        <button
          type="button"
          onClick={kirimUlang}
          disabled={mengirim}
          className="fokus-ring mt-4 min-h-11 self-center rounded-kontrol px-3 text-[15px] font-semibold text-primer disabled:opacity-60"
        >
          {mengirim ? 'Mengirim…' : 'Kirim ulang link'}
        </button>
      )}
    </HalamanAuth>
  )
}

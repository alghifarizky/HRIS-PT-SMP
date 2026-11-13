// EMP-04/05 — Profil sendiri (mobile): Karyawan B1 hal 49, Atasan B2 hal 3 (+ "Slip gaji saya"), Direksi B4 hal 65.
// Hanya-baca; KTP selalu tersamar (pemilik pun tidak melihat nomor lengkap — security §4.4).
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { ChevronRight, CreditCard, Lock, LogOut, Shield } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useProfil, useSesi } from '../../auth/sesi'
import { LABEL_PERAN } from '../../navigasi'
import { jatahProporsional } from '../../lib/cuti'
import { dariTanggalDb, hariIniDb, tahunIni, tanggalPanjang } from '../../lib/format'
import { Badge, KeadaanGalat, Skeleton } from '../../komponen/keadaan'

type DataSaya = {
  nama: string
  nik: string | null
  no_ktp_tersamar: string | null
  jabatan: string | null
  tanggal_masuk: string | null
  email: string
  saldo_cuti: number | null
}

const inisial = (nama: string) => nama.split(' ').slice(0, 2).map((k) => k[0]).join('').toUpperCase()

export default function ProfilSaya() {
  const { id, role } = useProfil().data!
  const direksi = role === 'direksi'
  const q = useQuery({
    queryKey: ['profil_saya', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pengguna')
        .select('nama, nik, no_ktp_tersamar, jabatan, tanggal_masuk, email, saldo_cuti')
        .eq('id', id)
        .single()
      if (error) throw error
      return data as DataSaya
    },
  })
  const pengaturan = useQuery({
    queryKey: ['pengaturan'],
    enabled: !direksi,
    queryFn: async () => {
      const { data, error } = await supabase.from('pengaturan').select('jatah_cuti_tahunan, tanggal_cut_off').single()
      if (error) throw error
      return data as { jatah_cuti_tahunan: number; tanggal_cut_off: number }
    },
  })

  if (q.isPending) return <Skeleton baris={8} />
  if (q.isError) return <KeadaanGalat judul="Profil gagal dimuat" onCobaLagi={() => q.refetch()} />
  const d = q.data
  // Jatah tahun ini (proporsional bagi karyawan baru) — penyebut "X dari J hari"
  const jatah = pengaturan.data && d.tanggal_masuk ? jatahProporsional(pengaturan.data.jatah_cuti_tahunan, d.tanggal_masuk, hariIniDb()).hari : null

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <span className="flex size-14 items-center justify-center rounded-full bg-primer-100 text-lg font-semibold text-primer" aria-hidden>
          {inisial(d.nama)}
        </span>
        <div>
          <h1 className="text-[22px] leading-7 font-semibold">{d.nama}</h1>
          <p className="text-[15px] text-teks-sekunder">{direksi ? [d.jabatan, LABEL_PERAN[role]].filter(Boolean).join(' · ') : d.jabatan}</p>
        </div>
      </div>

      <section className="rounded-kartu border border-garis bg-permukaan px-4 pt-4 pb-1">
        <h2 className="text-[13px] font-semibold tracking-wide text-teks-sekunder uppercase">{direksi ? 'Data akun' : 'Data diri'}</h2>
        <dl className="mt-1 divide-y divide-garis">
          <Baris label="Nama lengkap">{d.nama}</Baris>
          {!direksi && <Baris label="NIK karyawan"><span className="tabular-nums">{d.nik ?? '—'}</span></Baris>}
          {!direksi && <Baris label="No. KTP"><span className="tabular-nums">{d.no_ktp_tersamar ?? '—'}</span></Baris>}
          <Baris label="Jabatan">{d.jabatan ?? '—'}</Baris>
          {!direksi && <Baris label="Tanggal masuk">{d.tanggal_masuk ? tanggalPanjang(dariTanggalDb(d.tanggal_masuk)) : '—'}</Baris>}
          <Baris label="Email"><span className="break-all">{d.email}</span></Baris>
        </dl>
      </section>

      {!direksi && (
        <section className="rounded-kartu border border-garis bg-permukaan p-4" aria-labelledby="judul-saldo">
          <h2 id="judul-saldo" className="text-[15px] text-teks-sekunder">Saldo cuti {tahunIni()}</h2>
          {/* shortcut: "N hari terpakai" (desain) menyusul bersama fitur cuti (Fase 4) */}
          <p className="mt-1 flex items-baseline gap-2">
            <span className="text-[28px] leading-[34px] font-bold tabular-nums">{d.saldo_cuti ?? 0}</span>
            <span className="text-[15px] text-teks-sekunder">{jatah != null ? `dari ${jatah} hari tersisa` : 'hari tersisa'}</span>
          </p>
          {jatah != null && jatah > 0 && (
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-garis" role="progressbar" aria-label="Sisa saldo cuti" aria-valuemin={0} aria-valuemax={jatah} aria-valuenow={d.saldo_cuti ?? 0}>
              <div className="h-full rounded-full bg-primer" style={{ width: `${Math.min(100, ((d.saldo_cuti ?? 0) / jatah) * 100)}%` }} />
            </div>
          )}
        </section>
      )}

      <section className="divide-y divide-garis rounded-kartu border border-garis bg-permukaan">
        {role === 'atasan' && <BarisMenu ke="/slip" ikon={<CreditCard className="size-5" aria-hidden />}>Slip gaji saya</BarisMenu>}
        {direksi ? <BarisKeamanan /> : <BarisMenu ke="/ganti-password" ikon={<Lock className="size-5" aria-hidden />}>Ganti password</BarisMenu>}
        <button
          type="button"
          onClick={() => supabase.auth.signOut()}
          className="fokus-ring flex min-h-14 w-full items-center gap-4 rounded-b-kartu px-4 text-left text-[17px] font-semibold text-bahaya"
        >
          <LogOut className="size-5 text-bahaya-ikon" aria-hidden /> Keluar
        </button>
      </section>

      {direksi ? (
        <p className="rounded-kartu bg-peringatan-latar p-4 text-[15px] text-peringatan">2FA akan diwajibkan untuk HR & Direksi sebelum aplikasi digunakan resmi.</p>
      ) : (
        <p className="text-center text-sm text-teks-sekunder">Data tidak sesuai? Hubungi HR untuk perubahan. · Versi 1.0.0</p>
      )}
    </div>
  )
}

function Baris({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 text-[15px]">
      <dt className="text-teks-sekunder">{label}</dt>
      <dd className="text-right font-semibold">{children}</dd>
    </div>
  )
}

function BarisMenu({ ke, ikon, children }: { ke: string; ikon: ReactNode; children: ReactNode }) {
  return (
    <Link to={ke} className="fokus-ring flex min-h-14 items-center gap-4 px-4 text-[17px] font-semibold first:rounded-t-kartu">
      <span className="text-teks-sekunder">{ikon}</span>
      <span className="flex-1">{children}</span>
      <ChevronRight className="size-5 text-teks-sekunder" aria-hidden />
    </Link>
  )
}

/** Direksi: status 2FA (TOTP) dari Supabase Auth MFA. Halaman Keamanan menyusul. */
function BarisKeamanan() {
  const uid = useSesi()?.user.id
  const mfa = useQuery({
    queryKey: ['mfa', uid],
    queryFn: async () => {
      const { data, error } = await supabase.auth.mfa.listFactors()
      if (error) throw error
      return data.totp.some((f) => f.status === 'verified')
    },
  })
  return (
    <Link to="/panel/keamanan" className="fokus-ring flex min-h-16 items-center gap-4 px-4 py-3 first:rounded-t-kartu">
      <Shield className="size-5 shrink-0 text-teks-sekunder" aria-hidden />
      <span className="flex-1">
        <span className="block text-[17px] font-semibold">Keamanan</span>
        <span className="block text-sm text-teks-sekunder">Verifikasi 2 langkah: {mfa.data ? 'aktif' : 'belum aktif · wajib untuk Direksi'}</span>
      </span>
      {mfa.data ? <Badge nada="sukses">Aktif</Badge> : <Badge nada="netral">Belum aktif</Badge>}
    </Link>
  )
}

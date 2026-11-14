// Data karyawan untuk panel HR & Direksi (RLS: keduanya membaca semua baris `pengguna`).
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import type { Peran } from '../../auth/sesi'

export type BarisKaryawan = {
  id: string
  nik: string | null
  nama: string
  email: string
  jabatan: string | null
  role: Peran
  atasan_id: string | null
  atasan: { nama: string } | null
  tanggal_masuk: string | null
  saldo_cuti: number | null
  aktif: boolean
  tanggal_nonaktif: string | null
}

// shortcut: semua baris diambil sekali lalu disaring di browser — cukup untuk ±25 karyawan; pindah ke filter
// & paging di server bila karyawan > ±500.
export function useDaftarKaryawan() {
  return useQuery({
    queryKey: ['karyawan'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pengguna')
        .select('id, nik, nama, email, jabatan, role, atasan_id, atasan:atasan_id(nama), tanggal_masuk, saldo_cuti, aktif, tanggal_nonaktif')
        .order('nik', { nullsFirst: false })
        .order('nama')
      if (error) throw error
      return data as unknown as BarisKaryawan[]
    },
  })
}

export type DetailKaryawan = {
  id: string
  email: string
  nama: string
  role: Peran
  aktif: boolean
  atasan_id: string | null
  atasan: { nama: string } | null
  nik: string | null
  jabatan: string | null
  tanggal_lahir: string | null
  alamat: string | null
  tanggal_masuk: string | null
  no_ktp_tersamar: string | null
  status_menikah: 'belum_menikah' | 'menikah' | null
  jumlah_tanggungan: number
  gaji_pokok: number | null
  saldo_cuti: number | null
  tanggal_nonaktif: string | null
  alasan_nonaktif: import('./label').AlasanNonaktif | null
  catatan_nonaktif: string | null
}

/** Satu karyawan (detail & edit). No. KTP hanya versi tersamar — nomor lengkap lewat RPC lihat_ktp. */
export function useKaryawan(id: string | undefined) {
  return useQuery({
    queryKey: ['karyawan', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pengguna')
        .select('id, email, nama, role, aktif, atasan_id, atasan:atasan_id(nama), nik, jabatan, tanggal_lahir, alamat, tanggal_masuk, no_ktp_tersamar, status_menikah, jumlah_tanggungan, gaji_pokok, saldo_cuti, tanggal_nonaktif, alasan_nonaktif, catatan_nonaktif')
        .eq('id', id!)
        .maybeSingle()
      if (error) throw error
      return data as unknown as DetailKaryawan | null
    },
  })
}

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
}

// shortcut: semua baris diambil sekali lalu disaring di browser — cukup untuk ±25 karyawan; pindah ke filter
// & paging di server bila karyawan > ±500.
export function useDaftarKaryawan() {
  return useQuery({
    queryKey: ['karyawan'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pengguna')
        .select('id, nik, nama, email, jabatan, role, atasan_id, atasan:pengguna!atasan_id(nama), tanggal_masuk, saldo_cuti, aktif')
        .order('nik', { nullsFirst: false })
        .order('nama')
      if (error) throw error
      return data as unknown as BarisKaryawan[]
    },
  })
}

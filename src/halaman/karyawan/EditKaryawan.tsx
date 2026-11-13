// EMP-02/03/06 — Edit karyawan (B3A hal 12, varian Direksi hal 13). Hanya HR (Direksi: jalur darurat di detail).
import { useParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { KeadaanGalat, KeadaanKosong, Skeleton } from '../../komponen/keadaan'
import FormKaryawan, { type DataKaryawan } from './FormKaryawan'

export default function EditKaryawan() {
  const { id } = useParams()
  const q = useQuery({
    queryKey: ['karyawan', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pengguna')
        .select('id, email, nama, role, atasan_id, nik, jabatan, tanggal_lahir, alamat, tanggal_masuk, no_ktp_tersamar, status_menikah, jumlah_tanggungan, gaji_pokok, saldo_cuti')
        .eq('id', id!)
        .maybeSingle()
      if (error) throw error
      return data as DataKaryawan | null
    },
  })

  if (q.isPending) return <Skeleton baris={10} />
  if (q.isError) return <KeadaanGalat judul="Data karyawan gagal dimuat" onCobaLagi={() => q.refetch()} />
  if (!q.data) return <KeadaanKosong judul="Karyawan tidak ditemukan" pesan="Data mungkin sudah dihapus atau tautan salah." />
  // key: form selalu mulai dari data terbaru bila berpindah karyawan
  return <FormKaryawan key={q.data.id} awal={q.data} />
}

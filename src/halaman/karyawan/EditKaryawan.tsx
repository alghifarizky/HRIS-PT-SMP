// EMP-02/03/06 — Edit karyawan (B3A hal 12, varian Direksi hal 13). Hanya HR (Direksi: jalur darurat di detail).
import { useParams } from 'react-router'
import { KeadaanGalat, KeadaanKosong, Skeleton } from '../../komponen/keadaan'
import FormKaryawan from './FormKaryawan'
import { useKaryawan } from './data'

export default function EditKaryawan() {
  const q = useKaryawan(useParams().id)
  if (q.isPending) return <Skeleton baris={10} />
  if (q.isError) return <KeadaanGalat judul="Data karyawan gagal dimuat" onCobaLagi={() => q.refetch()} />
  if (!q.data) return <KeadaanKosong judul="Karyawan tidak ditemukan" pesan="Data mungkin sudah dihapus atau tautan salah." />
  // key: form selalu mulai dari data terbaru bila berpindah karyawan
  return <FormKaryawan key={q.data.id} awal={q.data} />
}

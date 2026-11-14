// NTF-01/02 — Halaman notifikasi (HP): B1 hal 45 daftar, 46 kosong, 47 memuat, 48 galat; B2 hal 2; B4 hal 66.
import { CheckCheck } from 'lucide-react'
import { KeadaanGalat, KeadaanKosong, Skeleton } from '../../komponen/keadaan'
import { useNotifikasi, useTandaiDibaca } from './data'
import ItemNotifikasi from './ItemNotifikasi'

export default function DaftarNotifikasi() {
  const q = useNotifikasi()
  const tandai = useTandaiDibaca()
  const belum = q.data?.filter((n) => !n.dibaca).length ?? 0
  return (
    <div className="-mx-4 -mt-6">
      <div className="flex min-h-14 items-center justify-between border-b border-garis px-4">
        <span className="text-[15px] text-teks-sekunder">{belum ? `${belum} belum dibaca` : 'Semua sudah dibaca'}</span>
        {belum > 0 && (
          <button type="button" onClick={() => tandai.mutate('semua')} disabled={tandai.isPending}
            className="fokus-ring flex min-h-11 items-center gap-2 rounded-kontrol px-2 text-[15px] font-semibold text-primer disabled:opacity-60">
            <CheckCheck className="size-5" aria-hidden /> Tandai semua dibaca
          </button>
        )}
      </div>
      {q.isPending ? <div className="bg-permukaan"><Skeleton baris={6} /></div>
        : q.isError ? <KeadaanGalat judul="Notifikasi gagal dimuat" onCobaLagi={() => q.refetch()} />
        : !q.data.length ? <KeadaanKosong judul="Belum ada notifikasi" pesan="Kabar persetujuan pengajuan dan slip gaji baru akan muncul di sini." />
        : <ul className="divide-y divide-garis border-b border-garis bg-permukaan">{q.data.map((n) => <ItemNotifikasi key={n.id} n={n} />)}</ul>}
    </div>
  )
}

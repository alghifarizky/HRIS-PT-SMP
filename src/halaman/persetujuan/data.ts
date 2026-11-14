// APR-01, APR-03 — Antrean & riwayat persetujuan Atasan (tingkat 1 untuk bawahan langsung). Nama & jabatan pengaju
// dari RPC anggota_tim (Atasan tidak membaca baris pengguna bawahan).
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useProfil } from '../../auth/sesi'
import { useAnggotaTim, type AnggotaTim } from '../absensi/data'
import { KOLOM, TABEL, type Cuti, type JenisPengajuan, type Lembur } from '../pengajuan/data'

export type Item<T> = T & { pengguna_id: string; pengaju: AnggotaTim }
export type Keputusan = { keputusan: 'disetujui' | 'ditolak'; diputuskan_pada: string }

export function usePersetujuanTim() {
  const saya = useProfil().data!.id
  const anggota = useAnggotaTim()
  const q = useQuery({
    queryKey: ['persetujuan_tim', saya],
    enabled: !!anggota.data,
    queryFn: async () => {
      const tim = new Map(anggota.data!.map((a) => [a.id, a]))
      const ids = [...tim.keys()]
      const menunggu = (jenis: JenisPengajuan) =>
        supabase.from(TABEL[jenis]).select(`${KOLOM[jenis]}, pengguna_id`).eq('status', 'menunggu').eq('tingkat_berikut', 1)
          .in('pengguna_id', ids).order('diajukan_pada') // paling lama menunggu di atas (desain B2 hal 4)
      // shortcut: 100 keputusan terakhir tanpa paginasi — cukup untuk satu tim; tambah paginasi bila riwayat terpotong
      const riwayat = supabase.from('persetujuan')
        .select(`keputusan, diputuskan_pada, pengajuan_lembur(${KOLOM.lembur}, pengguna_id), pengajuan_cuti(${KOLOM.cuti}, pengguna_id)`)
        .eq('penyetuju_id', saya).order('diputuskan_pada', { ascending: false }).limit(100)
      const [l, c, r] = await Promise.all([menunggu('lembur'), menunggu('cuti'), riwayat])
      for (const x of [l, c, r]) if (x.error) throw x.error
      const lengkapi = <T extends { pengguna_id: string }>(x: T) => ({ ...x, pengaju: tim.get(x.pengguna_id)! })
      type BarisRiwayat = Keputusan & { pengajuan_lembur: (Lembur & { pengguna_id: string }) | null; pengajuan_cuti: (Cuti & { pengguna_id: string }) | null }
      const rw = (r.data as unknown as BarisRiwayat[]).filter((x) => tim.has((x.pengajuan_lembur ?? x.pengajuan_cuti)!.pengguna_id))
      return {
        menunggu: {
          lembur: (l.data as unknown as (Lembur & { pengguna_id: string })[]).map(lengkapi),
          cuti: (c.data as unknown as (Cuti & { pengguna_id: string })[]).map(lengkapi),
        },
        riwayat: {
          lembur: rw.filter((x) => x.pengajuan_lembur).map((x) => ({ ...lengkapi(x.pengajuan_lembur!), keputusan: x.keputusan, diputuskan_pada: x.diputuskan_pada })),
          cuti: rw.filter((x) => x.pengajuan_cuti).map((x) => ({ ...lengkapi(x.pengajuan_cuti!), keputusan: x.keputusan, diputuskan_pada: x.diputuskan_pada })),
        },
      }
    },
  })
  return { ...q, isPending: anggota.isPending || q.isPending, isError: anggota.isError || q.isError, refetch: () => (anggota.refetch(), q.refetch()) }
}

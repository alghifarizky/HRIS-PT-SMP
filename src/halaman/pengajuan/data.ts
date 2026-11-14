// Data pengajuan milik sendiri (OT-04, LV-06). Tabel hanya dibaca; batalkan lewat RPC batalkan_pengajuan.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useProfil } from '../../auth/sesi'
import type { JenisCuti, StatusPengajuan } from '../../lib/pengajuan'

export type JenisPengajuan = 'lembur' | 'cuti'

export type Persetujuan = {
  tingkat: 1 | 2
  keputusan: 'disetujui' | 'ditolak'
  catatan: string | null
  diputuskan_pada: string
  penyetuju_nama: string | null
  penyetuju_jabatan: string | null
}
type Dasar = { id: string; nomor: string; status: StatusPengajuan; tingkat_berikut: 1 | 2 | null; alasan: string; diajukan_pada: string; selesai_pada: string | null }
export type Lembur = Dasar & { tanggal: string; jam_mulai: string; jam_selesai: string; hari_libur: boolean }
export type Cuti = Dasar & { jenis: JenisCuti; tanggal_mulai: string; tanggal_selesai: string; jumlah_hari: number; lampiran_path: string | null }

const KOLOM = { lembur: 'id, nomor, status, tingkat_berikut, alasan, diajukan_pada, selesai_pada, tanggal, jam_mulai, jam_selesai, hari_libur',
  cuti: 'id, nomor, status, tingkat_berikut, alasan, diajukan_pada, selesai_pada, jenis, tanggal_mulai, tanggal_selesai, jumlah_hari, lampiran_path' }
const TABEL = { lembur: 'pengajuan_lembur', cuti: 'pengajuan_cuti' } as const

export function usePengajuanSaya<J extends JenisPengajuan>(jenis: J) {
  const id = useProfil().data!.id
  return useQuery({
    queryKey: ['pengajuan', jenis, id],
    queryFn: async () => {
      // shortcut: 200 pengajuan terakhir tanpa paginasi — cukup untuk ±25 karyawan; tambah paginasi bila daftar terpotong
      const { data, error } = await supabase.from(TABEL[jenis]).select(KOLOM[jenis]).eq('pengguna_id', id)
        .order(jenis === 'lembur' ? 'tanggal' : 'tanggal_mulai', { ascending: false }).order('diajukan_pada', { ascending: false }).limit(200)
      if (error) throw error
      return data as unknown as (J extends 'lembur' ? Lembur : Cuti)[]
    },
  })
}

export function useDetailPengajuan(jenis: JenisPengajuan, id: string) {
  return useQuery({
    queryKey: ['pengajuan', jenis, 'detail', id],
    queryFn: async () => {
      const { data, error } = await supabase.from(TABEL[jenis])
        .select(`${KOLOM[jenis]}, pengguna_id, persetujuan(tingkat, keputusan, catatan, diputuskan_pada, penyetuju_nama, penyetuju_jabatan)`)
        .eq('id', id).maybeSingle()
      if (error) throw error
      return data as unknown as ((Lembur | Cuti) & { pengguna_id: string; persetujuan: Persetujuan[] }) | null
    },
  })
}

export function useLampiran(path: string | null) {
  return useQuery({
    queryKey: ['lampiran', path],
    enabled: !!path,
    staleTime: 50_000,
    refetchInterval: 50_000,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from('lampiran').createSignedUrl(path!, 60)
      if (error) throw error
      return data.signedUrl
    },
  })
}

export function useBatalkan(jenis: JenisPengajuan, id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('batalkan_pengajuan', { jenis, pengajuan: id })
      if (error) throw new Error(/tidak dapat dibatalkan/.test(error.message) ? 'Pengajuan sudah diproses sehingga tidak dapat dibatalkan.' : 'Pembatalan gagal. Periksa koneksi Anda, lalu coba lagi.')
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['pengajuan', jenis] }),
  })
}

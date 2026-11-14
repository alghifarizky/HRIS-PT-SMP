// NTF-01/02 — Notifikasi dalam aplikasi + penanda belum dibaca. RLS: hanya milik sendiri; kolom yang boleh diubah
// client hanya `dibaca`. Realtime: INSERT baru → segarkan angka & daftar terkait (tanpa toast — keputusan Al 14 Nov 2026).
import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useProfil } from '../../auth/sesi'
import type { Peran } from '../../auth/sesi'
import { TABEL, type JenisPengajuan } from '../pengajuan/data'

export type Notifikasi = { id: string; judul: string; pesan: string; jenis_objek: JenisPengajuan | 'absensi' | null; objek_id: string | null; dibaca: boolean; dibuat_pada: string }

export function useNotifikasi() {
  const id = useProfil().data!.id
  return useQuery({
    queryKey: ['notifikasi', id],
    queryFn: async () => {
      // shortcut: 50 terbaru tanpa paginasi — tambah "muat lebih" bila pengguna perlu riwayat lebih lama
      const { data, error } = await supabase.from('notifikasi').select('id, judul, pesan, jenis_objek, objek_id, dibaca, dibuat_pada')
        .eq('pengguna_id', id).order('dibuat_pada', { ascending: false }).limit(50)
      if (error) throw error
      return data as Notifikasi[]
    },
  })
}

export function useJumlahBelumDibaca() {
  const id = useProfil().data!.id
  return useQuery({
    queryKey: ['notifikasi', id, 'belum'],
    queryFn: async () => {
      const { count, error } = await supabase.from('notifikasi').select('id', { count: 'exact', head: true }).eq('pengguna_id', id).eq('dibaca', false)
      if (error) throw error
      return count ?? 0
    },
  })
}

/** Jumlah pengajuan yang menunggu keputusan saya (angka di menu Persetujuan). */
export function useJumlahMenungguSaya() {
  const { id, role } = useProfil().data!
  return useQuery({
    queryKey: ['jumlah_menunggu', id],
    enabled: role !== 'karyawan',
    queryFn: async () => {
      const hitung = (tabel: string) => {
        const q = role === 'direksi'
          ? supabase.from(tabel).select('id, pengguna:pengguna_id!inner(role)', { count: 'exact', head: true }).eq('tingkat_berikut', 1).in('pengguna.role', ['atasan', 'hr'])
          : role === 'hr'
            ? supabase.from(tabel).select('id', { count: 'exact', head: true }).eq('tingkat_berikut', 2)
            : supabase.from(tabel).select('id', { count: 'exact', head: true }).eq('tingkat_berikut', 1).neq('pengguna_id', id) // Atasan: RLS = sendiri + bawahan
        return q.eq('status', 'menunggu')
      }
      const [l, c] = await Promise.all([hitung('pengajuan_lembur'), hitung('pengajuan_cuti')])
      if (l.error) throw l.error
      if (c.error) throw c.error
      return (l.count ?? 0) + (c.count ?? 0)
    },
  })
}

export function useTandaiDibaca() {
  const qc = useQueryClient()
  const id = useProfil().data!.id
  return useMutation({
    mutationFn: async (notif: string | 'semua') => {
      const q = supabase.from('notifikasi').update({ dibaca: true }).eq('pengguna_id', id).eq('dibaca', false)
      const { error } = notif === 'semua' ? await q : await q.eq('id', notif)
      if (error) throw new Error('Gagal menandai dibaca. Periksa koneksi Anda.')
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['notifikasi', id] }),
  })
}

/** Halaman tujuan saat notifikasi diketuk: absensi → detail absensi; pengaju → detail pengajuan; penyetuju → layar
 *  persetujuan sesuai peran. */
export async function tujuanNotifikasi(n: Notifikasi, saya: { id: string; role: Peran }) {
  if (!n.jenis_objek || !n.objek_id) return null
  if (n.jenis_objek === 'absensi') {
    // Auto clock out / koreksi HR — selalu absensi milik pembaca
    const { data } = await supabase.from('absensi').select('tanggal').eq('id', n.objek_id).maybeSingle()
    return data ? `/absensi/${(data as { tanggal: string }).tanggal}` : null
  }
  const { data } = await supabase.from(TABEL[n.jenis_objek]).select('pengguna_id').eq('id', n.objek_id).maybeSingle()
  if (!data) return null
  if ((data as { pengguna_id: string }).pengguna_id === saya.id) return `/pengajuan/${n.jenis_objek}/${n.objek_id}`
  if (saya.role === 'atasan') return `/persetujuan/${n.jenis_objek}/${n.objek_id}`
  return `/panel/persetujuan${n.jenis_objek === 'cuti' ? '?tab=cuti' : ''}`
}

/** Pasang sekali di setiap shell (mobile & panel). */
export function useRealtimeNotifikasi() {
  const id = useProfil().data!.id
  const qc = useQueryClient()
  useEffect(() => {
    const kanal = supabase
      .channel(`notifikasi:${id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifikasi', filter: `pengguna_id=eq.${id}` }, () => {
        for (const k of ['notifikasi', 'jumlah_menunggu', 'persetujuan_tim', 'persetujuan_panel', 'pengajuan', 'data_cuti'])
          qc.invalidateQueries({ queryKey: [k] })
      })
      .subscribe()
    return () => { supabase.removeChannel(kanal) }
  }, [id, qc])
}

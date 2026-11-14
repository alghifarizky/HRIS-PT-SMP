// APR-01, APR-03 — Antrean & riwayat persetujuan Atasan (tingkat 1 untuk bawahan langsung). Nama & jabatan pengaju
// dari RPC anggota_tim (Atasan tidak membaca baris pengguna bawahan).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
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

/** Konteks keputusan (B2 hal 11–20): lembur → jadwal & clock in pengaju hari itu; cuti → kalender & anggota tim
 *  lain yang cuti/sakit/izin di tanggal yang sama (menunggu/disetujui). */
export function useKonteksPersetujuan(p: { jenis: JenisPengajuan; pengguna_id: string; mulai: string; selesai: string } | null) {
  const anggota = useAnggotaTim()
  return useQuery({
    queryKey: ['konteks_persetujuan', p],
    enabled: !!p && !!anggota.data,
    queryFn: async () => {
      if (p!.jenis === 'lembur') {
        const [jadwal, absensi] = await Promise.all([
          supabase.rpc('jadwal_tanggal', { tgl: p!.mulai }),
          supabase.from('absensi').select('jam_masuk, terlambat').eq('pengguna_id', p!.pengguna_id).eq('tanggal', p!.mulai).maybeSingle(),
        ])
        if (jadwal.error) throw jadwal.error
        if (absensi.error) throw absensi.error
        return {
          jadwal: ((jadwal.data as { jam_masuk: string; jam_pulang: string }[])[0] ?? null),
          absensi: absensi.data as { jam_masuk: string; terlambat: boolean } | null,
          kalender: null,
          bentrok: [],
        }
      }
      const lain = anggota.data!.filter((a) => a.id !== p!.pengguna_id)
      const [jadwal, libur, bentrok] = await Promise.all([
        supabase.from('jadwal_kerja').select('hari'),
        supabase.from('hari_libur').select('tanggal, keterangan').gte('tanggal', p!.mulai).lte('tanggal', p!.selesai),
        supabase.from('pengajuan_cuti').select('pengguna_id, jenis, tanggal_mulai, tanggal_selesai, status')
          .in('pengguna_id', lain.map((a) => a.id)).in('status', ['menunggu', 'disetujui'])
          .lte('tanggal_mulai', p!.selesai).gte('tanggal_selesai', p!.mulai),
      ])
      for (const r of [jadwal, libur, bentrok]) if (r.error) throw r.error
      const nama = new Map(lain.map((a) => [a.id, a]))
      return {
        jadwal: null,
        absensi: null,
        kalender: {
          hariKerja: new Set((jadwal.data as { hari: number }[]).map((j) => j.hari)),
          libur: new Map((libur.data as { tanggal: string; keterangan: string }[]).map((l) => [l.tanggal, l.keterangan])),
        },
        bentrok: (bentrok.data as { pengguna_id: string; jenis: string; tanggal_mulai: string; tanggal_selesai: string; status: string }[])
          .map((b) => ({ ...b, anggota: nama.get(b.pengguna_id)! })),
      }
    },
  })
}

export function usePutuskan(jenis: JenisPengajuan, id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: { putusan: 'disetujui' | 'ditolak'; catatan: string }) => {
      const { error } = await supabase.rpc('putuskan_pengajuan', { jenis, pengajuan: id, putusan: v.putusan, catatan_isi: v.catatan.trim() || null })
      if (error) {
        if (['23514', '42501', 'P0002'].includes(error.code ?? '')) throw new Error(error.message)
        throw new Error('Keputusan gagal disimpan. Periksa koneksi Anda lalu coba lagi. Catatan Anda tidak hilang.')
      }
    },
    onSettled: () => Promise.all([
      qc.invalidateQueries({ queryKey: ['persetujuan_tim'] }),
      qc.invalidateQueries({ queryKey: ['pengajuan', jenis, 'detail', id] }),
    ]),
  })
}

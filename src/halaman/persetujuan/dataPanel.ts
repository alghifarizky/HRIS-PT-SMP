// APR-01–03 — Persetujuan di panel: HR tingkat 2 (pengajuan karyawan yang sudah disetujui atasan, B3B hal 1–8) dan
// Direksi (tingkat 1 pengajuan Atasan/HR, langsung final — B4 hal 2–10, 47–53). HR & Direksi membaca tabel pengguna
// penuh, jadi data pengaju di-embed langsung.
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useProfil } from '../../auth/sesi'
import type { Peran } from '../../auth/sesi'
import { KOLOM, TABEL, type Cuti, type JenisPengajuan, type Lembur, type Persetujuan } from '../pengajuan/data'

export type Pengaju = { nama: string; jabatan: string | null; role: Peran; atasan_id: string | null; saldo_cuti: number | null }
export type ItemPanel<T = Lembur | Cuti> = T & { pengguna_id: string; pengguna: Pengaju; persetujuan: Persetujuan[] }
export type ItemRiwayat<T = Lembur | Cuti> = ItemPanel<T> & { keputusan: 'disetujui' | 'ditolak'; diputuskan_pada: string }

const SUB = (jenis: JenisPengajuan, inner = false) =>
  `${KOLOM[jenis]}, pengguna_id, pengguna:pengguna_id${inner ? '!inner' : ''}(nama, jabatan, role, atasan_id, saldo_cuti), persetujuan(tingkat, keputusan, catatan, diputuskan_pada, penyetuju_nama, penyetuju_jabatan)`

export function usePersetujuanPanel() {
  const { id: saya, role } = useProfil().data!
  const direksi = role === 'direksi'
  return useQuery({
    queryKey: ['persetujuan_panel', saya],
    queryFn: async () => {
      const menunggu = (jenis: JenisPengajuan) => direksi
        ? supabase.from(TABEL[jenis]).select(SUB(jenis, true)).eq('status', 'menunggu').eq('tingkat_berikut', 1)
            .in('pengguna.role', ['atasan', 'hr']).order('diajukan_pada')
        : supabase.from(TABEL[jenis]).select(SUB(jenis)).eq('status', 'menunggu').eq('tingkat_berikut', 2).order('diajukan_pada')
      // shortcut: 100 keputusan terakhir tanpa paginasi — tambah paginasi bila riwayat terpotong
      const riwayat = supabase.from('persetujuan')
        .select(`keputusan, diputuskan_pada, pengajuan_lembur(${SUB('lembur')}), pengajuan_cuti(${SUB('cuti')})`)
        .eq('penyetuju_id', saya).order('diputuskan_pada', { ascending: false }).limit(100)
      const [l, c, r] = await Promise.all([menunggu('lembur'), menunggu('cuti'), riwayat])
      for (const x of [l, c, r]) if (x.error) throw x.error
      type Baris = { keputusan: 'disetujui' | 'ditolak'; diputuskan_pada: string; pengajuan_lembur: ItemPanel<Lembur> | null; pengajuan_cuti: ItemPanel<Cuti> | null }
      const rw = r.data as unknown as Baris[]
      // Paling lama menunggu di atas (B3B hal 1, B4 hal 2)
      const urut = <T extends ItemPanel>(xs: T[]) => xs.sort((a, b) => sejak(a).localeCompare(sejak(b)))
      return {
        menunggu: { lembur: urut(l.data as unknown as ItemPanel<Lembur>[]), cuti: urut(c.data as unknown as ItemPanel<Cuti>[]) },
        riwayat: {
          lembur: rw.filter((x) => x.pengajuan_lembur).map((x) => ({ ...x.pengajuan_lembur!, keputusan: x.keputusan, diputuskan_pada: x.diputuskan_pada })),
          cuti: rw.filter((x) => x.pengajuan_cuti).map((x) => ({ ...x.pengajuan_cuti!, keputusan: x.keputusan, diputuskan_pada: x.diputuskan_pada })),
        },
      }
    },
  })
}

/** Mulai menunggu: HR sejak keputusan tingkat 1; Direksi sejak diajukan. */
export const sejak = (x: ItemPanel) => x.persetujuan.find((p) => p.tingkat === 1)?.diputuskan_pada ?? x.diajukan_pada

/** Konteks cuti: kalender & rekan satu atasan yang cuti/sakit/izin di rentang yang sama. Lembur: jadwal & clock in. */
export function useKonteksPanel(x: ItemPanel | null, jenis: JenisPengajuan) {
  return useQuery({
    queryKey: ['konteks_panel', jenis, x?.id],
    enabled: !!x,
    queryFn: async () => {
      if (jenis === 'lembur') {
        const l = x as ItemPanel<Lembur>
        const [jadwal, absensi] = await Promise.all([
          supabase.rpc('jadwal_tanggal', { tgl: l.tanggal }),
          supabase.from('absensi').select('jam_masuk, terlambat').eq('pengguna_id', l.pengguna_id).eq('tanggal', l.tanggal).maybeSingle(),
        ])
        if (jadwal.error) throw jadwal.error
        if (absensi.error) throw absensi.error
        return { jadwal: (jadwal.data as { jam_masuk: string; jam_pulang: string }[])[0] ?? null, absensi: absensi.data as { jam_masuk: string; terlambat: boolean } | null, kalender: null, bentrok: [] }
      }
      const c = x as ItemPanel<Cuti>
      const [jadwal, libur, bentrok] = await Promise.all([
        supabase.from('jadwal_kerja').select('hari'),
        supabase.from('hari_libur').select('tanggal, keterangan').gte('tanggal', c.tanggal_mulai).lte('tanggal', c.tanggal_selesai),
        c.pengguna.atasan_id
          ? supabase.from('pengajuan_cuti').select('jenis, tanggal_mulai, tanggal_selesai, status, pengguna:pengguna_id!inner(nama, jabatan, atasan_id)')
              .eq('pengguna.atasan_id', c.pengguna.atasan_id).neq('pengguna_id', c.pengguna_id).in('status', ['menunggu', 'disetujui'])
              .lte('tanggal_mulai', c.tanggal_selesai).gte('tanggal_selesai', c.tanggal_mulai)
          : Promise.resolve({ data: [], error: null }),
      ])
      for (const r of [jadwal, libur, bentrok]) if (r.error) throw r.error
      return {
        jadwal: null,
        absensi: null,
        kalender: {
          hariKerja: new Set((jadwal.data as { hari: number }[]).map((j) => j.hari)),
          libur: new Map((libur.data as { tanggal: string; keterangan: string }[]).map((l) => [l.tanggal, l.keterangan])),
        },
        bentrok: bentrok.data as unknown as { jenis: string; tanggal_mulai: string; tanggal_selesai: string; status: string; pengguna: { nama: string; jabatan: string | null } }[],
      }
    },
  })
}

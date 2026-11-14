// Data absensi hari ini (pengguna sendiri) + jadwal hari ini + selisih jam server.
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { hariIniDb } from '../../lib/format'
import { useProfil } from '../../auth/sesi'

export type BarisAbsensi = {
  id: string
  tanggal: string
  jam_masuk: string
  jam_keluar: string | null
  foto_masuk_path: string | null
  foto_keluar_path: string | null
  terlambat: boolean
  auto_clock_out: boolean
  dikoreksi_oleh: string | null
  alasan_koreksi: string | null
  jam_masuk_semula: string | null
  jam_keluar_semula: string | null
  dikoreksi_pada: string | null
  dikoreksi_oleh_nama: string | null
}

export const KOLOM_ABSENSI =
  'id, tanggal, jam_masuk, jam_keluar, foto_masuk_path, foto_keluar_path, terlambat, auto_clock_out, dikoreksi_oleh, alasan_koreksi, jam_masuk_semula, jam_keluar_semula, dikoreksi_pada, dikoreksi_oleh_nama'
export type Jadwal = { jam_masuk: string; jam_pulang: string }

/** Absensi & jadwal hari ini. jadwal null = hari libur (Minggu / tanggal merah / cuti bersama).
 *  belumMulai = hari ini sebelum tanggal masuk (clock in ditolak server — dicek di awal agar tidak sempat memotret). */
export function useAbsensiHariIni() {
  const id = useProfil().data!.id
  const tanggal = hariIniDb()
  return useQuery({
    queryKey: ['absensi_hari_ini', id, tanggal],
    queryFn: async () => {
      const [absensi, jadwal, saya] = await Promise.all([
        supabase
          .from('absensi')
          .select(KOLOM_ABSENSI)
          .eq('pengguna_id', id)
          .eq('tanggal', tanggal)
          .maybeSingle(),
        supabase.rpc('jadwal_tanggal', { tgl: tanggal }),
        supabase.from('pengguna').select('tanggal_masuk').eq('id', id).single(),
      ])
      if (absensi.error) throw absensi.error
      if (jadwal.error) throw jadwal.error
      if (saya.error) throw saya.error
      const tanggalMasuk = (saya.data as { tanggal_masuk: string | null }).tanggal_masuk
      return {
        tanggal,
        absensi: absensi.data as BarisAbsensi | null,
        jadwal: ((jadwal.data as Jadwal[])[0] ?? null) as Jadwal | null,
        mulaiBekerja: tanggalMasuk && tanggal < tanggalMasuk ? tanggalMasuk : null,
      }
    },
  })
}

/** Selisih (ms) jam server terhadap jam perangkat — untuk jam berdetik di layar kamera. */
export function useSelisihServer() {
  return useQuery({
    queryKey: ['waktu_server'],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const sebelum = Date.now()
      const { data, error } = await supabase.rpc('waktu_server')
      if (error) throw error
      const sesudah = Date.now()
      return new Date(data as string).getTime() - (sebelum + sesudah) / 2
    },
  })
}

/** Riwayat satu bulan ("YYYY-MM") milik pengguna sendiri + bahan penyusun (libur, hari kerja, tanggal masuk). */
export function useRiwayatAbsensi(bulan: string) {
  const id = useProfil().data!.id
  return useQuery({
    queryKey: ['riwayat_absensi', id, bulan],
    queryFn: async () => {
      const awal = `${bulan}-01`
      const [th, bl] = bulan.split('-').map(Number)
      const bulanDepan = bl === 12 ? `${th + 1}-01-01` : `${th}-${String(bl + 1).padStart(2, '0')}-01` // < tgl 1 bulan depan
      const [absensi, libur, jadwal, saya] = await Promise.all([
        supabase.from('absensi').select(KOLOM_ABSENSI).eq('pengguna_id', id).gte('tanggal', awal).lt('tanggal', bulanDepan),
        supabase.from('hari_libur').select('tanggal').gte('tanggal', awal).lt('tanggal', bulanDepan),
        supabase.from('jadwal_kerja').select('hari, jam_pulang'),
        supabase.from('pengguna').select('tanggal_masuk').eq('id', id).single(),
      ])
      for (const r of [absensi, libur, jadwal, saya]) if (r.error) throw r.error
      return {
        absensi: absensi.data as BarisAbsensi[],
        libur: new Set((libur.data as { tanggal: string }[]).map((l) => l.tanggal)),
        hariKerja: new Set((jadwal.data as { hari: number }[]).map((j) => j.hari)),
        // jam pulang per hari (isodow) — untuk badge "lebih cepat"; hari libur tidak punya jadwal
        jamPulang: new Map((jadwal.data as { hari: number; jam_pulang: string }[]).map((j) => [j.hari, j.jam_pulang])),
        tanggalMasuk: (saya.data as { tanggal_masuk: string | null }).tanggal_masuk,
      }
    },
  })
}

/** Satu hari absensi milik sendiri + jadwal hari itu. */
export function useAbsensiTanggal(tanggal: string) {
  const id = useProfil().data!.id
  return useQuery({
    queryKey: ['absensi_tanggal', id, tanggal],
    queryFn: async () => {
      const [absensi, jadwal] = await Promise.all([
        supabase.from('absensi').select(KOLOM_ABSENSI).eq('pengguna_id', id).eq('tanggal', tanggal).maybeSingle(),
        supabase.rpc('jadwal_tanggal', { tgl: tanggal }),
      ])
      if (absensi.error) throw absensi.error
      if (jadwal.error) throw jadwal.error
      return { absensi: absensi.data as BarisAbsensi | null, jadwal: ((jadwal.data as Jadwal[])[0] ?? null) as Jadwal | null }
    },
  })
}

/** Signed URL selfie berumur pendek (security §5); dimuat ulang sebelum kedaluwarsa. */
export function useFotoSelfie(path: string | null) {
  return useQuery({
    queryKey: ['foto_selfie', path],
    enabled: !!path,
    staleTime: 50_000,
    refetchInterval: 50_000,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from('selfie').createSignedUrl(path!, 60)
      if (error) throw error
      return data.signedUrl
    },
  })
}

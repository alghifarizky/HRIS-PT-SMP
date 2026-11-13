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
}
export type Jadwal = { jam_masuk: string; jam_pulang: string }

/** Absensi & jadwal hari ini. jadwal null = hari libur (Minggu / tanggal merah / cuti bersama). */
export function useAbsensiHariIni() {
  const id = useProfil().data!.id
  const tanggal = hariIniDb()
  return useQuery({
    queryKey: ['absensi_hari_ini', id, tanggal],
    queryFn: async () => {
      const [absensi, jadwal] = await Promise.all([
        supabase
          .from('absensi')
          .select('id, tanggal, jam_masuk, jam_keluar, foto_masuk_path, foto_keluar_path, terlambat, auto_clock_out, dikoreksi_oleh, alasan_koreksi')
          .eq('pengguna_id', id)
          .eq('tanggal', tanggal)
          .maybeSingle(),
        supabase.rpc('jadwal_tanggal', { tgl: tanggal }),
      ])
      if (absensi.error) throw absensi.error
      if (jadwal.error) throw jadwal.error
      return { tanggal, absensi: absensi.data as BarisAbsensi | null, jadwal: ((jadwal.data as Jadwal[])[0] ?? null) as Jadwal | null }
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

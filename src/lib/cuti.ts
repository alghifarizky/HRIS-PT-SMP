// Cermin public.jatah_cuti_proporsional (migrasi 20261113012002) — HANYA untuk pratinjau di form.
// Nilai sebenarnya selalu dihitung database saat karyawan ditambahkan.
const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']

/** tanggal "YYYY-MM-DD". Bulan masuk dihitung penuh bila masuk tanggal 1 (keputusan Al, 13 Nov 2026). */
export function jatahProporsional(jatah: number, tanggalMasuk: string, perTanggal: string) {
  const [tm, bm, hm] = tanggalMasuk.split('-').map(Number)
  const [tp] = perTanggal.split('-').map(Number)
  if (tm < tp) return { hari: jatah, bulan: [] as string[], jenis: 'penuh' as const }
  if (tm > tp) return { hari: 0, bulan: [] as string[], jenis: 'tahun_depan' as const }
  const bulan = BULAN.slice(hm === 1 ? bm - 1 : bm)
  return { hari: Math.floor((jatah * bulan.length) / 12), bulan, jenis: 'proporsional' as const }
}

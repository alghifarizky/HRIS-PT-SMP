// Hitungan tampilan absensi (status terlambat dari DB tetap sumber kebenaran — kolom absensi.terlambat).
// Keputusan Al (13 Nov 2026): toleransi 5 menit; lama terlambat dihitung dari jam masuk jadwal;
// pulang lebih cepat ditampilkan "lebih cepat N menit".
const fmtJamMenitWib = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })

/** Date → "06:52" (WIB). */
export const jamWib = (d: Date) => fmtJamMenitWib.format(d)

const menitDari = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

/** Menit terlambat dari jam masuk jadwal (0 bila tidak terlambat). jadwalMasuk "07:00" / "07:00:00". */
export const menitTerlambat = (jamMasuk: Date, jadwalMasuk: string) => Math.max(0, menitDari(jamWib(jamMasuk)) - menitDari(jadwalMasuk))

/** Menit pulang lebih cepat dari jam pulang jadwal (0 bila tepat / lebih lambat). */
export const menitLebihCepat = (jamKeluar: Date, jadwalPulang: string) => Math.max(0, menitDari(jadwalPulang) - menitDari(jamWib(jamKeluar)))

/** Durasi "8 j 12 m". */
export function durasi(dari: Date, sampai: Date) {
  const menit = Math.max(0, Math.floor((sampai.getTime() - dari.getTime()) / 60_000))
  return `${Math.floor(menit / 60)} j ${String(menit % 60).padStart(2, '0')} m`
}

type AbsensiRingkas = { tanggal: string; jam_masuk: string; jam_keluar: string | null; terlambat: boolean; auto_clock_out: boolean }
export type BarisRiwayat<A> = { tanggal: string; absensi: A | null }

const tambahHari = (tgl: string, n: number) => {
  const d = new Date(`${tgl}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
/** ISO day of week 1 (Senin) … 7 (Minggu) untuk "YYYY-MM-DD". */
export const hariIso = (tgl: string) => ((new Date(`${tgl}T00:00:00Z`).getUTCDay() + 6) % 7) + 1

/**
 * Daftar riwayat satu bulan (terbaru di atas): semua hari yang punya absensi + hari kerja yang sudah lewat
 * tanpa absensi ("Tanpa absensi", keputusan Al 14 Nov 2026), mulai tanggal masuk. Hari kerja = Sen–Sab yang
 * ada di jadwal & bukan hari libur. Hari ini tanpa absensi tidak ditampilkan (masih bisa clock in).
 * Hari hadir = hari kerja yang punya absensi (PRD §6; lembur hari libur tidak dihitung).
 */
export function susunRiwayat<A extends AbsensiRingkas>(p: {
  bulan: string // "YYYY-MM"
  absensi: A[]
  libur: Set<string>
  hariKerja: Set<number> // isodow yang punya jadwal (1–6)
  tanggalMasuk: string | null
  hariIni: string
}) {
  const perTanggal = new Map(p.absensi.map((a) => [a.tanggal, a]))
  const akhirBulan = tambahHari(`${tambahHari(`${p.bulan}-28`, 4).slice(0, 7)}-01`, -1)
  const mulai = p.tanggalMasuk && p.tanggalMasuk > `${p.bulan}-01` ? p.tanggalMasuk : `${p.bulan}-01`
  const akhir = p.hariIni < akhirBulan ? p.hariIni : akhirBulan
  const adalahHariKerja = (t: string) => p.hariKerja.has(hariIso(t)) && !p.libur.has(t)

  const baris: BarisRiwayat<A>[] = []
  for (let t = akhir; t >= mulai; t = tambahHari(t, -1)) {
    const a = perTanggal.get(t) ?? null
    if (a || (adalahHariKerja(t) && t < p.hariIni)) baris.push({ tanggal: t, absensi: a })
  }
  return {
    baris,
    hadir: p.absensi.filter((a) => adalahHariKerja(a.tanggal)).length,
    terlambat: p.absensi.filter((a) => a.terlambat).length,
    autoClockOut: p.absensi.filter((a) => a.auto_clock_out).length,
  }
}

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

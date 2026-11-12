// Format tampilan — selalu WIB (Asia/Jakarta), apa pun zona waktu perangkat.
const ZONA = 'Asia/Jakarta'

const fmtTanggal = new Intl.DateTimeFormat('id-ID', { timeZone: ZONA, weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })
const fmtJam = new Intl.DateTimeFormat('id-ID', { timeZone: ZONA, hour: 'numeric', hourCycle: 'h23' })

/** "Kamis, 12 Nov 2026" */
export const tanggalPanjang = (d: Date) => fmtTanggal.format(d)

/** Sapaan menurut jam WIB (keputusan Al, 13 Nov 2026): pagi 04–10, siang 11–14, sore 15–17, malam 18–03. */
export function sapaan(d: Date) {
  const jam = Number(fmtJam.format(d))
  if (jam >= 4 && jam < 11) return 'Selamat pagi'
  if (jam >= 11 && jam < 15) return 'Selamat siang'
  if (jam >= 15 && jam < 18) return 'Selamat sore'
  return 'Selamat malam'
}

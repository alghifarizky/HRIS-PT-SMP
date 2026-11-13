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

const fmtTanggalPendek = new Intl.DateTimeFormat('id-ID', { timeZone: ZONA, day: 'numeric', month: 'short', year: 'numeric' })
const fmtHari = new Intl.DateTimeFormat('id-ID', { timeZone: ZONA, weekday: 'long' })

/** Kolom `date` Postgres ("2026-12-25") → Date pada tengah malam WIB. */
export const dariTanggalDb = (s: string) => new Date(`${s}T00:00:00+07:00`)

/** "25 Des 2026" */
export const tanggalPendek = (d: Date) => fmtTanggalPendek.format(d)

/** "Jumat" */
export const namaHari = (d: Date) => fmtHari.format(d)

/** Tahun berjalan menurut WIB. */
export const tahunIni = () => Number(new Intl.DateTimeFormat('en-CA', { timeZone: ZONA, year: 'numeric' }).format(new Date()))

const fmtRupiah = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 })
/** 4500000 → "Rp 4.500.000" */
export const rupiah = (n: number) => `Rp ${fmtRupiah.format(n)}`

/** Tanggal hari ini (WIB) sebagai "YYYY-MM-DD". */
export const hariIniDb = () => new Intl.DateTimeFormat('en-CA', { timeZone: ZONA }).format(new Date())

const fmtTglSingkat = new Intl.DateTimeFormat('id-ID', { timeZone: ZONA, weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
const fmtJamMenit = new Intl.DateTimeFormat('id-ID', { timeZone: ZONA, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
/** "Kam, 12 Nov 2026 · 06:51" (WIB) */
export const waktuSingkat = (d: Date) => `${fmtTglSingkat.format(d)} · ${fmtJamMenit.format(d).replace('.', ':')}`

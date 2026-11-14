// Format & label pengajuan lembur / cuti-sakit-izin (B1 hal 31–39).
import { dariTanggalDb } from './format'
import { hariIso, tambahHari } from './absensi'

export type StatusPengajuan = 'menunggu' | 'disetujui' | 'ditolak' | 'dibatalkan'
export type JenisCuti = 'cuti' | 'sakit' | 'izin'

export const LABEL_STATUS: Record<StatusPengajuan, string> = { menunggu: 'Menunggu', disetujui: 'Disetujui', ditolak: 'Ditolak', dibatalkan: 'Dibatalkan' }
export const NADA_STATUS = { menunggu: 'peringatan', disetujui: 'sukses', ditolak: 'bahaya', dibatalkan: 'netral' } as const
export const LABEL_JENIS_CUTI: Record<JenisCuti, string> = { cuti: 'Cuti tahunan', sakit: 'Sakit', izin: 'Izin' }

/** "15:00:00", "17:30:00" → "2,5 jam" */
export function durasiJam(mulai: string, selesai: string) {
  const menit = (j: string) => Number(j.slice(0, 2)) * 60 + Number(j.slice(3, 5))
  return `${String((menit(selesai) - menit(mulai)) / 60).replace('.', ',')} jam`
}

const ZONA = 'Asia/Jakarta'
const fmt = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('id-ID', { timeZone: ZONA, ...o })
const fHari = fmt({ weekday: 'short' })
const fTgl = fmt({ day: 'numeric' })
const fTglBln = fmt({ day: 'numeric', month: 'short' })
const fLengkap = fmt({ day: 'numeric', month: 'short', year: 'numeric' })

/** Rentang tanggal ringkas: "Sen, 2 Nov 2026" · "24 – 29 Des 2026" · "30 Nov – 2 Des 2026".
 *  denganHari: "Kam, 24 Des – Sel, 29 Des 2026" (detail). */
export function rentangTanggal(mulai: string, selesai: string, denganHari = false) {
  const a = dariTanggalDb(mulai)
  const b = dariTanggalDb(selesai)
  if (mulai === selesai) return `${fHari.format(a)}, ${fLengkap.format(a)}`
  if (denganHari) return `${fHari.format(a)}, ${fTglBln.format(a)} – ${fHari.format(b)}, ${fLengkap.format(b)}`
  const awal = mulai.slice(0, 7) === selesai.slice(0, 7) ? fTgl.format(a) : fTglBln.format(a)
  return `${awal} – ${fLengkap.format(b)}`
}

const keMenit = (j: string) => Number(j.slice(0, 2)) * 60 + Number(j.slice(3, 5))

/** 150 → "2 jam 30 menit", 240 → "4 jam" */
export const teksDurasi = (menit: number) => [Math.floor(menit / 60) && `${Math.floor(menit / 60)} jam`, menit % 60 && `${menit % 60} menit`].filter(Boolean).join(' ')

/** Cermin aturan catat_ajukan_lembur (OT-02, keputusan Al 14 Nov 2026) agar pengguna tahu sebelum mengirim.
 *  Jam "HH:MM" yang sudah valid; jamPulang null = hari libur; sekarang = tanggal & jam WIB perangkat. */
export function cekLembur(p: { tanggal: string; mulai: string; selesai: string; jamPulang: string | null; hariIni: string; jamSekarang: string }) {
  const menit = keMenit(p.selesai) - keMenit(p.mulai)
  const pulang = p.jamPulang?.slice(0, 5) ?? null
  const galat: { tanggal?: string; mulai?: string; selesai?: string } = {}
  if (p.tanggal < p.hariIni) galat.tanggal = 'Tanggal lembur tidak boleh sebelum hari ini.'
  else if (p.tanggal === p.hariIni && p.jamSekarang > (pulang ?? p.mulai))
    galat.tanggal = pulang ? `Batas pengajuan hari ini (jam pulang ${pulang}) sudah lewat.` : 'Jam mulai lembur sudah lewat — pengajuan hari libur harus sebelum jam mulai.'
  if (pulang && p.mulai < pulang) galat.mulai = `Lembur hari kerja dimulai paling cepat jam pulang (${pulang}).`
  if (menit <= 0) galat.selesai = 'Jam selesai harus setelah jam mulai.'
  else if (menit % 30) galat.selesai = 'Durasi lembur harus kelipatan 30 menit.'
  return { menit, galat }
}

// ---------------- Cuti / sakit / izin (cermin hitung_hari_kerja & hari_kerja_mundur di SQL) ----------------
export type Kalender = { hariKerja: Set<number>; libur: Map<string, string> }
const hariKerja = (tgl: string, k: Kalender) => k.hariKerja.has(hariIso(tgl)) && !k.libur.has(tgl)

/** Jumlah hari kerja dalam [mulai, selesai] + hari yang tidak dihitung ("Jum 25 Des (Natal)", "Min 27 Des"). */
export function ringkasCuti(mulai: string, selesai: string, k: Kalender) {
  let jumlah = 0
  const tidakDihitung: string[] = []
  for (let t = mulai; t <= selesai; t = tambahHari(t, 1)) {
    if (hariKerja(t, k)) jumlah++
    else tidakDihitung.push(`${fHari.format(dariTanggalDb(t))} ${fTglBln.format(dariTanggalDb(t))}${k.libur.has(t) ? ` (${k.libur.get(t)})` : ''}`)
  }
  return { jumlah, tidakDihitung }
}

/** Tanggal hari kerja ke-n mulai `mulai` (batas tanggal selesai agar cukup saldo). null bila n < 1. */
export function hariKerjaKe(mulai: string, n: number, k: Kalender) {
  if (n < 1) return null
  for (let t = mulai, i = 0; i < 400; t = tambahHari(t, 1), i++) if (hariKerja(t, k) && --n === 0) return t
  return null
}

/** Hari kerja ke-n sebelum `tgl` — batas paling awal pengajuan sakit (3 hari kerja). */
export function hariKerjaMundur(tgl: string, n: number, k: Kalender) {
  let t = tgl
  for (let i = 0; n > 0 && i < 31; i++) if (hariKerja((t = tambahHari(t, -1)), k)) n--
  return t
}

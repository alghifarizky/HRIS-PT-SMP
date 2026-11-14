// Format & label pengajuan lembur / cuti-sakit-izin (B1 hal 31–39).
import { dariTanggalDb } from './format'

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

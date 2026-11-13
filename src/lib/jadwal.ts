// Keterangan jadwal kerja (keputusan Al, 13 Nov 2026 — PRD §6.2): Sen–Jum termasuk istirahat 1 jam, Sabtu tanpa istirahat.
export const NAMA_HARI = ['', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'] as const

const menit = (jam: string) => {
  const [h, m] = jam.split(':').map(Number)
  return h * 60 + m
}
const angka = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 })

const POLA_JAM = /^([01]\d|2[0-3]):[0-5]\d$/
export const jamValid = (jam: string) => POLA_JAM.test(jam)

/** Rapikan ketikan jam ke "HH:MM" 24 jam: "1530" / "15.30" / "7:0" → "15:30" / "07:00". Tak dikenali → apa adanya. */
export function rapikanJam(ketik: string): string {
  const t = ketik.trim()
  const m = t.match(/^(\d{1,2})[:.](\d{1,2})$/) ?? t.match(/^(\d{1,2})(\d{2})$/) ?? t.match(/^(\d{1,2})$/)
  if (!m) return t
  const hasil = `${m[1].padStart(2, '0')}:${(m[2] ?? '0').padStart(2, '0')}`
  return jamValid(hasil) ? hasil : t
}

/** null bila jam tidak valid (pulang ≤ masuk, atau Sen–Jum ≤ 1 jam sehingga tak ada jam kerja). */
export function keteranganJadwal(hari: number, masuk: string, pulang: string): string | null {
  if (!jamValid(masuk.slice(0, 5)) || !jamValid(pulang.slice(0, 5))) return null
  const jam = (menit(pulang) - menit(masuk)) / 60
  if (hari <= 5) return jam > 1 ? `${angka.format(jam - 1)} jam kerja + 1 jam istirahat` : null
  return jam > 0 ? `${angka.format(jam)} jam · hari kerja terpendek` : null
}

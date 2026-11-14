import { describe, expect, it } from 'vitest'
import { cekLembur, durasiJam, rentangTanggal, teksDurasi } from './pengajuan'

describe('pengajuan', () => {
  it('durasi jam lembur', () => {
    expect(durasiJam('12:00:00', '14:30:00')).toBe('2,5 jam')
    expect(durasiJam('15:00:00', '17:00:00')).toBe('2 jam')
  })
  it('rentang tanggal', () => {
    expect(rentangTanggal('2026-11-02', '2026-11-02')).toBe('Sen, 2 Nov 2026')
    expect(rentangTanggal('2026-12-24', '2026-12-29')).toBe('24 – 29 Des 2026')
    expect(rentangTanggal('2026-11-30', '2026-12-02')).toBe('30 Nov – 2 Des 2026')
    expect(rentangTanggal('2026-12-24', '2026-12-29', true)).toBe('Kam, 24 Des – Sel, 29 Des 2026')
  })
  it('teks durasi', () => {
    expect(teksDurasi(150)).toBe('2 jam 30 menit')
    expect(teksDurasi(240)).toBe('4 jam')
    expect(teksDurasi(30)).toBe('30 menit')
  })
  it('cek lembur (cermin SQL)', () => {
    const dasar = { tanggal: '2026-11-16', mulai: '15:00', selesai: '17:30', jamPulang: '15:00:00', hariIni: '2026-11-16', jamSekarang: '10:00' }
    expect(cekLembur(dasar)).toEqual({ menit: 150, galat: {} })
    expect(cekLembur({ ...dasar, mulai: '14:00' }).galat.mulai).toMatch(/paling cepat jam pulang \(15:00\)/)
    expect(cekLembur({ ...dasar, selesai: '16:15' }).galat.selesai).toMatch(/kelipatan 30/)
    expect(cekLembur({ ...dasar, selesai: '15:00' }).galat.selesai).toMatch(/setelah jam mulai/)
    expect(cekLembur({ ...dasar, jamSekarang: '15:01' }).galat.tanggal).toMatch(/sudah lewat/)
    expect(cekLembur({ ...dasar, tanggal: '2026-11-15' }).galat.tanggal).toMatch(/sebelum hari ini/)
    const libur = { ...dasar, tanggal: '2026-11-22', hariIni: '2026-11-22', mulai: '08:00', selesai: '12:00', jamPulang: null }
    expect(cekLembur({ ...libur, jamSekarang: '07:59' }).galat).toEqual({})
    expect(cekLembur({ ...libur, jamSekarang: '08:01' }).galat.tanggal).toMatch(/sebelum jam mulai/)
  })
})

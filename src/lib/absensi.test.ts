import { describe, expect, it } from 'vitest'
import { durasi, jamWib, menitLebihCepat, menitTerlambat } from './absensi'

const wib = (s: string) => new Date(`${s}+07:00`)

describe('hitungan absensi', () => {
  it('jamWib', () => expect(jamWib(new Date('2026-11-11T23:52:00Z'))).toBe('06:52'))
  it('terlambat dihitung dari jam masuk jadwal (desain: 07:12 → 12 menit)', () => expect(menitTerlambat(wib('2026-11-12T07:12:40'), '07:00:00')).toBe(12))
  it('masuk lebih awal → 0', () => expect(menitTerlambat(wib('2026-11-12T06:52:18'), '07:00')).toBe(0))
  it('pulang 14:55 → lebih cepat 5 menit', () => expect(menitLebihCepat(wib('2026-11-12T14:55:30'), '15:00:00')).toBe(5))
  it('pulang lewat jam pulang → 0', () => expect(menitLebihCepat(wib('2026-11-12T15:04:00'), '15:00')).toBe(0))
  it('durasi desain 06:52 → 15:04 = 8 j 12 m', () => expect(durasi(wib('2026-11-12T06:52:00'), wib('2026-11-12T15:04:00'))).toBe('8 j 12 m'))
  it('durasi Sabtu 06:52 → 12:03 = 5 j 11 m', () => expect(durasi(wib('2026-11-14T06:52:00'), wib('2026-11-14T12:03:00'))).toBe('5 j 11 m'))
})

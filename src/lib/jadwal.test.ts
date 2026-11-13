import { describe, expect, it } from 'vitest'
import { keteranganJadwal, rapikanJam } from './jadwal'

describe('keteranganJadwal', () => {
  it('Sen–Jum sesuai desain', () => expect(keteranganJadwal(1, '07:00', '15:00')).toBe('7 jam kerja + 1 jam istirahat'))
  it('Sabtu sesuai desain', () => expect(keteranganJadwal(6, '07:00', '12:00')).toBe('5 jam · hari kerja terpendek'))
  it('setengah jam pakai koma', () => expect(keteranganJadwal(5, '07:00', '15:30')).toBe('7,5 jam kerja + 1 jam istirahat'))
  it('menerima format detik dari Postgres', () => expect(keteranganJadwal(2, '07:00:00', '15:00:00')).toBe('7 jam kerja + 1 jam istirahat'))
  it('tidak valid', () => {
    expect(keteranganJadwal(1, '15:00', '07:00')).toBeNull()
    expect(keteranganJadwal(1, '07:00', '08:00')).toBeNull()
    expect(keteranganJadwal(6, '07:00', '07:00')).toBeNull()
    expect(keteranganJadwal(1, '', '15:00')).toBeNull()
  })
})

describe('rapikanJam', () => {
  it.each([
    ['15:30', '15:30'], ['1530', '15:30'], ['15.30', '15:30'], ['7:00', '07:00'], ['700', '07:00'],
    ['7', '07:00'], ['07:5', '07:05'], [' 12:00 ', '12:00'],
    ['25:00', '25:00'], ['3 pm', '3 pm'], ['', ''],
  ])('"%s" → "%s"', (ketik, harap) => expect(rapikanJam(ketik)).toBe(harap))
  it('jam tidak valid ditolak keteranganJadwal', () => expect(keteranganJadwal(1, '25:00', '15:00')).toBeNull())
})

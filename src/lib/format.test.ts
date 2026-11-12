import { describe, expect, it } from 'vitest'
import { sapaan, tanggalPanjang } from './format'

// Jam ditulis dalam WIB (+07:00) agar tes tidak bergantung zona waktu mesin
const wib = (iso: string) => new Date(`${iso}+07:00`)

describe('tanggalPanjang', () => {
  it('mengikuti format desain', () => expect(tanggalPanjang(wib('2026-11-12T08:05'))).toBe('Kamis, 12 Nov 2026'))
  it('memakai tanggal WIB, bukan UTC', () => expect(tanggalPanjang(wib('2026-10-02T00:30'))).toBe('Jumat, 2 Okt 2026'))
})

describe('sapaan', () => {
  it.each([
    ['03:59', 'Selamat malam'],
    ['04:00', 'Selamat pagi'],
    ['10:59', 'Selamat pagi'],
    ['11:00', 'Selamat siang'],
    ['14:59', 'Selamat siang'],
    ['15:00', 'Selamat sore'],
    ['17:59', 'Selamat sore'],
    ['18:00', 'Selamat malam'],
    ['00:00', 'Selamat malam'],
  ])('%s → %s', (jam, harap) => expect(sapaan(wib(`2026-11-12T${jam}`))).toBe(harap))
})

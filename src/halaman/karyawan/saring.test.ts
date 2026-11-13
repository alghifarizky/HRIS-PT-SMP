import { describe, expect, it } from 'vitest'
import { potongHalaman, saringKaryawan } from './saring'

const b = (nama: string, nik: string | null, role: 'karyawan' | 'atasan' | 'hr' | 'direksi', aktif = true) => ({ nama, nik, role, aktif })
const data = [
  b('Hendra Wijaya', 'SMP-2012-001', 'direksi'),
  b('Rina Wulandari', 'SMP-2019-014', 'karyawan'),
  b('Teguh Prakoso', 'SMP-2019-012', 'karyawan', false),
  b('Budi Santoso', 'SMP-2015-003', 'atasan'),
  b('Tanpa NIK', null, 'direksi'),
]
const semua = { q: '', peran: '' as const, status: '' as const }

describe('saringKaryawan', () => {
  it('tanpa saringan → semua', () => expect(saringKaryawan(data, semua)).toHaveLength(5))
  it('cari nama tanpa beda huruf & spasi', () => expect(saringKaryawan(data, { ...semua, q: '  rina   ' }).map((x) => x.nama)).toEqual(['Rina Wulandari']))
  it('cari NIK', () => expect(saringKaryawan(data, { ...semua, q: '2019' })).toHaveLength(2))
  it('NIK kosong tidak error', () => expect(saringKaryawan(data, { ...semua, q: 'smp-' })).toHaveLength(4))
  it('filter peran & status', () => {
    expect(saringKaryawan(data, { ...semua, peran: 'karyawan', status: 'aktif' }).map((x) => x.nama)).toEqual(['Rina Wulandari'])
    expect(saringKaryawan(data, { ...semua, status: 'nonaktif' }).map((x) => x.nama)).toEqual(['Teguh Prakoso'])
  })
  it('tidak cocok → kosong', () => expect(saringKaryawan(data, { ...semua, q: 'Wahyu' })).toEqual([]))
})

describe('potongHalaman', () => {
  const angka = Array.from({ length: 27 }, (_, i) => i + 1)
  it('halaman 1 dari 27 → 1–12, 3 halaman', () => expect(potongHalaman(angka, 1)).toMatchObject({ dari: 1, sampai: 12, jumlahHalaman: 3 }))
  it('halaman terakhir 25–27', () => expect(potongHalaman(angka, 3)).toMatchObject({ dari: 25, sampai: 27, isi: [25, 26, 27] }))
  it('halaman di luar rentang dijepit', () => {
    expect(potongHalaman(angka, 9).halaman).toBe(3)
    expect(potongHalaman(angka, 0).halaman).toBe(1)
  })
  it('kosong', () => expect(potongHalaman([], 1)).toMatchObject({ dari: 0, sampai: 0, jumlahHalaman: 1, isi: [] }))
})

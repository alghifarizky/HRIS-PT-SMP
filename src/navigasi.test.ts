import { describe, expect, it } from 'vitest'
import { AKSES, halamanAwal } from './navigasi'

const boleh = (ke: string) => AKSES[ke]?.peran ?? []

describe('akses halaman per peran (UX)', () => {
  it('halaman awal', () => {
    expect(halamanAwal('karyawan')).toBe('/beranda')
    expect(halamanAwal('atasan')).toBe('/beranda')
    expect(halamanAwal('hr')).toBe('/panel')
    expect(halamanAwal('direksi')).toBe('/panel')
  })
  it('Direksi tidak punya halaman absen/slip', () => {
    for (const ke of ['/beranda', '/absensi', '/slip']) expect(boleh(ke)).not.toContain('direksi')
  })
  it('Atasan membuka slip lewat Profil, persetujuan hanya Atasan di mobile', () => {
    expect(boleh('/slip')).toContain('atasan')
    expect(boleh('/persetujuan')).toEqual(['atasan'])
  })
  it('panel hanya HR & Direksi; menu khusus HR tertutup untuk Direksi', () => {
    for (const [ke, { peran }] of Object.entries(AKSES))
      if (ke.startsWith('/panel')) expect(peran.every((r) => r === 'hr' || r === 'direksi')).toBe(true)
    for (const ke of ['/panel/absensi', '/panel/master-data', '/panel/log-audit']) expect(boleh(ke)).toEqual(['hr'])
    expect(boleh('/panel/profil')).toEqual(['direksi'])
  })
  it('HR punya "Akun saya" (absen, pengajuan, slip)', () => {
    for (const ke of ['/beranda', '/absensi', '/pengajuan', '/slip', '/profil']) expect(boleh(ke)).toContain('hr')
  })
})

describe('tambah karyawan', () => {
  it('hanya HR (Direksi lewat jalur darurat di detail)', () => expect(AKSES['/panel/karyawan/tambah']?.peran).toEqual(['hr']))
})

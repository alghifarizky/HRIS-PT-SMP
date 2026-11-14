import { describe, expect, it } from 'vitest'
import { durasi, hariIso, jamWib, menitLebihCepat, menitTerlambat, susunHariTim, susunRekap, susunRiwayat } from './absensi'

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

describe('susunRiwayat', () => {
  const a = (tanggal: string, o: Partial<{ terlambat: boolean; auto_clock_out: boolean }> = {}) => ({
    tanggal, jam_masuk: `${tanggal}T00:00:00Z`, jam_keluar: null, terlambat: false, auto_clock_out: false, ...o,
  })
  const dasar = { bulan: '2026-11', libur: new Set(['2026-11-10']), hariKerja: new Set([1, 2, 3, 4, 5, 6]), tanggalMasuk: '2020-01-01', hariIni: '2026-11-12' }
  const r = susunRiwayat({ ...dasar, absensi: [a('2026-11-12'), a('2026-11-11', { terlambat: true }), a('2026-11-09', { auto_clock_out: true })] })

  it('urut terbaru, hari kerja tanpa absensi ikut, Minggu & tanggal merah tidak', () =>
    expect(r.baris.map((b) => `${b.tanggal.slice(8)}${b.absensi ? '' : '-'}`)).toEqual(
      ['12', '11', '09', '07-', '06-', '05-', '04-', '03-', '02-'], // 10 libur, 08 & 01 Minggu
    ))
  it('ringkasan', () => expect([r.hadir, r.terlambat, r.autoClockOut]).toEqual([3, 1, 1]))
  it('hari ini tanpa absensi tidak ditampilkan', () =>
    expect(susunRiwayat({ ...dasar, absensi: [] }).baris[0].tanggal).toBe('2026-11-11'))
  it('"Tanpa absensi" hanya sejak tanggal masuk', () =>
    expect(susunRiwayat({ ...dasar, tanggalMasuk: '2026-11-11', absensi: [] }).baris.map((b) => b.tanggal)).toEqual(['2026-11-11']))
  it('absensi tetap tampil walau tanggal masuk diisi setelahnya (bug 14 Nov)', () =>
    expect(susunRiwayat({ ...dasar, tanggalMasuk: '2026-11-16', absensi: [a('2026-11-12'), a('2026-11-11')] }).baris.map((b) => b.tanggal)).toEqual(['2026-11-12', '2026-11-11']))
  it('bulan lalu penuh sampai akhir bulan', () =>
    expect(susunRiwayat({ ...dasar, bulan: '2026-10', absensi: [] }).baris[0].tanggal).toBe('2026-10-31'))
  it('hariIso', () => expect([hariIso('2026-11-09'), hariIso('2026-11-15')]).toEqual([1, 7]))
})

describe('susunHariTim', () => {
  const ang = (id: string, o: Partial<{ tanggal_masuk: string | null; aktif: boolean; tanggal_nonaktif: string | null }> = {}) => ({
    id, tanggal_masuk: '2020-01-01', aktif: true, tanggal_nonaktif: null, ...o,
  })
  const anggota = [
    ang('rina'), ang('dimas'), ang('fajar'),
    ang('baru', { tanggal_masuk: '2026-11-16' }), // belum mulai
    ang('resign', { aktif: false, tanggal_nonaktif: '2026-11-10' }), // aktif s.d. 10 Nov
    ang('jadwal', { tanggal_nonaktif: '2026-11-30' }), // terjadwal nonaktif, masih aktif
  ]
  const absensi = [{ pengguna_id: 'rina', terlambat: false }, { pengguna_id: 'dimas', terlambat: true }]

  it('hari ini: hadir, terlambat, belum clock in; yang belum mulai & sudah nonaktif tidak dihitung', () => {
    const r = susunHariTim({ anggota, absensi, tanggal: '2026-11-12', hariIni: '2026-11-12' })
    expect(r.baris.map((b) => `${b.anggota.id}:${b.status}`)).toEqual(['rina:hadir', 'dimas:hadir', 'fajar:belum_clock_in', 'jadwal:belum_clock_in'])
    expect([r.jumlah, r.hadir, r.terlambat, r.belum]).toEqual([4, 2, 1, 2])
  })
  it('tanggal lewat: tanpa absensi; anggota nonaktif masih dihitung pada hari terakhirnya', () => {
    const r = susunHariTim({ anggota, absensi: [], tanggal: '2026-11-10', hariIni: '2026-11-12' })
    expect(r.baris.map((b) => `${b.anggota.id}:${b.status}`)).toContain('resign:tanpa_absensi')
    expect(r.jumlah).toBe(5)
  })
})

describe('susunRekap', () => {
  const k = (id: string) => ({ id, tanggal_masuk: '2020-01-01', aktif: true, tanggal_nonaktif: null })
  const r = susunRekap({
    karyawan: [k('rina'), k('budi')],
    absensi: [{ pengguna_id: 'rina', tanggal: '2026-11-12', terlambat: false }, { pengguna_id: 'budi', tanggal: '2026-11-15', terlambat: false }],
    dari: '2026-11-11',
    sampai: '2026-11-15',
    hariIni: '2026-11-15',
    hariKerja: (t) => !['2026-11-15'].includes(t), // Minggu
  })
  it('hari kerja semua karyawan, hari libur hanya yang punya absensi, terbaru dulu', () =>
    expect(r.map((b) => `${b.tanggal.slice(8)}:${b.karyawan.id}:${b.status}`)).toEqual([
      '15:budi:hadir',
      '14:rina:tanpa_absensi', '14:budi:tanpa_absensi',
      '13:rina:tanpa_absensi', '13:budi:tanpa_absensi',
      '12:rina:hadir', '12:budi:tanpa_absensi',
      '11:rina:tanpa_absensi', '11:budi:tanpa_absensi',
    ]))
})

import { describe, expect, it } from 'vitest'
import { uraikanLog } from './audit'

const nama = (id: string) => ({ a: 'Nur Aini', b: 'Budi Santoso' })[id] ?? '(tidak dikenal)'

describe('uraikanLog', () => {
  it('ubah gaji (contoh desain)', () =>
    expect(uraikanLog({ aksi: 'update', nilai_lama: { gaji_pokok: 4500000 }, nilai_baru: { gaji_pokok: 4800000 } }, nama)).toEqual({
      judul: 'Mengubah gaji pokok',
      perubahan: [{ label: 'Gaji pokok', lama: 'Rp 4.500.000', baru: 'Rp 4.800.000' }],
    }))
  it('ubah atasan memakai nama', () =>
    expect(uraikanLog({ aksi: 'update', nilai_lama: { atasan_id: 'a' }, nilai_baru: { atasan_id: 'b' } }, nama).perubahan).toEqual([
      { label: 'Atasan langsung', lama: 'Nur Aini', baru: 'Budi Santoso' },
    ]))
  it('beberapa kolom, KTP tersamar, kolom turunan diabaikan', () => {
    const r = uraikanLog({
      aksi: 'update',
      nilai_lama: { role: 'karyawan', no_ktp: null, no_ktp_tersamar: null },
      nilai_baru: { role: 'atasan', no_ktp: '3201********0001', no_ktp_tersamar: '3201********0001' },
    }, nama)
    expect(r.judul).toBe('Mengubah data')
    expect(r.perubahan).toEqual([
      { label: 'Peran', lama: 'Karyawan', baru: 'Atasan' },
      { label: 'No. KTP', lama: '—', baru: '3201********0001' },
    ])
  })
  it('lihat KTP & akun dibuat', () => {
    expect(uraikanLog({ aksi: 'lihat_ktp', nilai_lama: null, nilai_baru: null }, nama).judul).toBe('Melihat No. KTP')
    expect(uraikanLog({ aksi: 'insert', nilai_lama: null, nilai_baru: { nama: 'X' } }, nama).judul).toBe('Akun dibuat')
  })
  it('tanggal & status', () =>
    expect(uraikanLog({ aksi: 'update', nilai_lama: { tanggal_masuk: null, aktif: true }, nilai_baru: { tanggal_masuk: '2019-03-04', aktif: false } }, nama).perubahan).toEqual([
      { label: 'Status', lama: 'Aktif', baru: 'Nonaktif' },
      { label: 'Tanggal masuk', lama: '—', baru: '4 Mar 2019' },
    ]))
})

describe('uraikanLog penonaktifan', () => {
  it('jadwal nonaktif terbaca', () =>
    expect(uraikanLog({ aksi: 'update', nilai_lama: { tanggal_nonaktif: null, alasan_nonaktif: null }, nilai_baru: { tanggal_nonaktif: '2026-11-30', alasan_nonaktif: 'resign' } }, nama).perubahan).toEqual([
      { label: 'Aktif sampai', lama: '—', baru: '30 Nov 2026' },
      { label: 'Alasan nonaktif', lama: '—', baru: 'Resign' },
    ]))
})

describe('uraikanLog master data', () => {
  it('ubah jadwal', () =>
    expect(uraikanLog({ aksi: 'update', nilai_lama: { jam_pulang: '15:00:00' }, nilai_baru: { jam_pulang: '15:30:00' } }, nama, 'jadwal_kerja')).toEqual({
      judul: 'Mengubah jam pulang',
      perubahan: [{ label: 'Jam pulang', lama: '15:00', baru: '15:30' }],
    }))
  it('tambah & hapus hari libur menampilkan isinya', () => {
    const isi = { tanggal: '2026-12-25', jenis: 'libur_nasional', keterangan: 'Hari Raya Natal' }
    expect(uraikanLog({ aksi: 'insert', nilai_lama: null, nilai_baru: isi }, nama, 'hari_libur')).toEqual({
      judul: 'Menambah data',
      perubahan: [
        { label: 'Tanggal', lama: '—', baru: '25 Des 2026' },
        { label: 'Jenis', lama: '—', baru: 'Libur nasional' },
        { label: 'Keterangan', lama: '—', baru: 'Hari Raya Natal' },
      ],
    })
    expect(uraikanLog({ aksi: 'delete', nilai_lama: isi, nilai_baru: null }, nama, 'hari_libur').perubahan[2]).toEqual({ label: 'Keterangan', lama: 'Hari Raya Natal', baru: '—' })
  })
  it('pengaturan', () =>
    expect(uraikanLog({ aksi: 'update', nilai_lama: { jatah_cuti_tahunan: 12 }, nilai_baru: { jatah_cuti_tahunan: 14 } }, nama, 'pengaturan').perubahan).toEqual([
      { label: 'Jatah cuti tahunan', lama: '12 hari', baru: '14 hari' },
    ]))
})

import { describe, expect, it } from 'vitest'
import { uraikanLog } from './riwayat'

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

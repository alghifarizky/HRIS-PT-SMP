// Menerjemahkan baris log_audit tabel `pengguna` menjadi kalimat untuk tab Riwayat perubahan (B3A hal 18).
import { LABEL_PERAN } from '../../navigasi'
import { dariTanggalDb, rupiah, tanggalPendek } from '../../lib/format'
import type { Peran } from '../../auth/sesi'
import { LABEL_ALASAN_NONAKTIF, type AlasanNonaktif } from './label'

export type BarisLog = { aksi: 'insert' | 'update' | 'delete' | 'lihat_ktp'; nilai_lama: Record<string, unknown> | null; nilai_baru: Record<string, unknown> | null }
export type Perubahan = { label: string; lama: string; baru: string }

const LABEL: Record<string, string> = {
  nama: 'Nama lengkap', email: 'Email', role: 'Peran', aktif: 'Status', atasan_id: 'Atasan langsung', nik: 'NIK karyawan',
  jabatan: 'Jabatan', tanggal_lahir: 'Tanggal lahir', alamat: 'Alamat', tanggal_masuk: 'Tanggal masuk', no_ktp: 'No. KTP',
  status_menikah: 'Status menikah', jumlah_tanggungan: 'Jumlah tanggungan', gaji_pokok: 'Gaji pokok', saldo_cuti: 'Saldo cuti',
  tanggal_nonaktif: 'Aktif sampai', alasan_nonaktif: 'Alasan nonaktif', catatan_nonaktif: 'Catatan nonaktif',
}
const ABAIKAN = new Set(['id', 'no_ktp_tersamar']) // no_ktp_tersamar menggandakan no_ktp (sudah tersamar di log)

function nilai(kunci: string, v: unknown, namaPengguna: (id: string) => string): string {
  if (v === null || v === undefined || v === '') return '—'
  switch (kunci) {
    case 'role': return LABEL_PERAN[v as Peran] ?? String(v)
    case 'aktif': return v ? 'Aktif' : 'Nonaktif'
    case 'atasan_id': return namaPengguna(String(v))
    case 'gaji_pokok': return rupiah(Number(v))
    case 'saldo_cuti': return `${v} hari`
    case 'tanggal_lahir': case 'tanggal_masuk': case 'tanggal_nonaktif': return tanggalPendek(dariTanggalDb(String(v)))
    case 'alasan_nonaktif': return LABEL_ALASAN_NONAKTIF[v as AlasanNonaktif] ?? String(v)
    case 'status_menikah': return v === 'menikah' ? 'Menikah' : 'Belum menikah'
    default: return String(v)
  }
}

/** Judul satu entri + daftar perubahan per kolom (urutan mengikuti LABEL). */
export function uraikanLog(log: BarisLog, namaPengguna: (id: string) => string): { judul: string; perubahan: Perubahan[] } {
  if (log.aksi === 'lihat_ktp') return { judul: 'Melihat No. KTP', perubahan: [] }
  if (log.aksi === 'insert') return { judul: 'Akun dibuat', perubahan: [] }
  if (log.aksi === 'delete') return { judul: 'Data dihapus', perubahan: [] }
  const lama = log.nilai_lama ?? {}
  const baru = log.nilai_baru ?? {}
  const perubahan = Object.keys(LABEL)
    .filter((k) => k in baru && !ABAIKAN.has(k))
    .map((k) => ({ label: LABEL[k], lama: nilai(k, lama[k], namaPengguna), baru: nilai(k, baru[k], namaPengguna) }))
  return { judul: perubahan.length === 1 ? `Mengubah ${perubahan[0].label.toLowerCase()}` : 'Mengubah data', perubahan }
}

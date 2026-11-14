// Menerjemahkan baris log_audit menjadi kalimat — tab Riwayat perubahan (B3A hal 18) & layar Log audit (B3C hal 16–18).
import { LABEL_PERAN } from '../navigasi'
import { dariTanggalDb, rupiah, tanggalPendek } from './format'
import { jamWib } from './absensi'
import type { Peran } from '../auth/sesi'
import { LABEL_ALASAN_NONAKTIF, type AlasanNonaktif } from '../halaman/karyawan/label'

export type BarisLog = { aksi: 'insert' | 'update' | 'delete' | 'lihat_ktp'; nilai_lama: Record<string, unknown> | null; nilai_baru: Record<string, unknown> | null }
export type Perubahan = { label: string; lama: string; baru: string }

const LABEL: Record<string, string> = {
  nama: 'Nama lengkap', email: 'Email', role: 'Peran', aktif: 'Status', atasan_id: 'Atasan langsung', nik: 'NIK karyawan',
  jabatan: 'Jabatan', tanggal_lahir: 'Tanggal lahir', alamat: 'Alamat', tanggal_masuk: 'Tanggal masuk', no_ktp: 'No. KTP',
  status_menikah: 'Status menikah', jumlah_tanggungan: 'Jumlah tanggungan', gaji_pokok: 'Gaji pokok', saldo_cuti: 'Saldo cuti',
  tanggal_nonaktif: 'Aktif sampai', alasan_nonaktif: 'Alasan nonaktif', catatan_nonaktif: 'Catatan nonaktif',
  // master data
  tanggal: 'Tanggal', jenis: 'Jenis', keterangan: 'Keterangan', jam_masuk: 'Jam masuk', jam_keluar: 'Jam keluar', jam_pulang: 'Jam pulang',
  jatah_cuti_tahunan: 'Jatah cuti tahunan', tanggal_cut_off: 'Tanggal cut-off',
  // absensi
  pengguna_id: 'Karyawan', terlambat: 'Terlambat', auto_clock_out: 'Auto clock out', alasan_koreksi: 'Alasan koreksi',
}
// no_ktp_tersamar menggandakan no_ktp; kolom ringkasan koreksi absensi & path foto hanya turunan/teknis
const ABAIKAN = new Set(['id', 'no_ktp_tersamar', 'jam_masuk_semula', 'jam_keluar_semula', 'dikoreksi_pada', 'dikoreksi_oleh', 'dikoreksi_oleh_nama', 'foto_masuk_path', 'foto_keluar_path'])

function nilai(kunci: string, v: unknown, namaPengguna: (id: string) => string): string {
  if (v === null || v === undefined || v === '') return '—'
  switch (kunci) {
    case 'role': return LABEL_PERAN[v as Peran] ?? String(v)
    case 'aktif': return v ? 'Aktif' : 'Nonaktif'
    case 'atasan_id': return namaPengguna(String(v))
    case 'gaji_pokok': return rupiah(Number(v))
    case 'saldo_cuti': return `${v} hari`
    case 'tanggal_lahir': case 'tanggal_masuk': case 'tanggal_nonaktif': case 'tanggal': return tanggalPendek(dariTanggalDb(String(v)))
    // jadwal: "07:00:00"; absensi: timestamp lengkap → jam WIB
    case 'jam_masuk': case 'jam_keluar': case 'jam_pulang': return String(v).includes('T') || String(v).includes(' ') ? `${jamWib(new Date(String(v)))} WIB` : String(v).slice(0, 5)
    case 'terlambat': case 'auto_clock_out': return v ? 'Ya' : 'Tidak'
    case 'pengguna_id': return namaPengguna(String(v))
    case 'jatah_cuti_tahunan': return `${v} hari`
    case 'tanggal_cut_off': return `tanggal ${v}`
    case 'jenis': return v === 'cuti_bersama' ? 'Cuti bersama' : v === 'libur_nasional' ? 'Libur nasional' : String(v)
    case 'alasan_nonaktif': return LABEL_ALASAN_NONAKTIF[v as AlasanNonaktif] ?? String(v)
    case 'status_menikah': return v === 'menikah' ? 'Menikah' : 'Belum menikah'
    default: return String(v)
  }
}

/** Judul satu entri + daftar perubahan per kolom (urutan mengikuti LABEL). `tabel` default 'pengguna'. */
export function uraikanLog(log: BarisLog, namaPengguna: (id: string) => string, tabel = 'pengguna'): { judul: string; perubahan: Perubahan[] } {
  if (log.aksi === 'lihat_ktp') return { judul: 'Melihat No. KTP', perubahan: [] }
  if (log.aksi === 'insert' && tabel === 'pengguna') return { judul: 'Akun dibuat', perubahan: [] }
  const lama = log.nilai_lama ?? {}
  const baru = log.nilai_baru ?? {}
  const sumber = log.aksi === 'delete' ? lama : baru
  const perubahan = Object.keys(LABEL)
    .filter((k) => k in sumber && !ABAIKAN.has(k))
    .map((k) => ({
      label: LABEL[k],
      lama: log.aksi === 'insert' ? '—' : nilai(k, lama[k], namaPengguna),
      baru: log.aksi === 'delete' ? '—' : nilai(k, baru[k], namaPengguna),
    }))
  if (log.aksi === 'insert') return { judul: 'Menambah data', perubahan }
  if (log.aksi === 'delete') return { judul: 'Menghapus data', perubahan }
  return { judul: perubahan.length === 1 ? `Mengubah ${perubahan[0].label.toLowerCase()}` : 'Mengubah data', perubahan }
}

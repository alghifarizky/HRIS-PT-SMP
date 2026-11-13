import type { Peran } from '../../auth/sesi'

export type Saringan = { q: string; peran: Peran | ''; status: 'aktif' | 'nonaktif' | '' }
type Baris = { nama: string; nik: string | null; role: Peran; aktif: boolean }

export const PER_HALAMAN = 12

/** Cari nama/NIK (tanpa beda huruf besar-kecil & spasi ganda) + filter peran & status. */
export function saringKaryawan<T extends Baris>(baris: T[], { q, peran, status }: Saringan): T[] {
  const kunci = q.trim().toLowerCase().replace(/\s+/g, ' ')
  return baris.filter(
    (b) =>
      (!kunci || b.nama.toLowerCase().includes(kunci) || (b.nik ?? '').toLowerCase().includes(kunci)) &&
      (!peran || b.role === peran) &&
      (!status || b.aktif === (status === 'aktif')),
  )
}

/** Halaman 1-based, dijepit ke rentang yang ada. */
export function potongHalaman<T>(baris: T[], halaman: number) {
  const jumlahHalaman = Math.max(1, Math.ceil(baris.length / PER_HALAMAN))
  const h = Math.min(Math.max(1, halaman), jumlahHalaman)
  const awal = (h - 1) * PER_HALAMAN
  return { isi: baris.slice(awal, awal + PER_HALAMAN), halaman: h, jumlahHalaman, dari: baris.length ? awal + 1 : 0, sampai: Math.min(awal + PER_HALAMAN, baris.length) }
}

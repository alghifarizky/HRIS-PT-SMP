// Menu per peran (AUTH-04) — urutan persis desain: B1 hal 10, B2 hal 1, B3A hal 3, B4 hal 1 & 46.
import {
  ChartNoAxesColumn, Clock, CreditCard, Database, FileText, History, House,
  LayoutGrid, Shield, SquareCheck, User, Users, type LucideIcon,
} from 'lucide-react'
import type { Peran } from './auth/sesi'

export type ItemNav = { ke: string; label: string; ikon: LucideIcon }

const m = {
  beranda: { ke: '/beranda', label: 'Beranda', ikon: House },
  absensi: { ke: '/absensi', label: 'Absensi', ikon: Clock },
  absensiTim: { ke: '/absensi/tim', label: 'Absensi', ikon: Clock }, // Atasan: tab Absensi = absensi tim (B2 hal 23)
  pengajuan: { ke: '/pengajuan', label: 'Pengajuan', ikon: FileText },
  slip: { ke: '/slip', label: 'Slip Gaji', ikon: CreditCard },
  persetujuan: { ke: '/persetujuan', label: 'Persetujuan', ikon: SquareCheck },
  profil: { ke: '/profil', label: 'Profil', ikon: User },
}
const p = {
  dashboard: { ke: '/panel', label: 'Dashboard', ikon: LayoutGrid },
  karyawan: { ke: '/panel/karyawan', label: 'Karyawan', ikon: Users },
  absensi: { ke: '/panel/absensi', label: 'Absensi', ikon: Clock },
  persetujuan: { ke: '/panel/persetujuan', label: 'Persetujuan', ikon: SquareCheck },
  payroll: { ke: '/panel/payroll', label: 'Payroll', ikon: CreditCard },
  laporan: { ke: '/panel/laporan', label: 'Laporan', ikon: ChartNoAxesColumn },
  masterData: { ke: '/panel/master-data', label: 'Master data', ikon: Database },
  logAudit: { ke: '/panel/log-audit', label: 'Log audit', ikon: History },
  keamanan: { ke: '/panel/keamanan', label: 'Keamanan', ikon: Shield },
  profil: { ke: '/panel/profil', label: 'Profil', ikon: User },
}

/** Bottom nav shell mobile. HR memakainya lewat "Akun saya" (absen, pengajuan & slip sendiri). */
export const NAV_MOBILE: Partial<Record<Peran, ItemNav[]>> = {
  karyawan: [m.beranda, m.absensi, m.pengajuan, m.slip, m.profil],
  atasan: [m.beranda, m.absensiTim, m.pengajuan, m.persetujuan, m.profil], // slip lewat Profil
  hr: [m.beranda, m.absensi, m.pengajuan, m.slip, m.profil],
}

/** Sidebar panel (≥ 1024 px). */
export const NAV_PANEL: Partial<Record<Peran, ItemNav[]>> = {
  hr: [p.dashboard, p.karyawan, p.absensi, p.persetujuan, p.payroll, p.laporan, p.masterData, p.logAudit],
  direksi: [p.dashboard, p.persetujuan, p.payroll, p.karyawan, p.laporan],
}
export const NAV_PANEL_BAWAH = p.keamanan

/** Bottom nav Direksi di layar < 1024 px — URL sama dengan panel. */
export const NAV_PANEL_MOBILE_DIREKSI: ItemNav[] = [{ ...p.dashboard, label: 'Beranda', ikon: House }, p.persetujuan, p.laporan, p.profil]

/** Halaman awal setelah login. */
export const halamanAwal = (peran: Peran) => (peran === 'hr' || peran === 'direksi' ? '/panel' : '/beranda')

export const LABEL_PERAN: Record<Peran, string> = { karyawan: 'Karyawan', atasan: 'Atasan', hr: 'HR', direksi: 'Direksi' }

/** Halaman mobile dengan tombol ‹ di top bar (tanpa lonceng) — B1 hal 28–39. Tujuan dari parameter rute. */
export const KEMBALI_MOBILE: Record<string, (p: Record<string, string | undefined>) => string> = {
  '/pengajuan/lembur/ajukan': () => '/pengajuan',
  '/pengajuan/cuti/ajukan': () => '/pengajuan?tab=cuti',
  '/pengajuan/:jenis/:id': (p) => (p.jenis === 'cuti' ? '/pengajuan?tab=cuti' : '/pengajuan'),
  '/notifikasi': () => '/beranda',
  '/persetujuan/:jenis/:id': (p) => (p.jenis === 'cuti' ? '/persetujuan?tab=cuti' : '/persetujuan'),
}

/** Siapa boleh membuka tiap halaman (UX saja — keamanan di RLS). Diturunkan dari menu + pengecualian. */
export const AKSES: Record<string, { label: string; peran: Peran[] }> = (() => {
  const akses: Record<string, { label: string; peran: Peran[] }> = {}
  const tambah = (item: Pick<ItemNav, 'ke' | 'label'>, peran: Peran) => {
    akses[item.ke] ??= { label: item.label, peran: [] }
    if (!akses[item.ke].peran.includes(peran)) akses[item.ke].peran.push(peran)
  }
  for (const nav of [NAV_MOBILE, NAV_PANEL])
    for (const [peran, items] of Object.entries(nav)) items.forEach((i) => tambah(i, peran as Peran))
  NAV_PANEL_MOBILE_DIREKSI.forEach((i) => tambah(i, 'direksi'))
  tambah(m.slip, 'atasan') // Atasan membuka slip dari Profil
  tambah(m.absensi, 'atasan') // "Riwayat saya" dari halaman Absensi tim
  tambah({ ke: '/absensi/tim/:id', label: 'Riwayat anggota' }, 'atasan')
  tambah({ ke: '/absensi/tim/:id/profil', label: 'Profil anggota tim' }, 'atasan')
  tambah({ ke: '/absensi/tim/:id/:tanggal', label: 'Detail absensi' }, 'atasan')
  tambah({ ke: '/persetujuan/:jenis/:id', label: 'Detail persetujuan' }, 'atasan')
  tambah({ ke: '/panel/karyawan/tambah', label: 'Karyawan' }, 'hr') // Direksi tanpa tombol tambah (PRD EMP-08)
  tambah({ ke: '/panel/karyawan/:id/edit', label: 'Karyawan' }, 'hr')
  for (const r of ['hr', 'direksi'] as const) tambah({ ke: '/panel/karyawan/:id', label: 'Karyawan' }, r)
  for (const r of ['hr', 'direksi'] as const) {
    tambah(p.keamanan, r)
    tambah({ ke: '/panel/notifikasi', label: 'Notifikasi' }, r)
  }
  for (const r of ['karyawan', 'atasan', 'hr'] as const) {
    tambah({ ke: '/notifikasi', label: 'Notifikasi' }, r)
    tambah({ ke: '/ganti-password', label: 'Ganti password' }, r)
    tambah({ ke: '/clock', label: 'Clock' }, r) // layar penuh kamera, di luar shell mobile
    tambah({ ke: '/absensi/:tanggal', label: 'Detail absensi' }, r)
    tambah({ ke: '/pengajuan/lembur/ajukan', label: 'Ajukan lembur' }, r)
    tambah({ ke: '/pengajuan/cuti/ajukan', label: 'Ajukan cuti / sakit / izin' }, r)
    tambah({ ke: '/pengajuan/:jenis/:id', label: 'Detail pengajuan' }, r)
  }
  return akses
})()

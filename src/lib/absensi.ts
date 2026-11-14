// Hitungan tampilan absensi (status terlambat dari DB tetap sumber kebenaran — kolom absensi.terlambat).
// Keputusan Al (13 Nov 2026): toleransi 5 menit; lama terlambat dihitung dari jam masuk jadwal;
// pulang lebih cepat ditampilkan "lebih cepat N menit".
const fmtJamMenitWib = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })

/** Date → "06:52" (WIB). */
export const jamWib = (d: Date) => fmtJamMenitWib.format(d)

const menitDari = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

/** Menit terlambat dari jam masuk jadwal (0 bila tidak terlambat). jadwalMasuk "07:00" / "07:00:00". */
export const menitTerlambat = (jamMasuk: Date, jadwalMasuk: string) => Math.max(0, menitDari(jamWib(jamMasuk)) - menitDari(jadwalMasuk))

/** Menit pulang lebih cepat dari jam pulang jadwal (0 bila tepat / lebih lambat). */
export const menitLebihCepat = (jamKeluar: Date, jadwalPulang: string) => Math.max(0, menitDari(jadwalPulang) - menitDari(jamWib(jamKeluar)))

/** Durasi "8 j 12 m". */
export function durasi(dari: Date, sampai: Date) {
  const menit = Math.max(0, Math.floor((sampai.getTime() - dari.getTime()) / 60_000))
  return `${Math.floor(menit / 60)} j ${String(menit % 60).padStart(2, '0')} m`
}

type AbsensiRingkas = { tanggal: string; jam_masuk: string; jam_keluar: string | null; terlambat: boolean; auto_clock_out: boolean }
export type BarisRiwayat<A> = { tanggal: string; absensi: A | null }

const tambahHari = (tgl: string, n: number) => {
  const d = new Date(`${tgl}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
/** ISO day of week 1 (Senin) … 7 (Minggu) untuk "YYYY-MM-DD". */
export const hariIso = (tgl: string) => ((new Date(`${tgl}T00:00:00Z`).getUTCDay() + 6) % 7) + 1

/**
 * Daftar riwayat satu bulan (terbaru di atas): SEMUA hari yang punya absensi + hari kerja yang sudah lewat
 * tanpa absensi ("Tanpa absensi", keputusan Al 14 Nov 2026) — yang terakhir hanya sejak tanggal masuk
 * (bug 14 Nov 2026: batas tanggal masuk dulu ikut menyembunyikan hari yang ada absensinya). Hari kerja = Sen–Sab yang
 * ada di jadwal & bukan hari libur. Hari ini tanpa absensi tidak ditampilkan (masih bisa clock in).
 * Hari hadir = hari kerja yang punya absensi (PRD §6; lembur hari libur tidak dihitung).
 */
export function susunRiwayat<A extends AbsensiRingkas>(p: {
  bulan: string // "YYYY-MM"
  absensi: A[]
  libur: Set<string>
  hariKerja: Set<number> // isodow yang punya jadwal (1–6)
  tanggalMasuk: string | null
  hariIni: string
}) {
  const perTanggal = new Map(p.absensi.map((a) => [a.tanggal, a]))
  const akhirBulan = tambahHari(`${tambahHari(`${p.bulan}-28`, 4).slice(0, 7)}-01`, -1)
  const mulai = `${p.bulan}-01`
  const akhir = p.hariIni < akhirBulan ? p.hariIni : akhirBulan
  const sudahBekerja = (t: string) => !p.tanggalMasuk || t >= p.tanggalMasuk
  const adalahHariKerja = (t: string) => p.hariKerja.has(hariIso(t)) && !p.libur.has(t)

  const baris: BarisRiwayat<A>[] = []
  for (let t = akhir; t >= mulai; t = tambahHari(t, -1)) {
    const a = perTanggal.get(t) ?? null
    if (a || (adalahHariKerja(t) && t < p.hariIni && sudahBekerja(t))) baris.push({ tanggal: t, absensi: a })
  }
  return {
    baris,
    hadir: p.absensi.filter((a) => adalahHariKerja(a.tanggal)).length,
    terlambat: p.absensi.filter((a) => a.terlambat).length,
    autoClockOut: p.absensi.filter((a) => a.auto_clock_out).length,
  }
}

type Anggota = { id: string; tanggal_masuk: string | null; aktif: boolean; tanggal_nonaktif: string | null }
export type StatusTim = 'hadir' | 'belum_clock_in' | 'tanpa_absensi'

/**
 * Absensi tim satu tanggal (ATT-08, B2 hal 23–24). Anggota dihitung bila sudah mulai bekerja dan masih aktif
 * pada tanggal itu (tanggal_nonaktif = hari terakhir aktif). Hari ini tanpa clock in = "belum clock in";
 * hari kerja yang sudah lewat = "tanpa absensi". Cuti/sakit/izin menyusul (Fase 4).
 */
export function susunHariTim<A extends Anggota, B extends { pengguna_id: string; terlambat: boolean }>(p: {
  anggota: A[]
  absensi: B[]
  tanggal: string
  hariIni: string
}) {
  const perOrang = new Map(p.absensi.map((a) => [a.pengguna_id, a]))
  const terhitung = p.anggota.filter(
    (a) =>
      (!a.tanggal_masuk || a.tanggal_masuk <= p.tanggal) &&
      (a.aktif ? !a.tanggal_nonaktif || a.tanggal_nonaktif >= p.tanggal : !!a.tanggal_nonaktif && a.tanggal_nonaktif >= p.tanggal),
  )
  const baris = terhitung.map((a) => {
    const absensi = perOrang.get(a.id) ?? null
    const status: StatusTim = absensi ? 'hadir' : p.tanggal === p.hariIni ? 'belum_clock_in' : 'tanpa_absensi'
    return { anggota: a, absensi, status }
  })
  return {
    baris,
    jumlah: terhitung.length,
    hadir: baris.filter((b) => b.status === 'hadir').length,
    terlambat: baris.filter((b) => b.absensi?.terlambat).length,
    belum: baris.filter((b) => b.status !== 'hadir').length,
  }
}

/**
 * Rekap absensi HR (ATT-09, B3A hal 21): baris per tanggal × karyawan (terbaru dulu) untuk rentang [dari, sampai].
 * Hari kerja: semua karyawan yang terhitung (lihat susunHariTim). Hari libur: hanya yang punya absensi.
 */
export function susunRekap<A extends Anggota, B extends { pengguna_id: string; tanggal: string; terlambat: boolean }>(p: {
  karyawan: A[]
  absensi: B[]
  dari: string
  sampai: string
  hariIni: string
  hariKerja: (tanggal: string) => boolean
}) {
  const baris: { tanggal: string; karyawan: A; absensi: B | null; status: StatusTim }[] = []
  for (let t = p.sampai; t >= p.dari; t = tambahHari(t, -1)) {
    const hari = susunHariTim({ anggota: p.karyawan, absensi: p.absensi.filter((a) => a.tanggal === t), tanggal: t, hariIni: p.hariIni })
    for (const b of hari.baris) if (b.absensi || p.hariKerja(t)) baris.push({ tanggal: t, karyawan: b.anggota, absensi: b.absensi, status: b.status })
  }
  return baris
}

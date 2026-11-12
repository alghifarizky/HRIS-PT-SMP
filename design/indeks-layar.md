# Indeks layar — HRIS PT. SMP

Sumber: 6 PDF di `design/` (tidak di-commit; lihat `.gitignore`). Kolom **Hal** = nomor halaman PDF.
Disusun dari ekstrak teks per halaman (PDFKit) + pengecekan gambar untuk halaman design system.
Tanda **(?)** = varian ditebak dari teks; cek gambarnya saat mengerjakan layar tersebut.

**Membaca halaman** (Read tool tidak bisa merender PDF di mesin ini — poppler tidak terpasang). Pakai skrip
Swift PDFKit bawaan macOS di `design/alat/`:
- Teks: `swift design/alat/pdfteks.swift "design/<file>.pdf" 300`
- Gambar: `swift design/alat/pdfpng.swift "design/<file>.pdf" <folder-keluaran> <prefix> 6,7,8 [lebar=1100]`

Nilai pasti (warna, font, radius) tetap dari `docs/handoff.md` §4; halaman design system (B1 hal 1–2)
melengkapinya (warna status, skala tipografi, spacing).

## Batch 1 Karyawan — `HRIS PT. SMP — Batch 1 Karyawan.pdf` (mobile 390 px)

| Layar | Varian | Hal |
|---|---|---|
| Design system — Fondasi (warna, tipografi, spacing, format data, aksesibilitas) | — | 1 |
| Design system — Komponen dasar (tombol, input, badge, bottom nav, toast, sheet, empty/error) | — | 2 |
| Potongan export (badge, header, bottom nav) — abaikan | — | 3–5 |
| Login | normal | 6 |
| Login | error kredensial | 7 |
| Lupa password | form | 8 |
| Lupa password | link terkirim | 9 |
| Beranda | belum clock in | 10 |
| Beranda | sudah clock in (tombol Clock Out) | 11 |
| Beranda | absensi lengkap | 12 |
| Beranda | memuat | 13 |
| Beranda | Sabtu | 14 |
| Beranda | prompt install PWA (?) | 50 |
| Clock in — kamera | normal | 15 |
| Clock in — pratinjau foto | normal | 16 |
| Clock in — sukses | tepat waktu | 17 |
| Clock in — sukses | terlambat | 18 |
| Clock in | izin kamera ditolak | 19 |
| Clock in — pratinjau | gagal kirim | 20 |
| Clock in | offline | 21 |
| Riwayat absensi | daftar | 22 |
| Riwayat absensi | kosong | 24 |
| Riwayat absensi | memuat | 25 |
| Riwayat absensi | galat | 26 |
| Detail absensi | dikoreksi HR | 23 |
| Detail absensi | auto clock out | 27 |
| Ajukan lembur | hari kerja | 36 |
| Ajukan lembur | hari libur | 28 |
| Ajukan cuti/sakit/izin | normal | 29 |
| Ajukan cuti/sakit/izin | saldo tidak cukup | 30 |
| Daftar pengajuan — tab Lembur | daftar | 31 |
| Daftar pengajuan | kosong | 32 |
| Daftar pengajuan | memuat | 33 |
| Daftar pengajuan | galat | 34 |
| Daftar pengajuan — tab Cuti/Sakit/Izin | daftar | 35 |
| Detail pengajuan cuti | menunggu | 37 |
| Detail pengajuan cuti | konfirmasi batalkan (?) | 39 |
| Detail pengajuan lembur | disetujui | 38 |
| Slip gaji | daftar | 40 |
| Slip gaji | detail | 41 |
| Slip gaji | kosong | 42 |
| Slip gaji | memuat | 43 |
| Slip gaji | galat | 44 |
| Notifikasi | daftar | 45 |
| Notifikasi | kosong | 46 |
| Notifikasi | memuat | 47 |
| Notifikasi | galat | 48 |
| Profil (KTP tersamar) | — | 49 |

## Batch 2 Atasan — `HRIS PT. SMP — Batch 2.pdf` (mobile)

| Layar | Varian | Hal |
|---|---|---|
| Beranda Atasan | normal | 1 |
| Notifikasi Atasan | daftar | 2 |
| Profil Atasan | — | 3 |
| Persetujuan — Menunggu, tab Lembur | daftar | 4 |
| Persetujuan — Menunggu, tab Cuti/Sakit/Izin | daftar | 5 |
| Persetujuan — Riwayat | daftar | 6 |
| Persetujuan | setelah keputusan (?) | 7 |
| Persetujuan | kosong | 8 |
| Persetujuan | memuat | 9 |
| Persetujuan | galat | 10 |
| Detail persetujuan lembur | hari kerja (konteks clock in) | 11 |
| Detail persetujuan lembur | hari libur | 12 |
| Detail persetujuan lembur | bottom sheet setujui (?) | 13 |
| Detail persetujuan lembur | bottom sheet tolak | 14 |
| Detail persetujuan lembur | gagal simpan | 15 |
| Detail persetujuan lembur | dibatalkan pengaju | 16 |
| Detail persetujuan lembur | varian tingkat 2 (HR) | 17 |
| Detail persetujuan lembur | varian Direksi (pengaju Atasan) | 18 |
| Detail persetujuan cuti | normal | 19 |
| Detail persetujuan cuti | bentrok tim / sheet (?) | 22 |
| Detail persetujuan sakit | dengan lampiran | 20 |
| Viewer lampiran | — | 21 |
| Absensi tim | hari ini | 23 |
| Absensi tim | tanggal lain | 24 |
| Absensi tim | hari libur | 25 |
| Absensi tim | kosong (belum punya anggota) | 26 |
| Absensi tim | memuat | 27 |
| Absensi tim | galat | 28 |
| Riwayat absensi anggota | — | 29 |
| Profil anggota tim (tanpa gaji/KTP/alamat) | — | 30 |

## Batch 3A HR — `HRIS PT. SMP — Batch 3A.pdf` (desktop 1440 px)

| Layar | Varian | Hal |
|---|---|---|
| Sidebar HR / header — potongan shell (?) | — | 1–2 |
| Dashboard HR | normal | 3 |
| Daftar karyawan | daftar | 4 |
| Daftar karyawan | hasil cari kosong | 5 |
| Daftar karyawan | memuat | 6 |
| Daftar karyawan | galat | 7 |
| Tambah karyawan | form | 8 |
| Tambah karyawan | galat validasi | 9 |
| Tambah karyawan | menyimpan | 10 |
| Tambah karyawan | sukses | 11 |
| Edit karyawan | karyawan (KTP "Tampilkan") | 12 |
| Edit karyawan | peran Direksi | 13 |
| Detail karyawan — tab Profil | — | 14 |
| Detail karyawan — tab Absensi | — | 15 |
| Detail karyawan — tab Pengajuan | — | 16 |
| Detail karyawan — tab Slip gaji | — | 17 |
| Detail karyawan — tab Riwayat perubahan | — | 18 |
| Detail karyawan | dialog nonaktifkan | 19 |
| Detail karyawan | No. KTP ditampilkan | 20 |
| Rekap absensi | daftar | 21 |
| Rekap absensi | setelah koreksi | 24 |
| Rekap absensi | kosong | 26 |
| Rekap absensi | memuat | 27 |
| Rekap absensi | galat | 28 |
| Panel koreksi absensi | normal | 22 |
| Panel koreksi absensi | alasan wajib | 23 |
| Tambah absensi manual | — | 25 |

## Batch 3B HR — `HRIS PT. SMP — Batch 3B.pdf` (desktop)

| Layar | Varian | Hal |
|---|---|---|
| Persetujuan tingkat 2 — tab Lembur | daftar | 1 |
| Persetujuan tingkat 2 — panel detail lembur | — | 2 |
| Persetujuan tingkat 2 — tab Cuti/Sakit/Izin | daftar | 3 |
| Persetujuan tingkat 2 — panel detail cuti | — | 4 |
| Persetujuan tingkat 2 — Riwayat | — | 5 |
| Persetujuan tingkat 2 | kosong | 6 |
| Persetujuan tingkat 2 | memuat | 7 |
| Persetujuan tingkat 2 | galat | 8 |
| Payroll — daftar periode | daftar | 9 |
| Payroll — daftar periode | kosong | 12 |
| Payroll — daftar periode | memuat | 13 |
| Payroll — daftar periode | galat | 14 |
| Buat payroll (dialog) | normal | 10 |
| Buat payroll (dialog) | duplikat | 11 |
| Payroll detail | Draft | 15 |
| Payroll detail | Draft — memuat sebagian (?) | 26 |
| Payroll detail — panel potongan | Rina | 16 |
| Payroll detail — panel potongan | Fajar (alpha) | 17 |
| Payroll detail — panel potongan | gagal simpan | 21 |
| Payroll detail — rincian lembur | Rina / Dimas / Andi | 18 / 19 / 20 |
| Payroll detail | dialog ajukan ke Direksi | 22 |
| Payroll detail | Diajukan | 23 |
| Payroll detail | Revisi | 24 |
| Payroll detail | Final (Oktober) | 25 |
| Payroll detail | memuat | 27 |
| Payroll detail | galat | 28 |

## Batch 3C HR — `HRIS PT. SMP — Batch 3C.pdf` (desktop)

| Layar | Varian | Hal |
|---|---|---|
| Laporan — Absensi bulanan (kartu ringkasan tak ter-render: `{{ c.k }}`) | — | 1 |
| Laporan — Absensi | memuat (?) | 9 |
| Laporan — Lembur bulanan | — | 2 |
| Laporan — rincian lembur per karyawan | — | 3 |
| Laporan — Gaji | payroll belum final | 4 |
| Laporan — Gaji tahunan | — | 5 |
| Laporan — Gaji bulanan | — | 6 |
| Laporan | unduh berhasil | 7 |
| Laporan | kosong (periode belum berjalan) | 8 |
| Laporan | galat | 10 |
| Master data — Jadwal kerja | — | 11 |
| Master data — Hari libur | daftar | 12 |
| Master data — Tambah hari libur | dialog | 13 |
| Master data — Tambah hari libur | tanggal duplikat | 14 |
| Master data — Pengaturan | — | 15 |
| Log audit | daftar | 16 |
| Log audit — panel detail | ubah absensi | 17 |
| Log audit — panel detail | lihat No. KTP | 18 |
| Keamanan (2FA) | belum aktif | 19 |
| Keamanan — 2FA langkah 1 | QR / kode | 20 |
| Keamanan — 2FA langkah 2 | masukkan kode | 21 |
| Keamanan — 2FA | kode salah | 22 |
| Keamanan — 2FA | aktif | 23 |

## Batch 4 Direksi — `HRIS PT. SMP — Batch 4.pdf` (desktop 1–45, mobile 46–66)

| Layar | Varian | Hal |
|---|---|---|
| Dashboard Direksi | normal | 1 |
| Persetujuan Direksi | daftar | 2 |
| Persetujuan Direksi — panel detail lembur (pengaju Atasan) | — | 3 |
| Persetujuan Direksi — panel detail cuti (pengaju HR) | — | 6 |
| Persetujuan Direksi | sukses disetujui | 4 |
| Persetujuan Direksi | gagal simpan | 5 |
| Persetujuan Direksi — Riwayat | — | 7 |
| Persetujuan Direksi | kosong | 8 |
| Persetujuan Direksi | memuat | 9 |
| Persetujuan Direksi | galat | 10 |
| Payroll — daftar | — | 11 |
| Notifikasi (desktop) | — | 12 |
| Review payroll | Diajukan | 13 |
| Review payroll — rincian lembur | Rina / Dimas / Andi | 14 / 15 / 16 |
| Review payroll — potongan | Rina / Fajar | 17 / 18 |
| Review payroll | dialog Setujui | 19 |
| Review payroll | setujui gagal | 20 |
| Review payroll | dialog Minta revisi | 21 |
| Review payroll | catatan revisi wajib | 22 |
| Review payroll | Final | 23 |
| Review payroll | Revisi | 24 |
| Review payroll | Diajukan (ringkas) | 25 |
| Review payroll | galat | 26 |
| Karyawan (read-only) | daftar | 27 |
| Detail karyawan (read-only) — Profil | — | 28 |
| Detail karyawan | No. KTP ditampilkan | 29 |
| Detail karyawan — tab Absensi / Pengajuan / Slip / Riwayat | — | 30 / 31 / 32 / 33 |
| Laporan — Absensi | — | 34 |
| Laporan — Lembur / rincian | — | 35 / 36 |
| Laporan — Gaji | belum final / tahunan / bulanan | 37 / 38 / 39 |
| Laporan | unduh berhasil | 40 |
| Keamanan — 2FA | belum aktif / QR / kode / salah / aktif | 41 / 42 / 43 / 44 / 45 |
| **Mobile** Beranda Direksi | — | 46 |
| Mobile — Persetujuan | daftar (Lembur) | 47 |
| Mobile — Persetujuan | tab Cuti (?) | 48 |
| Mobile — Persetujuan | Riwayat | 49 |
| Mobile — Persetujuan | sukses disetujui | 50 |
| Mobile — Persetujuan | kosong | 51 |
| Mobile — Detail persetujuan | lembur Atasan / cuti HR | 52 / 53 |
| Mobile — Review payroll | Diajukan | 54 |
| Mobile — Review payroll | rincian karyawan | 55 |
| Mobile — Review payroll | dialog Setujui / gagal | 56 / 57 |
| Mobile — Review payroll | Minta revisi / wajib | 58 / 59 |
| Mobile — Review payroll | Final / Revisi / Diajukan / galat | 60 / 61 / 62 / 63 |
| Mobile — Laporan | — | 64 |
| Mobile — Profil Direksi | — | 65 |
| Mobile — Notifikasi | — | 66 |

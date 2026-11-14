# Handoff — HRIS PT. SMP

Ringkasan diskusi perencanaan (claude.ai, 12 Nov 2026) untuk dilanjutkan di Claude Code. Baca bersama `CLAUDE.md`, `docs/prd.md`, `docs/spesifikasi.md`, `docs/security.md`.

---

## 1. Status saat ini

| Area | Status |
|---|---|
| Analisis & UML (use case, activity, sequence, class) | ✅ Selesai — `docs/spesifikasi.md` |
| ERD | ✅ Selesai — `docs/spesifikasi.md` §7 |
| PRD & security | ✅ Selesai, tidak ada pertanyaan terbuka |
| Desain UI/UX 4 peran (Claude Design) | ✅ Selesai & dicek konsistensi angka |
| Repo | ✅ Scaffold Vite + React + TS, dokumen di `docs/`, client Supabase, `.env.example` (commit `14613f9`, belum di-push) |
| Supabase | ✅ Project baru di **Singapore** — **`.env.local` harus diisi URL & anon key project baru ini** (project Mumbai lama tidak dipakai, boleh dihapus) |
| Supabase CLI, migrasi, tabel `pengguna` + RLS | ✅ Fase 1 (13 Nov 2026) — 30 uji pgTAP, di-push ke production |
| Auth & UI dasar | ✅ Login, lupa/atur password (token_hash), SMTP Gmail `hris.ptsmp@gmail.com`, layout & routing per peran (Mobile / Panel) |
| Akun uji | HR & Direksi (`alghifarirzk+hr/+direksi@gmail.com`). Karyawan & Atasan dibuat lewat fitur tambah karyawan di Fase 2 |
| Fase 2 — master data & karyawan | ✅ (13 Nov 2026) — master data (jadwal, hari libur, pengaturan), log audit + alasan perubahan, Edge Function `akun` (undang / kirim ulang / ubah email), daftar–tambah–edit–detail karyawan, KTP hanya lewat `lihat_ktp`, nonaktif terjadwal (pg_cron 00:05 WIB) & aktif kembali, profil & ganti password. 121 uji pgTAP, 70 uji Vitest, uji integrasi `scripts/uji-akun-lokal.mjs` |
| Akun uji tambahan | Karyawan & Atasan uji (`alghifarirzk+karyawan/+atasan@gmail.com`) dibuat lewat fitur tambah karyawan |
| Deploy preview | ✅ Vercel `https://hris-pt-smp.vercel.app` (auto-deploy dari `main`); domain terdaftar di redirect URL Supabase & secret `APP_ORIGINS`. `site_url` masih `localhost:5173` sampai go-live |
| Fase 3 — absensi | ✅ (14 Nov 2026) — clock in/out selfie (jam server, toleransi 5 menit, tolak hari libur & sebelum tanggal masuk), kartu Beranda, riwayat & detail (signed URL), absensi tim Atasan (RPC `anggota_tim`), rekap HR + koreksi/tambah manual (alasan via header → log), auto clock out 00:10 WIB, retensi selfie 12 bulan + foto yatim (Edge Function `bersihkan-selfie`, kunci di Vault). 178 uji pgTAP, 88 uji Vitest, 2 uji integrasi |
| Berikutnya | **Fase 4** — lembur, cuti/sakit/izin, persetujuan, notifikasi (OT-, LV-, APR-, NTF-) |

---

## 2. Langkah berikutnya (urutan disarankan)

Ikuti fase di `docs/prd.md` §9. Kerjakan satu langkah per giliran.

**Fase 1 — Fondasi**
1. Pastikan `.env.local` memakai project Singapore; cek `git check-ignore dist .env.local`.
2. Setup Supabase CLI via `npx supabase` (tanpa instal global): `init`, `login`, `link` ke project Singapore.
3. Install library terpilih: React Router, TanStack Query, React Hook Form, Zod, Tailwind CSS, Vitest.
4. Migrasi pertama: enum + tabel `pengguna` + fungsi helper RLS (`peran_saya`, `adalah_bawahan`) + RLS `pengguna`.
5. Matikan sign up publik di Auth settings; buat akun HR pertama (manual di dashboard) untuk pengujian.
6. Layout & routing per peran (mobile untuk Karyawan/Atasan, desktop untuk HR/Direksi), halaman login.

**Fase 2–7**: master data & karyawan → absensi → lembur/cuti/persetujuan → payroll & slip → laporan → hardening & deploy.

**Catatan untuk fase berikutnya (13 Nov 2026)**
- Fase 2: karyawan login dengan **email pribadi** (tidak ada email kantor). Di form tambah/edit karyawan, label desain "Email kantor" diganti "Email", contoh `nama@gmail.com`.
- Fase 3: selfie butuh HTTPS (getUserMedia) — uji di HP perlu deploy preview (Vercel) atau tunnel HTTPS; `localhost` hanya di laptop.
- Fase 4: clock in hari libur dibuka untuk lembur hari libur yang disetujui (RPC `catat_clock_in` & auto clock out hari tanpa jadwal); hari cuti tampil sesuai jenisnya di riwayat/absensi tim/rekap (bukan "Tanpa absensi"); kotak "Cuti/sakit/izin" di absensi tim; "termasuk lembur" di riwayat.
- Fase 4: trigger `kelola_nonaktif` ditambah pembatalan pengajuan Menunggu; job reset saldo 1 Jan memberi jatah proporsional bagi yang masuk tahun itu; tampilkan "N hari terpakai" & "cuti menunggu" di profil/detail.
- Fase 7: pecah chunk utama bundle (±580 kB / 170 kB gzip: Supabase, React, Router) — peringatan Vite > 500 kB sengaja ditunda.

**Prioritas unit test (Vitest)**: hitung hari kerja, upah lembur (hari kerja / libur / libur di Sabtu), hari hadir, rumus slip, saldo cuti proporsional. Gunakan data uji di §5.

---

## 3. Keputusan & alasannya

| Keputusan | Alasan |
|---|---|
| Web app responsif + PWA, bukan app native | Satu codebase untuk karyawan (HP) dan HR/Direksi (laptop); kamera & push tersedia di browser; bisa dibungkus Capacitor nanti |
| Persetujuan 2 tingkat (Karyawan → Atasan → HR), Atasan/HR → Direksi | Sesuai struktur PT. SMP |
| Lembur opsi A: ajukan sebelum lembur, clock out sekali | Absensi tetap 1× masuk 1× keluar; jam dibayar objektif = min(aktual, disetujui) |
| Batas lembur: hari kerja ≤ jam pulang; hari libur ≤ jam mulai lembur | Hari libur tidak punya jam pulang |
| Upah lembur PP 35/2021, upah sejam = gaji pokok ÷ 173 | Tunjangan makan/transport per hari hadir bukan tunjangan tetap, jadi tidak masuk dasar upah |
| Hari hadir tidak menghitung lembur hari libur | Tunjangan makan/transport hanya untuk hari kerja |
| Pembulatan ke rupiah: upah sejam & upah per pengajuan | Angka konsisten & bisa diuji |
| Jam dari server (`now()`) | Mencegah manipulasi jam HP |
| Lupa clock out → isi jam pulang standar + tanda auto | Data tetap lengkap; HR bisa koreksi |
| Koreksi absensi HR + log audit di MVP | Koreksi memengaruhi gaji, harus terlacak |
| Payroll 26–25, label = bulan tanggal 25 | Kebijakan PT. SMP |
| Tunjangan: tarif default per periode, bisa override per karyawan | Contoh: kurir punya transport khusus |
| Potongan manual (Alpha/Terlambat/Kasbon) tanpa persetujuan | Nominal tidak tentu; dikendalikan lewat persetujuan payroll Direksi |
| Payroll final terkunci; nilai gaji disalin ke slip | Slip lama tidak berubah saat gaji naik |
| Slip & laporan dibuat di frontend (`@react-pdf/renderer`, SheetJS) | Sederhana; tidak perlu simpan file; email bisa ditambah via Edge Function nanti |
| Tidak ada tanggal bayar di slip | Transfer di luar aplikasi |
| Cuti: reset 1 Jan, sisa hangus, karyawan baru proporsional | Kebijakan PT. SMP |
| Cuti bersama memotong saldo, saldo tidak minus | Kebijakan PT. SMP (lihat PRD §6.7) |
| Lampiran sakit opsional | Kebijakan PT. SMP |
| No. KTP: RLS + tersamar, tanpa enkripsi; HR/Direksi bisa "Tampilkan" (dicatat) | Seimbang antara kebutuhan administrasi & keamanan |
| 2FA HR & Direksi: opsional di MVP, wajib sebelum go-live | Akses data gaji semua karyawan |
| Selfie disimpan 12 bulan | Cukup untuk audit tahunan, hemat storage |
| Karyawan nonaktif: tidak bisa login, data tetap, pengajuan Menunggu dibatalkan | Riwayat & slip tetap tersedia |
| Nama tabel/kolom Bahasa Indonesia | Konsisten dengan UML & dokumen |
| Region Supabase Singapore | Terdekat dengan pengguna di Indonesia |

---

## 4. Desain UI

- **Sumber**: Claude Design — artifact "HRIS PT. SMP — Batch 1 Karyawan" (https://claude.ai/artifact/MNyc19M9jjxd2CkZ8Q2Hgp, privat milik Al).
- **Gambar**: export 6 PDF di `design/` (Batch 1 Karyawan, 2, 3A, 3B, 3C, 4). Cara membacanya: `CLAUDE.md` → *Membaca desain*.
- **Design system**: font Inter; primer `#1E4FD8`; latar `#F5F7FA`; teks `#0F172A` / sekunder `#475569`; border `#E2E8F0`; radius kontrol 8px, kartu 12px; tinggi kontrol 48px (mobile) / 44px (desktop); target sentuh ≥ 44px. Badge status selalu titik + label: Menunggu, Disetujui, Ditolak, Dibatalkan, Tepat waktu, Terlambat, Auto clock out, Dikoreksi HR, Belum clock in, Tanpa absensi, Draft, Diajukan, Revisi, Final.
- Setiap daftar/tabel punya state loading (skeleton), empty, error.

### Daftar layar

**Karyawan (mobile 390px)** — bottom nav: Beranda, Absensi, Pengajuan, Slip Gaji, Profil
- Login, Lupa password (+ terkirim), error login
- Beranda: absensi hari ini (Clock In / Clock Out / lengkap), saldo cuti, pengajuan terakhir, banner slip terbit; varian Sabtu
- Clock in/out: kamera (tanpa galeri), pratinjau, sukses tepat waktu/terlambat, izin kamera ditolak, gagal kirim, offline
- Riwayat absensi bulanan + detail (foto masuk/keluar, catatan koreksi HR, auto clock out)
- Ajukan lembur (banner batas dinamis: hari kerja / Sabtu / hari libur)
- Ajukan cuti/sakit/izin (hari kerja otomatis, saldo, lampiran opsional, saldo kurang)
- Daftar pengajuan (tab Lembur / Cuti-Sakit-Izin, filter status) + detail (timeline persetujuan, batalkan)
- Slip gaji (daftar & detail, unduh PDF)
- Notifikasi, Profil (KTP tersamar), prompt install PWA

**Atasan (mobile)** — bottom nav: Beranda, Absensi, Pengajuan, Persetujuan (badge), Profil; slip via Profil
- Beranda Atasan: menunggu persetujuan, tim hari ini, absensi pribadi
- Persetujuan: daftar (Menunggu/Riwayat) + detail lembur (konteks clock in) & cuti (saldo, bentrok tim, viewer lampiran), bottom sheet setujui/tolak, varian tingkat 2 (HR) & Direksi, dibatalkan pengaju, gagal simpan
- Absensi tim (per tanggal, ringkasan, libur; status "menunggu persetujuan" dibedakan) → riwayat anggota → profil anggota (tanpa gaji/KTP/alamat)

**HR (desktop 1440px)** — sidebar: Dashboard, Karyawan, Absensi, Persetujuan, Payroll, Laporan, Master data, Log audit; Akun saya, Keamanan, Keluar
- Dashboard: kehadiran hari ini, menunggu tingkat 2, status payroll, perlu dicek, tanggal merah
- Karyawan: daftar, form tambah/edit (validasi; varian peran Direksi tanpa atasan/gaji/saldo; KTP "Tampilkan"), detail (Profil, Absensi, Pengajuan, Slip, Riwayat perubahan), dialog nonaktifkan
- Absensi: rekap + panel koreksi (alasan wajib) & tambah manual
- Persetujuan: tabel + panel detail tingkat 2
- Payroll: daftar periode, buat payroll (cegah duplikat), detail Draft (tarif, tabel, panel potongan & rincian lembur, ajukan), varian Diajukan / Revisi / Final
- Laporan: Absensi / Lembur / Gaji, bulanan & tahunan, unduh Excel/PDF
- Master data: jadwal kerja, hari libur, pengaturan
- Log audit (read-only, panel nilai lama/baru), Keamanan (2FA 3 langkah, ganti password)

**Direksi (desktop + mobile)** — sidebar: Dashboard, Persetujuan, Payroll, Karyawan (read-only), Laporan; Keamanan. Mobile bottom nav: Beranda, Persetujuan, Laporan, Profil
- Dashboard / Beranda: menunggu keputusan (satu tingkat, langsung final), ringkasan, status payroll
- Review payroll (read-only + rincian), dialog Setujui (catatan opsional) & Minta revisi (catatan wajib), status final/revisi
- Tanpa clock in, saldo cuti, slip, atau "Akun saya"

---

## 5. Data uji (dipakai di desain, sudah dihitung)

**Rumus**: jumlah gaji = pokok + upah lembur + tarif makan × hadir + tarif transport × hadir + pendapatan lain; bersih = jumlah − potongan.

### Payroll November 2026 (26 Okt – 25 Nov, 27 hari kerja; tarif makan 25.000, transport 20.000)

| Karyawan | Pokok | Hadir | Jam lembur | Upah lembur | Makan | Transport | Lain | Potongan | Jumlah | Bersih |
|---|---|---|---|---|---|---|---|---|---|---|
| Rina Wulandari | 4.800.000 | 26 | 9 | 471.682 | 650.000 | 520.000 | 0 | 550.000 | 6.441.682 | 5.891.682 |
| Dimas Saputra | 4.600.000 | 27 | 2,5 | 119.655 | 675.000 | 540.000 | 0 | 75.000 | 5.934.655 | 5.859.655 |
| Andi Pratama | 4.500.000 | 27 | 2 | 91.042 | 675.000 | 540.000 | 0 | 0 | 5.806.042 | 5.806.042 |
| Yoga Prasetyo | 4.500.000 | 25 | 0 | 0 | 625.000 | 500.000 | 0 | 0 | 5.625.000 | 5.625.000 |
| Fajar Nugroho | 4.300.000 | 26 | 0 | 0 | 650.000 | 910.000 (35.000/hari) | 0 | 165.000 | 5.860.000 | 5.695.000 |
| Siti Rahmawati | 4.500.000 | 26 | 0 | 0 | 650.000 | 520.000 | 200.000 | 0 | 5.870.000 | 5.870.000 |
| **Total** | 27.200.000 | 157 | 13,5 | 682.379 | 3.925.000 | 3.530.000 | 200.000 | 790.000 | 35.537.379 | **34.747.379** |

### Rincian lembur
| Karyawan | Upah sejam | Tanggal | Jenis | Disetujui | Aktual | Dibayar | Pengali | Upah |
|---|---|---|---|---|---|---|---|---|
| Rina | 27.746 | Sab 7 Nov | kerja | 12:00–14:30 | 2j34m | 2,5 | 4,5 | 124.857 |
| Rina | 27.746 | Min 15 Nov | libur | 09:00–13:00 | 4j07m | 4 | 8 | 221.968 |
| Rina | 27.746 | Sen 16 Nov | kerja | 15:00–17:30 | 2j40m | 2,5 | 4,5 | 124.857 |
| Dimas | 26.590 | Kam 12 Nov | kerja | 15:00–17:30 | 2j35m | 2,5 | 4,5 | 119.655 |
| Andi | 26.012 | Sel 10 Nov | kerja | 15:00–17:00 | 2j05m | 2 | 3,5 | 91.042 |

### Slip Oktober 2026 Rina (26 Sep – 25 Okt, 25 hari kerja)
Hadir 21 (cuti 5–6 Okt, izin 23 Okt, alpha 14 Okt) · pokok 4.800.000 · lembur 7 jam 346.825 (1 Okt 2j = 97.111; 10 Okt 3j = 152.603; 20 Okt 2j = 97.111) · makan 525.000 · transport 420.000 · lain 150.000 · **jumlah 6.241.825** · potongan 734.600 (alpha 184.600, terlambat 50.000, kasbon 500.000) · **bersih 5.507.225**.

### Lain-lain
- Karyawan masuk 16 Nov 2026 → jatah cuti 2026 = 1 hari.
- Cuti Rina 24–29 Des 2026 = 4 hari kerja (25 Des Natal & 27 Des Minggu tidak dihitung).
- Rekap tahunan Rina Jan–Okt 2026 = Rp 51.878.125.

---

## 6. Pertanyaan terbuka

Tidak ada. Hal baru yang belum tercakup dokumen → tanyakan ke Al sebelum memutuskan.

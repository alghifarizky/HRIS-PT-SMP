# PRD — HRIS PT. SMP

| | |
|---|---|
| Versi | 1.0 (draft) |
| Tanggal | 12 November 2026 |
| Pemilik | Al |
| Stack | React JS + Supabase |
| Dokumen terkait | `spesifikasi.md` (UML & ERD), `security.md` |

---

## 1. Latar belakang

PT. SMP (±25 karyawan) membutuhkan sistem internal untuk mendigitalkan absensi, pengajuan lembur dan ketidakhadiran, serta penggajian. Saat ini proses tersebut diasumsikan manual sehingga rawan salah hitung, sulit dilacak, dan lambat disetujui.

## 2. Tujuan

1. Absensi harian tercatat akurat dengan bukti foto selfie dan jam server.
2. Pengajuan lembur dan cuti/sakit/izin berjalan digital dengan alur persetujuan berjenjang.
3. Payroll bulanan dihitung otomatis dari data absensi dan lembur, disetujui Direksi, dan slip gaji dapat diunduh karyawan.
4. HR dan Direksi memiliki rekap absensi, lembur, dan gaji per bulan dan per tahun yang dapat diunduh.

## 3. Pengguna & peran

| Peran | Deskripsi | Ikut absensi & payroll |
|---|---|---|
| Karyawan | Pegawai biasa | Ya |
| Atasan | Karyawan yang membawahi karyawan lain | Ya |
| HR / Admin | Karyawan yang mengelola data SDM & payroll | Ya |
| Direksi | Pimpinan perusahaan | Tidak |

Atasan dan HR memiliki semua kemampuan Karyawan ditambah kemampuan perannya.

## 4. Ruang lingkup

### Termasuk (MVP)
- Autentikasi & manajemen pengguna berbasis peran
- Data karyawan
- Absensi clock in / clock out dengan foto selfie
- Pengajuan & persetujuan lembur
- Pengajuan & persetujuan cuti, sakit, izin
- Payroll bulanan, persetujuan Direksi, slip gaji PDF
- Laporan rekap (absensi, lembur, gaji) + export Excel & PDF
- Notifikasi dalam aplikasi
- Master data: jadwal kerja, hari libur, pengaturan

### Tidak termasuk (MVP)
- PPh 21 dan BPJS
- Pengiriman slip gaji via email
- Validasi lokasi (GPS) dan pengenalan wajah
- Aplikasi mobile native
- Multi-perusahaan / multi-cabang
- Sistem shift

---

## 5. Kebutuhan fungsional

Prioritas: **P0** = wajib MVP, **P1** = penting, bisa menyusul di akhir MVP.

### 5.1 Autentikasi & akun
| ID | Kebutuhan | Prioritas |
|---|---|---|
| AUTH-01 | Pengguna login dengan email & password (Supabase Auth) | P0 |
| AUTH-02 | Akun dibuat oleh HR (akun ber-peran HR dibuat oleh Direksi), bukan registrasi mandiri | P0 |
| AUTH-03 | Pengguna dapat reset password | P0 |
| AUTH-04 | Menu & halaman yang tampil sesuai peran | P0 |
| AUTH-05 | Logout | P0 |
| AUTH-06 | 2FA (TOTP / aplikasi authenticator) tersedia untuk HR & Direksi — opsional di MVP, **wajib sebelum go-live production** | P0 |

### 5.2 Data karyawan
| ID | Kebutuhan | Prioritas |
|---|---|---|
| EMP-01 | HR dapat melihat daftar semua karyawan (cari & filter) | P0 |
| EMP-02 | HR dapat menambah, mengubah, menonaktifkan karyawan. Karyawan nonaktif (resign) tidak bisa login sejak tanggal efektif; data & slip tetap tersimpan dan dapat diunduhkan HR; pengajuan berstatus Menunggu dibatalkan otomatis | P0 |
| EMP-03 | Data karyawan: nama, email, NIK, jabatan, tanggal lahir, alamat, tanggal masuk kerja, no. KTP, status menikah, jumlah tanggungan, gaji pokok, peran, atasan | P0 |
| EMP-04 | Karyawan dapat melihat profilnya sendiri | P0 |
| EMP-05 | Saldo cuti tampil di profil & form cuti | P0 |
| EMP-06 | No. KTP selalu tersamar; HR & Direksi dapat menekan "Tampilkan" untuk melihat nomor lengkap, dan setiap tindakan ini tercatat di log audit | P0 |
| EMP-07 | Status menikah: Belum menikah / Menikah | P0 |
| EMP-08 | Direksi mengelola akun HR: membuat akun HR, mengubah peran ke/dari HR, menonaktifkan HR, dan mengubah data HR (termasuk gaji). Data karyawan lain tetap hanya-baca bagi Direksi. Tidak ada pengguna yang dapat mengubah peran atau status aktif akunnya sendiri; akun Direksi hanya dikelola developer | P0 |

### 5.3 Absensi
| ID | Kebutuhan | Prioritas |
|---|---|---|
| ATT-01 | Karyawan clock in dengan foto selfie dari kamera | P0 |
| ATT-02 | Karyawan clock out dengan foto selfie dari kamera | P0 |
| ATT-03 | Maksimal satu clock in & satu clock out per hari | P0 |
| ATT-04 | Jam absensi diambil dari waktu server | P0 |
| ATT-05 | Sistem menandai **terlambat** jika clock in melewati jam masuk jadwal | P0 |
| ATT-06 | Jika lupa clock out, sistem mengisi jam pulang standar dan menandai **auto clock out** (job tengah malam) | P0 |
| ATT-07 | Karyawan melihat riwayat absensinya | P0 |
| ATT-08 | Atasan melihat absensi timnya | P0 |
| ATT-09 | HR dapat menambah / mengoreksi absensi karyawan (mis. HP rusak) dengan alasan wajib; tercatat di log audit | P0 |
| ATT-10 | Foto selfie dihapus otomatis setelah 12 bulan | P0 |

### 5.4 Lembur
| ID | Kebutuhan | Prioritas |
|---|---|---|
| OT-01 | Pengaju mengisi tanggal, jam mulai, jam selesai, alasan | P0 |
| OT-02 | Batas pengajuan: hari kerja → paling lambat jam pulang di hari yang sama; hari libur → paling lambat sebelum jam mulai lembur | P0 |
| OT-03 | Lembur hari libur (Minggu / tanggal merah) diperbolehkan | P0 |
| OT-04 | Pengaju dapat membatalkan selama status menunggu | P0 |
| OT-05 | Persetujuan berjenjang sesuai §6.1 | P0 |
| OT-06 | Jam dibayar = min(jam aktual, jam disetujui) | P0 |

### 5.5 Cuti / sakit / izin
| ID | Kebutuhan | Prioritas |
|---|---|---|
| LV-01 | Pengaju memilih jenis, tanggal mulai–selesai, alasan, lampiran opsional | P0 |
| LV-02 | Sistem menghitung jumlah hari kerja (Senin–Sabtu, tanpa tanggal merah) | P0 |
| LV-03 | Jenis cuti dicek terhadap saldo; ditolak sistem jika kurang | P0 |
| LV-04 | Saldo cuti dikurangi hanya setelah disetujui | P0 |
| LV-05 | Sakit & izin tidak memotong saldo | P0 |
| LV-06 | Pengaju dapat membatalkan selama status menunggu | P0 |
| LV-07 | Persetujuan berjenjang sesuai §6.1 | P0 |
| LV-08 | Saldo cuti di-reset setiap 1 Januari; sisa cuti tahun sebelumnya hangus | P0 |
| LV-09 | Karyawan baru mendapat jatah proporsional (§6.5) | P0 |

### 5.6 Persetujuan
| ID | Kebutuhan | Prioritas |
|---|---|---|
| APR-01 | Penyetuju melihat daftar pengajuan yang menunggu keputusannya | P0 |
| APR-02 | Penyetuju menyetujui / menolak dengan catatan opsional | P0 |
| APR-03 | Riwayat persetujuan (siapa, kapan, keputusan) tersimpan | P0 |

### 5.7 Payroll & slip gaji
| ID | Kebutuhan | Prioritas |
|---|---|---|
| PAY-01 | HR membuat payroll per periode (26–25, label bulan tanggal 25) | P0 |
| PAY-02 | Sistem merekap hari hadir & jam lembur disetujui per karyawan | P0 |
| PAY-03 | HR mengisi tarif tunjangan makan & transport per hari | P0 |
| PAY-04 | HR mengisi pendapatan lain per karyawan | P0 |
| PAY-05 | HR mengisi potongan dengan kategori alpha / terlambat / kasbon | P0 |
| PAY-06 | Sistem menghitung jumlah gaji & pendapatan bersih (rumus §6.4) | P0 |
| PAY-07 | HR mengajukan payroll ke Direksi | P0 |
| PAY-08 | Direksi menyetujui atau meminta revisi dengan catatan | P0 |
| PAY-09 | Payroll final dikunci, tidak dapat diubah | P0 |
| PAY-10 | Karyawan menerima notifikasi & mengunduh slip PDF | P0 |
| PAY-11 | Slip periode lama tetap dapat diunduh | P0 |

### 5.8 Laporan
| ID | Kebutuhan | Prioritas |
|---|---|---|
| RPT-01 | HR & Direksi melihat rekap absensi per bulan & per tahun | P0 |
| RPT-02 | HR & Direksi melihat rekap lembur per bulan & per tahun | P0 |
| RPT-03 | HR & Direksi melihat rekap gaji per bulan & per tahun | P0 |
| RPT-04 | Semua laporan dapat diunduh Excel & PDF | P0 |

### 5.9 Notifikasi
| ID | Kebutuhan | Prioritas |
|---|---|---|
| NTF-01 | Notifikasi dalam aplikasi (realtime) untuk: pengajuan baru, hasil persetujuan, payroll diajukan, revisi payroll, slip terbit | P0 |
| NTF-02 | Penanda sudah/belum dibaca | P0 |

### 5.10 Master data
| ID | Kebutuhan | Prioritas |
|---|---|---|
| MST-01 | HR mengatur jam masuk & pulang per hari (Senin–Sabtu) | P0 |
| MST-02 | HR mengelola daftar tanggal merah & cuti bersama (jenis dibedakan) | P0 |
| LV-10 | Cuti bersama memotong saldo cuti otomatis (§6.7) | P0 |
| MST-03 | HR mengatur jatah cuti tahunan | P0 |

---

## 6. Aturan bisnis

### 6.1 Alur persetujuan
| Pengaju | Tingkat 1 | Tingkat 2 |
|---|---|---|
| Karyawan | Atasan | HR |
| Atasan / HR | Direksi | — |

Ditolak di tingkat mana pun → status akhir **ditolak**.

### 6.2 Jadwal kerja
- 6 hari kerja, total 40 jam/minggu:
  - Senin–Jumat **07:00–15:00** (7 jam kerja + 1 jam istirahat)
  - Sabtu **07:00–12:00** (5 jam, hari kerja terpendek)

### 6.3 Upah lembur (PP 35/2021, pola 6 hari kerja)
- Upah sejam = 1/173 × gaji pokok.
- Hari kerja: jam ke-1 = 1,5×; jam berikutnya = 2×. Jam aktual = clock out − jam pulang standar.
- Hari istirahat / libur resmi: jam ke-1–7 = 2×; jam ke-8 = 3×; jam ke-9–11 = 4×. Jam aktual = clock out − clock in.
- Libur resmi jatuh di hari kerja terpendek (Sabtu): jam ke-1–5 = 2×; jam ke-6 = 3×; jam ke-7–9 = 4×.

### 6.4 Rumus gaji
```
tunj_makan        = tarif_makan × hari_hadir
tunj_transport    = tarif_transport × hari_hadir
jumlah_gaji       = gaji_pokok + upah_lembur + tunj_makan + tunj_transport + pendapatan_lain
pendapatan_bersih = jumlah_gaji − total_potongan
```
Nilai gaji pokok & tarif disalin ke slip saat payroll dibuat.
- **Hari hadir** = jumlah hari kerja (Senin–Sabtu, bukan tanggal merah) yang memiliki absensi. Lembur di hari libur tidak menambah hari hadir.
- **Pembulatan**: upah sejam dibulatkan ke rupiah terdekat; upah lembur per pengajuan = total pengali × upah sejam, dibulatkan ke rupiah terdekat.


### 6.5 Jatah cuti
- Jatah tahunan sama untuk semua karyawan (diatur di `pengaturan`).
- Reset otomatis setiap 1 Januari (job `pg_cron`); sisa hangus.
- Karyawan baru: jatah tahun berjalan = jatah tahunan × (jumlah bulan penuh tersisa ÷ 12), dibulatkan ke bawah.
  Contoh: jatah 12 hari, masuk 15 Maret → bulan penuh tersisa April–Desember = 9 → **9 hari**.

### 6.7 Cuti bersama
- HR menandai tanggal cuti bersama di master data hari libur (jenis = cuti bersama).
- Cuti bersama **memotong saldo cuti tahunan** 1 hari per tanggal, otomatis untuk semua karyawan aktif (bukan Direksi).
- Saldo tidak bisa minus: bila saldo 0, cuti bersama tetap berlaku tanpa potongan saldo.
- Tanggal cuti bersama tidak dihitung sebagai hari kerja (tidak wajib absen, tidak dihitung dalam jumlah hari pengajuan cuti, tidak menjadi alpha).
- Karyawan yang tetap diminta masuk pada tanggal itu: saldonya tidak dipotong dan dihitung hadir biasa (HR mengoreksi lewat absensi).

### 6.6 Status
- Pengajuan: `menunggu` → `disetujui` / `ditolak` / `dibatalkan`
- Payroll: `draft` → `diajukan` → (`revisi` → `diajukan`) → `final`

---

## 7. Kebutuhan non-fungsional

| Area | Kebutuhan |
|---|---|
| Keamanan | Lihat `security.md` (RLS di semua tabel, bucket privat, data sensitif dilindungi) |
| Akurasi | Semua perhitungan uang memakai tipe `numeric`, bukan float |
| Waktu | Zona waktu Asia/Jakarta (WIB); timestamp disimpan `timestamptz` |
| Bahasa | Antarmuka Bahasa Indonesia; format Rupiah & tanggal Indonesia |
| Platform | **Web app responsif + PWA** (dapat di-install ke home screen). Mobile-first untuk fitur karyawan, desktop-friendly untuk HR & Direksi |
| Kompatibilitas | Browser modern dengan akses kamera (Chrome Android, Safari iOS 16.4+, Chrome/Edge desktop) |
| Kinerja | Halaman utama tampil < 3 detik pada koneksi 4G |
| Audit | Riwayat persetujuan tersimpan; **log audit** mencatat perubahan data karyawan & koreksi absensi (siapa, kapan, nilai sebelum/sesudah) |
| Skala | ±25 karyawan — Supabase paket gratis cukup untuk pengembangan |

## 8. Teknologi

| Lapisan | Pilihan |
|---|---|
| Frontend | React + TypeScript (Vite), React Router, TanStack Query, React Hook Form + Zod, Tailwind CSS |
| Testing | Vitest (prioritas: rumus payroll, lembur, hari kerja, saldo cuti) |
| Backend | Supabase: Auth, Postgres, Storage, Realtime, pg_cron, RPC/trigger |
| PDF | `@react-pdf/renderer` (slip & laporan) |
| Excel | SheetJS (laporan) |
| Hosting frontend | Vercel |
| Konvensi DB | Nama tabel & kolom Bahasa Indonesia, snake_case |
| Tools dev | Cursor + Claude Code for VS Code |

## 9. Tahapan pengembangan

| Fase | Isi | Keluaran |
|---|---|---|
| 1 | Setup Supabase, skema DB, RLS dasar, auth, layout & routing per peran | Login berfungsi sesuai peran |
| 2 | Data karyawan & master data | HR dapat mengelola karyawan, jadwal, hari libur |
| 3 | Absensi + selfie + trigger terlambat + auto clock out | Clock in/out berjalan |
| 4 | Lembur, cuti/sakit/izin, persetujuan, notifikasi | Alur pengajuan end-to-end |
| 5 | Payroll, persetujuan Direksi, slip PDF | Slip dapat diunduh |
| 6 | Laporan & export Excel/PDF | Rekap bulanan & tahunan |
| 7 | Pengujian, hardening keamanan, deploy | Siap dipakai |

## 10. Kriteria keberhasilan
- Seluruh kebutuhan P0 berjalan end-to-end untuk keempat peran.
- Hasil hitung payroll sama dengan perhitungan manual untuk minimal 5 skenario uji (termasuk lembur hari kerja, hari libur, dan libur di hari Sabtu).
- Tidak ada pengguna yang dapat membaca data karyawan lain di luar haknya (diuji per peran).

---

## 11. Keputusan

| Topik | Keputusan |
|---|---|
| Nama | HRIS PT. SMP (judul aplikasi & kop slip) |
| Skala | ±25 karyawan |
| Platform | Web app responsif + PWA. Jika kelak butuh GPS ketat, face recognition, atau rilis di store → bungkus dengan Capacitor |
| Hosting | Vercel |
| Karyawan resign | Akun dinonaktifkan, tidak bisa login; data tetap tersimpan |
| Saldo cuti | Reset 1 Januari, sisa hangus, karyawan baru proporsional |
| Cuti bersama | Memotong saldo cuti (saldo tidak minus) |
| Region Supabase | Singapore (ap-southeast-1) |
| Koreksi absensi HR | Masuk MVP |
| Log audit | Masuk MVP |
| 2FA HR & Direksi | Opsional di MVP, wajib sebelum go-live |
| Masa simpan selfie | 12 bulan |
| No. KTP | Dilindungi RLS + view terbatas (tanpa enkripsi tambahan); tampil tersamar, HR & Direksi bisa "Tampilkan" (tercatat di log audit) |
| Karyawan nonaktif | Pengajuan Menunggu dibatalkan otomatis pada tanggal efektif |
| Email aplikasi | Dikirim dari Gmail khusus aplikasi (`hris.ptsmp@gmail.com`) lewat SMTP; karyawan login dengan email pribadi masing-masing (satu email per orang). Notifikasi harian di dalam aplikasi, bukan email |
| Pergantian HR | Direksi (owner, satu orang) yang mengangkat, mengganti & menonaktifkan HR (EMP-08). HR tetap boleh mengubah gaji & saldo cuti miliknya sendiri — diawasi lewat persetujuan payroll Direksi & log audit |

Belum ada pertanyaan terbuka.

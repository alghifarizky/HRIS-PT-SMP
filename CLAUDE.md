# CLAUDE.md — HRIS PT. SMP

Panduan untuk Claude Code saat bekerja di repo ini. **Baca bagian ini sebelum mengerjakan tugas apa pun.**

## Ringkasan proyek

Web app HRIS internal untuk PT. SMP (±25 karyawan): absensi clock in/out dengan selfie, pengajuan & persetujuan lembur dan cuti/sakit/izin, payroll bulanan dengan persetujuan Direksi, slip gaji PDF, laporan Excel/PDF.

- **Peran**: Karyawan, Atasan, HR, Direksi (Direksi tidak absen & tidak menerima slip).
- **Platform**: web app responsif + PWA. Fitur karyawan mobile-first; HR & Direksi desktop-first.
- **Bahasa UI**: Bahasa Indonesia. Format Rupiah `Rp 5.250.000`, tanggal `Kam, 12 Nov 2026`, zona waktu WIB (Asia/Jakarta).

## Dokumen acuan (sumber kebenaran)

| File | Isi | Kapan dibaca |
|---|---|---|
| `docs/prd.md` | Kebutuhan fungsional ber-ID (AUTH-, EMP-, ATT-, OT-, LV-, APR-, PAY-, RPT-, NTF-, MST-), aturan bisnis, tahapan | Sebelum membuat fitur apa pun |
| `docs/spesifikasi.md` | UML (use case, activity, sequence, class), ERD, constraint, catatan teknis Supabase | Sebelum membuat tabel, trigger, RPC, atau alur |
| `docs/security.md` | Matriks akses RLS, storage, kunci, validasi, checklist rilis | Sebelum menyentuh database, auth, storage, atau data sensitif |
| Desain Claude Design | Semua layar 4 peran + design system | Sebelum membuat UI |

Jika kode dan dokumen bertentangan, **dokumen yang benar** — tanyakan dulu sebelum menyimpang. Jika ada aturan yang tidak tercakup dokumen, **jangan menebak: tanyakan**.

## Stack

- **Frontend**: React (Vite), PWA. Deploy: Vercel.
- **Backend**: Supabase — Auth, Postgres, Storage, Realtime, pg_cron, RPC/trigger, Edge Function (hanya untuk operasi yang butuh `service_role`, mis. membuat akun karyawan).
- **PDF**: `@react-pdf/renderer` (slip & laporan). **Excel**: SheetJS.
- Detail tooling (package manager, router, state management, UI library, testing) belum diputuskan — **tanyakan sebelum menambah dependency baru**.

## Cara bekerja (wajib)

1. **Kolaboratif**: jangan mengambil keputusan sendiri untuk hal yang belum diputuskan. Tanyakan dulu, beri pilihan + saran.
2. **Satu langkah per giliran**: kerjakan satu langkah kecil, jelaskan, tunggu konfirmasi sebelum lanjut.
3. **Rujuk ID kebutuhan** dari PRD saat mengerjakan fitur (mis. "mengerjakan ATT-01, ATT-04").
4. Jelaskan dalam **Bahasa Indonesia**.

## Konvensi

### Database
- Nama tabel & kolom **Bahasa Indonesia, snake_case** (mis. `pengguna`, `pengajuan_lembur`, `slip_gaji`, `jam_masuk`).
- Semua perubahan skema lewat file migrasi di `supabase/migrations/` — jangan klik manual di dashboard production.
- Uang: `numeric(14,2)` dengan CHECK `>= 0`. **Jangan pernah** float.
- Waktu: `timestamptz`; jam absensi dari `now()` server, bukan dari client.
- Status/role/jenis/kategori: **enum Postgres**, bukan teks bebas.
- Foto & lampiran: kolom menyimpan **path** storage (`*_path`), bukan URL.

### Keamanan (ringkas — detail di `docs/security.md`)
- **RLS wajib aktif di setiap tabel `public`.** Tabel baru tanpa RLS = bug.
- Aturan bisnis penting ditegakkan di **database** (constraint/trigger/RPC), bukan hanya di UI.
- Fungsi `security definer` wajib `set search_path = ''`.
- Frontend hanya memakai `VITE_SUPABASE_URL` & `VITE_SUPABASE_ANON_KEY`. `service_role` key **tidak pernah** ada di kode frontend, commit, atau file konteks.
- Bucket storage privat; akses file lewat signed URL.
- No. KTP selalu tersamar di UI; tampil penuh hanya untuk HR & Direksi via RPC `lihat_ktp` (tercatat di `log_audit`).

### Frontend
- Ikuti design system dari Claude Design (warna, tipografi, badge status, komponen). Jangan membuat gaya baru.
- Setiap daftar/tabel punya state: loading (skeleton), empty, error.
- Route guard per peran hanya untuk UX — keamanan sebenarnya di RLS.
- Selfie hanya dari kamera langsung (`getUserMedia`), tanpa input galeri.
- Service worker PWA **tidak** meng-cache respons API berisi data pribadi/gaji.

## Aturan bisnis kunci (ringkas — detail di `docs/prd.md` §6)

- Jam kerja: Sen–Jum 07:00–15:00 (7 jam + 1 jam istirahat), Sab 07:00–12:00 (5 jam), Minggu & tanggal merah libur.
- Persetujuan: Karyawan → Atasan → HR. Atasan/HR → Direksi (satu tingkat).
- Lembur: diajukan sebelum lembur (hari kerja: ≤ jam pulang hari itu; hari libur: ≤ jam mulai lembur). Jam dibayar = min(aktual, disetujui). Upah sejam = gaji pokok ÷ 173 (dibulatkan ke rupiah). Pengali PP 35/2021 pola 6 hari kerja.
- Payroll: periode 26–25, label bulan = bulan tanggal 25. Draft → Diajukan → (Revisi) → Final (terkunci).
- Hari hadir = hari kerja yang punya absensi; lembur hari libur tidak menambah hari hadir.
- Cuti: jatah sama untuk semua, reset 1 Januari (sisa hangus), karyawan baru proporsional; hanya cuti yang memotong saldo.

## Struktur repo (rencana)

```
docs/                 # prd.md, security.md, spesifikasi.md
supabase/
  migrations/         # file SQL berurutan
  functions/          # Edge Functions
src/                  # aplikasi React
CLAUDE.md
```

## Data contoh untuk pengujian

Angka di desain sudah dihitung dan konsisten — gunakan sebagai kasus uji payroll:
- Rina Wulandari, gaji pokok Rp 4.800.000, payroll November 2026 → pendapatan bersih **Rp 5.891.682**; Oktober 2026 → **Rp 5.507.225**.
- Total 6 karyawan contoh November 2026 → bersih **Rp 34.747.379**.

## Keputusan yang masih terbuka

- Apakah cuti bersama memotong saldo cuti tahunan?
- Tooling frontend (router, state, UI library, testing).

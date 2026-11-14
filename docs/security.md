# Security — HRIS PT. SMP

| | |
|---|---|
| Versi | 1.0 (draft) |
| Tanggal | 12 November 2026 |
| Dokumen terkait | `prd.md`, `spesifikasi.md` |

Dokumen ini adalah acuan keamanan untuk pengembangan. **Setiap tabel, bucket, fungsi, dan halaman baru wajib mengikuti aturan di sini.**

---

## 1. Data yang dilindungi

| Kategori | Contoh | Tingkat |
|---|---|---|
| Identitas pribadi | no. KTP, tanggal lahir, alamat, status menikah, jumlah tanggungan | **Sangat sensitif** |
| Finansial | gaji pokok, slip gaji, potongan, kasbon | **Sangat sensitif** |
| Biometrik/foto | foto selfie absensi | Sensitif |
| Dokumen | lampiran surat dokter | Sensitif |
| Operasional | absensi, pengajuan, persetujuan | Internal |
| Master data | jadwal kerja, hari libur, pengaturan | Internal |

Data pribadi karyawan tunduk pada **UU No. 27 Tahun 2022 tentang Pelindungan Data Pribadi (UU PDP)**: kumpulkan seperlunya, batasi akses sesuai tujuan, dan lindungi dari kebocoran.

## 2. Ancaman utama

| Ancaman | Contoh | Mitigasi |
|---|---|---|
| Akses data antar karyawan | Karyawan melihat gaji rekan | RLS di semua tabel (§4) |
| Eskalasi peran | Karyawan mengubah `role` sendiri jadi `hr` | Kolom `role` hanya bisa diubah HR; dicek di RLS & trigger |
| Manipulasi absensi | Mengubah jam HP, absen dua kali, edit jam masuk | Jam dari `now()` server, UNIQUE per hari, karyawan tidak bisa UPDATE jam |
| Titip absen | Foto orang lain / foto dari galeri | Wajib kamera langsung (bukan upload file), foto disimpan sebagai bukti |
| Manipulasi persetujuan | Menyetujui pengajuan sendiri, lompat tingkat | Penyetuju ditentukan trigger, dicek ulang saat keputusan |
| Mengubah payroll final | Edit slip setelah disetujui Direksi | Trigger menolak UPDATE/DELETE saat status `final` |
| Kebocoran kunci | `service_role` key ikut ter-bundle di frontend | Hanya `anon` key di frontend (§6) |
| File berbahaya | Upload file .exe sebagai "lampiran" | Validasi tipe & ukuran di client dan policy storage |

---

## 3. Autentikasi

- **Supabase Auth**, email + password.
- **Tidak ada registrasi mandiri.** Akun dibuat HR (akun ber-peran HR dibuat Direksi) melalui Edge Function (memakai `service_role` di server), lalu karyawan menerima link set password.
- Matikan "Enable sign ups" di pengaturan Auth Supabase.
- Password minimal 8 karakter (atur di Auth settings).
- Aktifkan proteksi brute force / rate limit bawaan Supabase Auth.
- Sesi memakai JWT bawaan Supabase; logout menghapus sesi.
- Karyawan nonaktif (resign): kolom `pengguna.aktif = false` dan akun di-ban di Auth, bukan dihapus (riwayat tetap ada). RLS menolak semua akses untuk pengguna nonaktif.
- **2FA (TOTP)** via Supabase Auth MFA untuk HR & Direksi: opsional selama MVP, **wajib sebelum go-live**. Setelah wajib, policy untuk data sensitif mensyaratkan `auth.jwt()->>'aal' = 'aal2'` bagi peran HR & Direksi.

## 4. Otorisasi (Row Level Security)

### 4.1 Aturan umum
- **RLS wajib aktif di semua tabel** di schema `public`. Tabel tanpa RLS = bug keamanan.
- Default **tolak semua**; buka akses lewat policy eksplisit per operasi (SELECT / INSERT / UPDATE / DELETE).
- Peran dibaca dari tabel `pengguna`, bukan dari input client.

### 4.2 Fungsi helper
```sql
create or replace function public.peran_saya()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select role::text from public.pengguna where id = auth.uid();
$$;

create or replace function public.adalah_bawahan(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.pengguna
    where id = target and atasan_id = auth.uid()
  );
$$;
```
Semua fungsi `security definer` **wajib** `set search_path = ''` dan memakai nama schema lengkap.

### 4.3 Matriks akses

Keterangan: **R** baca, **C** buat, **U** ubah, **D** hapus, **sendiri** = baris miliknya, **bawahan** = baris bawahan langsung.

| Tabel | Karyawan | Atasan | HR | Direksi |
|---|---|---|---|---|
| `pengguna` | R sendiri | R sendiri + bawahan (tanpa kolom sensitif) | R/C/U semua | R semua; C/U baris ber-peran HR & ubah peran ke/dari HR |
| `absensi` | R sendiri, C sendiri, U jam keluar sendiri (via RPC) | + R bawahan | R semua, C/U koreksi (alasan wajib) | R semua |
| `pengajuan_lembur` | R/C sendiri, U → `dibatalkan` saat `menunggu` | + R bawahan | R semua | R semua |
| `pengajuan_cuti` | sama seperti lembur | + R bawahan | R semua | R semua |
| `persetujuan` | R terkait pengajuan sendiri | R/C sebagai penyetuju | R/C sebagai penyetuju | R/C sebagai penyetuju |
| `payroll` | — | — | R/C/U selama bukan `final` | R semua, U status (setujui/revisi) |
| `slip_gaji` | R sendiri jika payroll `final` | R sendiri jika `final` | R/C/U selama bukan `final` | R semua |
| `potongan` | R milik slip sendiri jika `final` | sama | R/C/U/D selama bukan `final` | R semua |
| `notifikasi` | R/U(`dibaca`) sendiri | sama | sama | sama |

> Pembuatan, pembatalan, dan keputusan pengajuan (C/U pada `pengajuan_*` & `persetujuan`) **hanya lewat RPC** `ajukan_lembur`, `ajukan_cuti`, `batalkan_pengajuan`, `putuskan_pengajuan` (security definer, memvalidasi batas waktu, saldo, tabrakan tanggal, dan penyetuju yang sah). Client tidak punya hak INSERT/UPDATE langsung; notifikasi dibuat oleh RPC tersebut.
| `jadwal_kerja`, `hari_libur`, `pengaturan` | R | R | R/C/U/D | R |
| `log_audit` | — | — | R | R |

`log_audit` hanya diisi oleh trigger (`security definer`); tidak ada policy INSERT/UPDATE/DELETE untuk siapa pun dari client.

### 4.4 Kolom sensitif
RLS bekerja per **baris**, bukan per kolom. Agar Atasan tidak melihat `no_ktp` & `gaji_pokok` bawahan:
- Buat **view** `pengguna_publik` (id, nama, nik, jabatan, atasan_id) untuk kebutuhan Atasan.
- Tabel `pengguna` penuh hanya dapat dibaca pemilik baris, HR, dan Direksi.
- Di UI, `no_ktp` **selalu tersamar**. HR & Direksi dapat menekan "Tampilkan"; nomor lengkap diambil lewat RPC `lihat_ktp(pengguna_id)` yang memeriksa peran pemanggil dan mencatat aksi `lihat_ktp` ke `log_audit` (tanpa menyimpan nomornya).

### 4.5 Aturan yang ditegakkan trigger (bukan hanya UI)
- Karyawan & Atasan tidak bisa mengubah baris `pengguna` miliknya (tanpa policy UPDATE).
- Tidak ada pengguna yang bisa mengubah `role` / `aktif` barisnya sendiri. HR boleh mengubah `gaji_pokok` & `saldo_cuti` miliknya (diawasi persetujuan payroll Direksi + `log_audit`).
- Direksi hanya boleh mengubah baris yang ber-peran HR sebelum atau sesudah perubahan (angkat / ganti / nonaktifkan HR).
- Peran `direksi` tidak bisa diberikan atau dicabut dari aplikasi; akun Direksi hanya dikelola developer.
- Clock in hanya sekali per hari (UNIQUE `pengguna_id, tanggal`); jam diisi `now()` server, nilai dari client diabaikan.
- Pengajuan lembur ditolak jika dibuat setelah batas waktu: jam pulang (hari kerja) atau jam mulai lembur (hari libur).
- Pengaju tidak bisa menjadi penyetuju pengajuannya sendiri.
- Penyetuju harus sesuai routing (§6.1 PRD) dan tingkat harus berurutan.
- Payroll / slip / potongan dengan status `final` tidak dapat di-UPDATE atau DELETE.
- Perubahan status pengajuan hanya mengikuti transisi yang sah (lihat PRD §6.6).

## 5. Storage

| Bucket | Isi | Akses |
|---|---|---|
| `selfie` | Foto clock in/out | Privat. Upload: pemilik. Baca: pemilik, atasan langsung, HR |
| `lampiran` | Surat dokter / dokumen | Privat. Upload: pemilik (folder `{uid}/`). Baca: pemilik, atasan langsung, HR; Direksi hanya untuk pengaju Atasan/HR |

- **Semua bucket privat.** Tampilkan file dengan **signed URL** berumur pendek (mis. 60 detik), jangan public URL.
- Struktur path: `{bucket}/{pengguna_id}/{tanggal}-{uuid}.{ext}` — policy mencocokkan folder pertama dengan `auth.uid()`.
- Batas file: selfie ≤ 2 MB (`image/jpeg`, `image/webp`); lampiran ≤ 5 MB (`image/*`, `application/pdf`).
- Kompres selfie di client sebelum upload.
- Kolom DB menyimpan **path**, bukan URL publik.
- **Retensi selfie 12 bulan**: job `pg_cron` bulanan menghapus file selfie berumur > 12 bulan dan mengosongkan kolom path terkait (data jam absensi tetap disimpan).
  - Implementasi: job `bersihkan-selfie` (18:00 UTC tgl 1 = 01:00 WIB tgl 2) memanggil Edge Function `bersihkan-selfie` lewat `pg_net` dengan kunci acak yang dibangkitkan di database & disimpan di **Vault** (tidak ada di repo). Fungsi mengosongkan path dulu, lalu menghapus file lewat Storage API (hapus lewat SQL tidak menghapus file).
  - Sekaligus menghapus **foto yatim** (terunggah tapi clock in gagal, tidak dirujuk absensi) berumur > 2 hari.

## 6. Kunci & konfigurasi

- Frontend hanya memakai `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY`.
- `SUPABASE_SERVICE_ROLE_KEY` **hanya** di Edge Function / server. **Tidak pernah** di kode React, tidak pernah di-commit.
- `.env*` masuk `.gitignore`; sediakan `.env.example` tanpa nilai.
- Jangan menaruh kunci di prompt AI / file konteks (CLAUDE.md, rules Cursor).

## 7. Validasi input

- Validasi di **dua sisi**: client (UX, mis. zod) dan database (constraint, CHECK, trigger). Database adalah sumber kebenaran.
- Nominal uang: `numeric(14,2)`, CHECK `>= 0`.
- Tanggal: CHECK `tanggal_selesai >= tanggal_mulai`, `jam_selesai > jam_mulai`.
- Enum PostgreSQL untuk role, status, jenis, kategori — bukan teks bebas.
- Tidak menyusun SQL dari string; pakai query builder Supabase / parameter RPC.

## 8. Fungsi database & job

- RPC (`generate_payroll`, `clock_out`, dll.) memeriksa peran pemanggil di awal fungsi.
- Gunakan `security invoker` secara default; `security definer` hanya bila perlu, dengan `search_path = ''`.
- Cabut hak eksekusi publik untuk fungsi internal: `revoke execute on function ... from public, anon;`
- Job `pg_cron` auto clock out berjalan sebagai role database, bukan dipicu dari client.

## 9. Frontend

- Route guard per peran **hanya untuk UX**; keamanan sebenarnya ada di RLS.
- Jangan menyimpan data sensitif di `localStorage` (selain sesi Supabase bawaan).
- Escape output (React default); hindari `dangerouslySetInnerHTML`.
- PDF/Excel dibuat dari data yang memang boleh dibaca pengguna tersebut (RLS sudah memfilter).
- PWA service worker **tidak** meng-cache respons API berisi data pribadi / gaji.
- Kamera: pakai `getUserMedia` langsung; jangan sediakan input file dari galeri untuk selfie.

## 10. Audit & logging

- `persetujuan` menyimpan siapa, kapan, keputusan, dan catatan.
- `payroll` menyimpan `dibuat_oleh`, `disetujui_oleh`, `disetujui_pada`.
- Tabel **`log_audit`** (MVP) diisi trigger pada INSERT/UPDATE/DELETE di `pengguna` dan `absensi`, juga perubahan status `payroll`. Kolom: `tabel`, `baris_id`, `aksi`, `nilai_lama` (jsonb), `nilai_baru` (jsonb), `oleh` (`auth.uid()`), `pada`.
- Kolom `alasan`: dikirim client lewat header `x-alasan` (base64 UTF-8) pada permintaan yang sama; **wajib** (trigger) bila gaji pokok, peran, atau atasan karyawan berubah.
- `no_ktp` tidak bisa di-SELECT dari client sama sekali (hak kolom dicabut); tampilan memakai kolom generated `no_ktp_tersamar`, nomor lengkap hanya lewat `lihat_ktp`.
- Nilai `no_ktp` di `nilai_lama`/`nilai_baru` disamarkan (mis. `3201********0001`) agar log tidak menjadi jalur kebocoran.
- Koreksi absensi oleh HR wajib mengisi `alasan_koreksi`; `dikoreksi_oleh` diisi otomatis.

## 11. Operasional

- Aktifkan backup harian Supabase (sesuai paket).
- Pisahkan project Supabase **development** dan **production**.
- Jalankan Supabase **Security Advisor** & **Performance Advisor** sebelum tiap rilis.
- Migrasi skema lewat file SQL di repo (`supabase/migrations`), bukan klik manual di dashboard production.

---

## 12. Checklist sebelum rilis

- [ ] RLS aktif di semua tabel `public` (Security Advisor tanpa peringatan)
- [ ] Uji akses per peran: karyawan A tidak bisa baca absensi / slip / profil karyawan B
- [ ] Karyawan tidak bisa mengubah `role` / `gaji_pokok` / `saldo_cuti` sendiri; tidak ada yang bisa mengubah `role` / `aktif` sendiri
- [ ] Direksi hanya bisa mengubah baris HR; peran `direksi` tidak bisa diberikan dari aplikasi
- [ ] SMTP memakai Gmail khusus aplikasi (bukan akun pribadi); app password tidak ada di repo; `site_url` & redirect URL diganti ke domain production
- [ ] Secret Edge Function `APP_ORIGINS` berisi domain production (Supabase tidak menolak `redirect_to` di luar allow-list saat undangan — fungsi `akun` yang menolaknya)
- [ ] Atasan tidak bisa membaca `no_ktp` & `gaji_pokok` bawahan
- [ ] Payroll `final` tidak bisa diubah (uji UPDATE langsung via API)
- [ ] Pengaju tidak bisa menyetujui pengajuannya sendiri
- [ ] Bucket privat, akses file hanya via signed URL
- [ ] `service_role` key tidak ada di bundle frontend (cari di hasil build)
- [ ] Sign up publik dimatikan
- [ ] Fungsi `security definer` semuanya memakai `search_path = ''`
- [ ] Backup aktif, project dev & prod terpisah
- [ ] 2FA wajib & aktif untuk semua akun HR & Direksi
- [ ] Pengguna nonaktif tidak bisa login maupun memanggil API
- [ ] `log_audit` terisi saat data karyawan / absensi diubah, dan tidak bisa diubah dari client
- [ ] Job retensi selfie 12 bulan berjalan

## 13. Keputusan keamanan

| Topik | Keputusan |
|---|---|
| Log audit | Masuk MVP (§10) |
| 2FA HR & Direksi | Opsional di MVP, wajib sebelum go-live (§3) |
| Pergantian HR | Normal: serah terima antar-HR; darurat: Direksi menjadikan karyawan HR / menonaktifkan HR (PRD EMP-08, §4.3, §4.5) |
| Edge Function `akun` | `service_role` hanya untuk Auth admin (undang, kirim ulang, ubah email); baris `pengguna` ditulis dengan token pemanggil agar RLS & log audit berlaku. Data divalidasi ulang di server sebelum email terkirim; akun Auth dihapus bila penyimpanan gagal |
| Pengirim email (undangan & reset password) | SMTP Gmail khusus aplikasi `hris.ptsmp@gmail.com` (kantor tanpa domain). App password hanya di `supabase/.env` (gitignore) & config Supabase; akun wajib 2FA, kode pemulihan disimpan aman. Link email memakai `token_hash` (dipakai saat pengguna menyimpan password, tahan pemindai link) |
| Retensi selfie | 12 bulan, dihapus otomatis (§5) |
| No. KTP | RLS + view terbatas, tanpa enkripsi tambahan (§4.4) |

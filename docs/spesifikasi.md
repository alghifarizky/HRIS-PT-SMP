# Spesifikasi — HRIS PT. SMP

Stack: **React + TypeScript (Vite, web app responsif + PWA) + Supabase (region Singapore)** (Auth, Postgres, Storage, Realtime, pg_cron). Hosting: Vercel.
Status: tahap desain selesai (UML + ERD). Berikutnya: setup Supabase.
Dokumen terkait: `prd.md`, `security.md`.

---

## 1. Aktor & hak akses

| Aktor | Mewarisi | Ringkasan akses |
|---|---|---|
| Karyawan | Pengguna | Clock in/out (selfie), riwayat absensi, ajukan lembur & cuti/sakit/izin, batalkan pengajuan (selama menunggu), lihat status, unduh slip gaji |
| Atasan | Karyawan | + Persetujuan tingkat 1 untuk pengajuan bawahan, lihat absensi tim |
| HR / Admin | Karyawan | + Persetujuan tingkat 2, kelola data karyawan, koreksi absensi, kelola master data, proses payroll, lihat & unduh semua laporan |
| Direksi | Pengguna | Tidak clock in, tidak menerima slip. Menyetujui pengajuan Atasan & HR, menyetujui payroll, lihat & unduh semua laporan, mengelola akun HR (angkat / ganti / nonaktifkan) |

**Alur persetujuan (lembur & cuti sama):**

| Pengaju | Tingkat 1 | Tingkat 2 |
|---|---|---|
| Karyawan | Atasan | HR |
| Atasan / HR | Direksi | — |

Ditolak di tingkat mana pun → status langsung ditolak.

---

## 2. Aturan bisnis

### Jadwal kerja
- 6 hari kerja, total 40 jam/minggu:
  - Senin–Jumat **07:00–15:00** (7 jam kerja + 1 jam istirahat)
  - Sabtu **07:00–12:00** (5 jam, hari kerja terpendek)
- Jam masuk & jam pulang diatur **per hari** di master data.
- Tanggal merah dikelola HR di tabel `hari_libur`.

### Absensi
- Satu kali clock in & satu kali clock out per hari, **wajib foto selfie** dari kamera langsung (disimpan di Supabase Storage, tabel menyimpan **path**).
- Jam diambil dari **server** (`now()`), bukan perangkat.
- Status **terlambat** otomatis (trigger) jika clock in > jam masuk jadwal.
- **Lupa clock out** → job `pg_cron` tengah malam mengisi jam keluar = jam pulang standar, `auto_clock_out = true`.
- **Koreksi oleh HR**: HR dapat menambah/mengubah absensi (mis. HP rusak) dengan `alasan_koreksi` wajib; tercatat di `log_audit`.
- **Retensi selfie 12 bulan**: file dihapus otomatis, data jam tetap disimpan.

### Lembur (Opsi A)
- Diajukan **sebelum lembur**. Batas: hari kerja → paling lambat **jam pulang di hari yang sama**; hari libur → paling lambat **sebelum jam mulai lembur**.
- Tidak ada clock in ulang; karyawan clock out sekali di akhir lembur.
- Jam dibayar = **min(jam aktual, jam disetujui)**.
  - Hari kerja: jam aktual = clock out − jam pulang standar.
  - Hari libur: jam aktual = clock out − clock in (seluruhnya lembur).
- Upah sejam = **1/173 × gaji pokok** (tunjangan makan/transport bukan tunjangan tetap).
- Tarif (PP 35/2021, pola 6 hari kerja):
  - Hari kerja: jam ke-1 = 1,5×, jam berikutnya 2×.
  - Hari istirahat/libur resmi: jam ke-1–7 = 2×, jam ke-8 = 3×, jam ke-9–11 = 4×.
  - Libur resmi jatuh di hari kerja terpendek (Sabtu): jam ke-1–5 = 2×, jam ke-6 = 3×, jam ke-7–9 = 4×.
- Hanya lembur berstatus disetujui yang masuk payroll.

### Cuti / sakit / izin
- Lampiran (mis. surat dokter) **opsional**.
- Jatah cuti tahunan **sama untuk semua karyawan** (di `pengaturan`).
- **Reset setiap 1 Januari**, sisa tahun sebelumnya **hangus**.
- **Karyawan baru**: jatah = jatah tahunan × (bulan penuh tersisa ÷ 12), dibulatkan ke bawah. Contoh: jatah 12, masuk 15 Maret → 9 hari.
- Hari dihitung **hari kerja saja** (Senin–Sabtu, tanpa tanggal merah).
- Hanya **cuti** yang memotong saldo; sakit & izin tidak.
- **Cuti bersama** (ditandai HR di `hari_libur` dengan `jenis = cuti_bersama`) memotong saldo 1 hari per tanggal untuk semua karyawan aktif; saldo tidak bisa minus; tanggal itu bukan hari kerja.
- Saldo dicek saat pengajuan (kurang → ditolak sistem), dan **dikurangi setelah disetujui**.
- Status pengajuan: menunggu, disetujui, ditolak, dibatalkan.

### Payroll
- Periode **26 – 25**, label bulan = bulan tanggal 25 (26 Des – 25 Jan = Januari tahun baru).
- Rumus:
  - Tunj. makan = tarif makan/hari × hari hadir (tarif diisi manual HR)
  - Tunj. transport = tarif transport/hari × hari hadir (tarif diisi manual HR)
  - **Jumlah gaji** = gaji pokok + upah lembur + tunj. makan + tunj. transport + pendapatan lain
  - **Pendapatan bersih** = jumlah gaji − total potongan
- **Hari hadir** = jumlah hari kerja (Senin–Sabtu, bukan tanggal merah) yang memiliki absensi. Lembur di hari libur tidak menambah hari hadir.
- **Pembulatan**: upah sejam dibulatkan ke rupiah terdekat; upah lembur per pengajuan = total pengali × upah sejam, dibulatkan ke rupiah terdekat.
- Pendapatan lain diisi manual HR. Potongan diisi manual dengan kategori: **alpha, terlambat, kasbon**.
- Tanpa PPh 21 & BPJS (tahap awal).
- Status: draft → diajukan → (revisi → diajukan) → **final** (dikunci).
- Nilai gaji pokok & tarif **disalin** ke slip saat dibuat (slip lama tidak berubah).
- Slip PDF dibuat di **React** (`@react-pdf/renderer`) saat diunduh; tidak dikirim email (bisa ditambah nanti via Edge Function).

### Karyawan nonaktif
- Resign → `aktif = false` sejak tanggal efektif, akun di-ban di Auth, tidak bisa login. Data & slip tetap tersimpan; HR dapat mengunduhkan bila diminta. Pengajuan berstatus Menunggu dibatalkan otomatis.
- No. KTP tampil tersamar; HR & Direksi bisa "Tampilkan" via RPC `lihat_ktp`, tercatat di `log_audit`.

### Laporan (HR & Direksi)
- Rekap absensi, lembur, dan gaji — **per bulan dan per tahun**.
- Unduh **Excel** (SheetJS) dan **PDF** (`@react-pdf/renderer`).

---

## 3. Use case diagram (PlantUML)

```plantuml
@startuml
left to right direction
actor Karyawan
actor Atasan
actor "HR / Admin" as HR
actor Direksi
Atasan --|> Karyawan
HR --|> Karyawan

rectangle "HRIS PT. SMP" {
  usecase "Login" as UC1
  usecase "Clock in" as UC2
  usecase "Clock out" as UC3
  usecase "Ambil foto selfie" as UC2a
  usecase "Lihat riwayat absensi" as UC4
  usecase "Ajukan lembur" as UC5
  usecase "Ajukan cuti/sakit/izin" as UC6
  usecase "Unggah lampiran" as UC6a
  usecase "Lihat status / batalkan pengajuan" as UC7
  usecase "Unduh slip gaji" as UC8
  usecase "Setujui lembur" as UC9
  usecase "Setujui cuti/sakit/izin" as UC10
  usecase "Lihat absensi tim" as UC11
  usecase "Kelola data karyawan" as UC12
  usecase "Koreksi absensi" as UC17
  usecase "Kelola master data" as UC13
  usecase "Proses payroll" as UC14
  usecase "Setujui payroll" as UC15
  usecase "Lihat laporan" as UC16
  usecase "Unduh laporan (Excel/PDF)" as UC16a
}
UC2 ..> UC2a : <<include>>
UC3 ..> UC2a : <<include>>
UC6a ..> UC6 : <<extend>>
UC16a ..> UC16 : <<extend>>

Karyawan -- UC1
Karyawan -- UC2
Karyawan -- UC3
Karyawan -- UC4
Karyawan -- UC5
Karyawan -- UC6
Karyawan -- UC7
Karyawan -- UC8
Atasan -- UC9
Atasan -- UC10
Atasan -- UC11
HR -- UC9
HR -- UC10
HR -- UC12
HR -- UC17
HR -- UC13
HR -- UC14
HR -- UC16
Direksi -- UC1
Direksi -- UC9
Direksi -- UC10
Direksi -- UC15
Direksi -- UC16
@enduml
```

---

## 4. Activity diagram

### 4.1 Absensi (clock in / clock out)
```mermaid
flowchart TD
  A((Mulai)) --> B[Karyawan: buka menu absensi]
  B --> C[Sistem: cek status hari ini]
  C --> D{Status?}
  D -- belum clock in --> E[Karyawan: clock in + selfie]
  D -- sudah clock in --> F[Karyawan: clock out + selfie]
  D -- sudah clock out --> G[Sistem: tampilkan info] --> Z1((Selesai))
  E --> H[Sistem: simpan waktu server & foto, cek terlambat]
  F --> H
  H --> I[Sistem: tampilkan konfirmasi] --> Z2((Selesai))
```

### 4.2 Pengajuan lembur
```mermaid
flowchart TD
  A((Mulai)) --> B[Pengaju: isi form lembur - tanggal, jam, alasan]
  B --> C[Sistem: validasi batas jam pulang, simpan status menunggu]
  C --> D[Sistem: tentukan penyetuju sesuai role]
  D --> E[Atasan/Direksi: tinjau tingkat 1]
  E --> F{Keputusan}
  F -- tolak --> J[Sistem: update status + notifikasi]
  F -- setuju --> G{Pengaju?}
  G -- karyawan --> H[HR: tinjau tingkat 2] --> J
  G -- atasan / HR --> J
  J --> K[Pengaju: lihat status] --> Z((Selesai))
```

### 4.3 Pengajuan cuti / sakit / izin
```mermaid
flowchart TD
  A((Mulai)) --> B[Pengaju: isi form - jenis, tanggal, lampiran opsional]
  B --> C[Sistem: validasi form, hitung hari kerja]
  C --> D{Jenis?}
  D -- cuti --> E[Sistem: cek saldo cuti]
  E --> F{Saldo cukup?}
  F -- tidak --> X[Pengaju: pesan saldo tidak cukup] --> Z1((Selesai))
  F -- ya --> G[Sistem: simpan status menunggu]
  D -- sakit / izin --> G
  G --> H[Penyetuju: proses persetujuan - sama seperti lembur]
  H --> I{Cuti disetujui?}
  I -- ya --> J[Sistem: kurangi saldo cuti] --> K
  I -- lainnya --> K[Sistem: update status + notifikasi]
  K --> L[Pengaju: lihat status] --> Z2((Selesai))
```

### 4.4 Payroll
```mermaid
flowchart TD
  A((Mulai)) --> B[HR: pilih periode 26-25, buat payroll]
  B --> C[Sistem: rekap hari hadir & lembur disetujui]
  C --> D[HR: input tarif tunjangan, pendapatan lain, potongan]
  D --> E[Sistem: hitung gaji, status draft]
  E --> F[HR: ajukan ke Direksi]
  F --> G[Direksi: tinjau payroll]
  G --> H{Keputusan}
  H -- revisi --> D
  H -- setuju --> I[Sistem: status final, kunci, notifikasi slip terbit]
  I --> J[Karyawan: unduh slip gaji PDF] --> Z((Selesai))
```

---

## 5. Sequence diagram

### 5.1 Clock in
```mermaid
sequenceDiagram
  actor K as Karyawan
  participant UI as Aplikasi React
  participant ST as Supabase Storage
  participant DB as Supabase DB
  K->>UI: buka menu absensi
  UI->>DB: cek absensi hari ini
  DB-->>UI: data kosong
  UI-->>K: tampilkan tombol clock in
  K->>UI: klik + ambil selfie
  UI->>ST: upload foto
  ST-->>UI: path foto
  UI->>DB: insert absensi (jam = now())
  DB->>DB: trigger cek terlambat
  DB-->>UI: data tersimpan
  UI-->>K: tampilkan konfirmasi
```
Clock out sama, dengan *update* jam keluar. Auto clock out dijalankan `pg_cron` tiap tengah malam.

### 5.2 Pengajuan & persetujuan lembur
```mermaid
sequenceDiagram
  actor P as Pengaju
  actor A as Penyetuju
  participant UI as Aplikasi React
  participant DB as Supabase DB
  P->>UI: isi form lembur
  UI->>DB: insert pengajuan
  DB->>DB: trigger validasi & tentukan penyetuju
  DB-->>UI: tersimpan (menunggu)
  UI-->>P: konfirmasi
  UI-->>A: notifikasi (Realtime)
  A->>UI: setujui / tolak
  UI->>DB: update status tingkat 1
  opt pengaju = karyawan
    A->>UI: HR setujui / tolak
    UI->>DB: update status tingkat 2
  end
  DB-->>UI: status final
  UI-->>P: notifikasi hasil
```

### 5.3 Pengajuan cuti / sakit / izin
```mermaid
sequenceDiagram
  actor P as Pengaju
  participant UI as Aplikasi React
  participant ST as Supabase Storage
  participant DB as Supabase DB
  P->>UI: isi form pengajuan
  opt ada lampiran
    UI->>ST: upload lampiran
    ST-->>UI: path lampiran
  end
  UI->>DB: insert pengajuan
  DB->>DB: trigger hitung hari kerja & cek saldo
  alt saldo cukup / sakit / izin
    DB-->>UI: tersimpan (menunggu)
  else saldo tidak cukup
    DB-->>UI: error saldo kurang
  end
  Note over P,DB: ref Persetujuan (sama seperti lembur)
  DB->>DB: trigger kurangi saldo (jika cuti disetujui)
  DB-->>UI: status final
  UI-->>P: notifikasi hasil
```

### 5.4 Payroll
```mermaid
sequenceDiagram
  actor HR
  actor D as Direksi
  actor K as Karyawan
  participant UI as Aplikasi React
  participant DB as Supabase DB
  HR->>UI: pilih periode 26-25
  UI->>DB: generate payroll (RPC)
  DB->>DB: rekap kehadiran & hitung lembur
  DB-->>UI: draft payroll
  UI-->>HR: tampilkan draft
  HR->>UI: input komponen
  UI->>DB: update & hitung ulang
  HR->>UI: ajukan ke Direksi
  UI->>DB: status diajukan
  UI-->>D: notifikasi
  alt setuju
    D->>UI: setujui
    UI->>DB: status final + kunci
  else revisi
    D->>UI: minta revisi + catatan
    UI->>DB: status revisi
  end
  UI-->>K: notifikasi slip terbit
  K->>UI: unduh slip
  UI->>DB: ambil data slip
  DB-->>UI: data slip
  UI->>UI: generate PDF
  UI-->>K: file PDF
```

---

## 6. Class diagram
```mermaid
classDiagram
class Pengguna {
  +UUID id
  +String nama
  +String email
  +Role role
  +bool aktif
  +login()
  +logout()
}
class Karyawan {
  +String nik
  +String jabatan
  +Date tanggalLahir
  +String alamat
  +Date tanggalMasuk
  +String noKtp
  +StatusMenikah statusMenikah
  +int jumlahTanggungan
  +decimal gajiPokok
  +int saldoCuti
  +clockIn(foto)
  +clockOut(foto)
  +lihatRiwayatAbsensi()
  +unduhSlip(periode)
}
class Atasan {
  +lihatAbsensiTim()
}
class HR {
  +kelolaKaryawan()
  +koreksiAbsensi(alasan)
  +kelolaMasterData()
  +prosesPayroll(periode)
  +lihatLaporan()
  +unduhLaporan(format)
}
class Direksi {
  +setujuiPayroll()
  +lihatLaporan()
  +unduhLaporan(format)
}
class Absensi {
  +UUID id
  +Date tanggal
  +DateTime jamMasuk
  +DateTime jamKeluar
  +String fotoMasukPath
  +String fotoKeluarPath
  +bool terlambat
  +bool autoClockOut
  +String alasanKoreksi
  +hitungJamKerja()
}
class Pengajuan {
  <<abstract>>
  +UUID id
  +Status status
  +DateTime diajukanPada
  +ajukan()
  +batalkan()
}
class PengajuanLembur {
  +Date tanggal
  +Time jamMulai
  +Time jamSelesai
  +String alasan
  +bool hariLibur
  +hitungJamDibayar()
}
class PengajuanCuti {
  +JenisCuti jenis
  +Date tanggalMulai
  +Date tanggalSelesai
  +int jumlahHari
  +String alasan
  +String lampiranPath
  +cekSaldo()
}
class Persetujuan {
  +UUID id
  +int tingkat
  +Keputusan keputusan
  +String catatan
  +DateTime diputuskanPada
}
class Payroll {
  +UUID id
  +int bulan
  +int tahun
  +Date periodeMulai
  +Date periodeSelesai
  +StatusPayroll status
  +String catatanRevisi
  +generate()
  +ajukan()
  +setujui()
  +mintaRevisi(catatan)
}
class SlipGaji {
  +UUID id
  +int hariHadir
  +decimal gajiPokok
  +decimal jamLembur
  +decimal upahLembur
  +decimal tarifMakan
  +decimal tunjMakan
  +decimal tarifTransport
  +decimal tunjTransport
  +decimal pendapatanLain
  +decimal jumlahGaji
  +decimal totalPotongan
  +decimal pendapatanBersih
  +hitung()
  +unduhPdf()
}
class Potongan {
  +UUID id
  +KategoriPotongan kategori
  +decimal nominal
  +String keterangan
}
class LogAudit {
  +UUID id
  +String tabel
  +UUID barisId
  +String aksi
  +json nilaiLama
  +json nilaiBaru
  +DateTime pada
}
class JadwalKerja {
  +int hari
  +Time jamMasuk
  +Time jamPulang
}
class HariLibur {
  +Date tanggal
  +String keterangan
}
class Pengaturan {
  +int jatahCutiTahunan
  +int tanggalCutOff
}
Pengguna <|-- Karyawan
Pengguna <|-- Direksi
Karyawan <|-- Atasan
Karyawan <|-- HR
Atasan "1" --> "*" Karyawan : membawahi
Karyawan "1" --> "*" Absensi : mencatat
HR "1" --> "*" Absensi : mengoreksi
Karyawan "1" --> "*" Pengajuan : mengajukan
Pengajuan <|-- PengajuanLembur
Pengajuan <|-- PengajuanCuti
Pengajuan "1" *-- "1..2" Persetujuan : memiliki
Pengguna "1" --> "*" Persetujuan : memutuskan
HR "1" --> "*" Payroll : memproses
Payroll "1" *-- "*" SlipGaji : berisi
Karyawan "1" --> "*" SlipGaji : menerima
SlipGaji "1" *-- "*" Potongan : memiliki
Pengguna "1" --> "*" LogAudit : melakukan
Absensi ..> JadwalKerja : acuan
PengajuanCuti ..> HariLibur : acuan
SlipGaji ..> Pengaturan : acuan
```

---

## 7. ERD (nama tabel & kolom Bahasa Indonesia)
```mermaid
erDiagram
  pengguna ||--o{ pengguna : membawahi
  pengguna ||--o{ absensi : mencatat
  pengguna ||--o{ absensi : mengoreksi
  pengguna ||--o{ pengajuan_lembur : mengajukan
  pengguna ||--o{ pengajuan_cuti : mengajukan
  pengajuan_lembur ||--o{ persetujuan : memiliki
  pengajuan_cuti ||--o{ persetujuan : memiliki
  pengguna ||--o{ persetujuan : memutuskan
  pengguna ||--o{ payroll : memproses
  payroll ||--o{ slip_gaji : berisi
  pengguna ||--o{ slip_gaji : menerima
  slip_gaji ||--o{ potongan : memiliki
  pengguna ||--o{ notifikasi : menerima
  pengguna ||--o{ log_audit : melakukan
  pengguna {
    uuid id PK "FK auth.users"
    text nama
    text email UK
    enum role "karyawan, atasan, hr, direksi"
    bool aktif
    uuid atasan_id FK
    text nik UK
    text jabatan
    date tanggal_lahir
    text alamat
    date tanggal_masuk
    text no_ktp
    enum status_menikah "belum_menikah, menikah"
    int jumlah_tanggungan
    numeric gaji_pokok
    int saldo_cuti
  }
  absensi {
    uuid id PK
    uuid pengguna_id FK
    date tanggal
    timestamptz jam_masuk
    timestamptz jam_keluar
    text foto_masuk_path
    text foto_keluar_path
    bool terlambat
    bool auto_clock_out
    uuid dikoreksi_oleh FK
    text alasan_koreksi
    timestamptz jam_masuk_semula "sebelum koreksi pertama (trigger)"
    timestamptz jam_keluar_semula "sebelum koreksi pertama (trigger)"
    timestamptz dikoreksi_pada "trigger"
    text dikoreksi_oleh_nama "salinan nama HR (trigger)"
  }
  pengajuan_lembur {
    uuid id PK
    uuid pengguna_id FK
    date tanggal
    time jam_mulai
    time jam_selesai
    text alasan
    bool hari_libur
    enum status
    timestamptz diajukan_pada
  }
  pengajuan_cuti {
    uuid id PK
    uuid pengguna_id FK
    enum jenis "cuti, sakit, izin"
    date tanggal_mulai
    date tanggal_selesai
    int jumlah_hari
    text alasan
    text lampiran_path
    enum status
    timestamptz diajukan_pada
  }
  persetujuan {
    uuid id PK
    uuid pengajuan_lembur_id FK
    uuid pengajuan_cuti_id FK
    uuid penyetuju_id FK
    int tingkat
    enum keputusan
    text catatan
    timestamptz diputuskan_pada
  }
  payroll {
    uuid id PK
    int bulan
    int tahun
    date periode_mulai
    date periode_selesai
    enum status "draft, diajukan, revisi, final"
    text catatan_revisi
    uuid dibuat_oleh FK
    uuid disetujui_oleh FK
    timestamptz disetujui_pada
  }
  slip_gaji {
    uuid id PK
    uuid payroll_id FK
    uuid pengguna_id FK
    int hari_hadir
    numeric gaji_pokok
    numeric jam_lembur
    numeric upah_lembur
    numeric tarif_makan
    numeric tunj_makan
    numeric tarif_transport
    numeric tunj_transport
    numeric pendapatan_lain
    numeric jumlah_gaji
    numeric total_potongan
    numeric pendapatan_bersih
  }
  potongan {
    uuid id PK
    uuid slip_gaji_id FK
    enum kategori "alpha, terlambat, kasbon"
    numeric nominal
    text keterangan
  }
  notifikasi {
    uuid id PK
    uuid pengguna_id FK
    text judul
    text pesan
    bool dibaca
    timestamptz dibuat_pada
  }
  log_audit {
    uuid id PK
    text tabel
    text baris_id "kunci baris (uuid / tanggal / hari)"
    enum aksi "insert, update, delete, lihat_ktp"
    jsonb nilai_lama
    jsonb nilai_baru
    text alasan "wajib bila gaji/peran/atasan pengguna berubah"
    uuid oleh FK
    timestamptz pada
  }
  jadwal_kerja {
    int hari PK "1 Senin - 6 Sabtu"
    time jam_masuk
    time jam_pulang
  }
  hari_libur {
    date tanggal PK
    enum jenis "libur_nasional, cuti_bersama"
    text keterangan
  }
  pengaturan {
    int id PK
    int jatah_cuti_tahunan
    int tanggal_cut_off
  }
```

### Constraint penting
- `absensi`: UNIQUE (`pengguna_id`, `tanggal`); jika `dikoreksi_oleh` terisi maka `alasan_koreksi` wajib (CHECK)
- `payroll`: UNIQUE (`bulan`, `tahun`)
- `slip_gaji`: UNIQUE (`payroll_id`, `pengguna_id`)
- `persetujuan`: CHECK tepat satu dari `pengajuan_lembur_id` / `pengajuan_cuti_id` terisi
- `payroll` berstatus `final` tidak bisa di-update (dikunci via trigger)
- `log_audit`: hanya diisi trigger, tidak bisa diubah dari client
- Nominal uang: `numeric(14,2)` dengan CHECK `>= 0`

---

## 8. Catatan teknis Supabase
- **Trigger DB**: cek terlambat, validasi batas waktu lembur, routing penyetuju, hitung hari kerja & cek saldo, kurangi saldo saat cuti disetujui, hitung ulang slip saat komponen berubah, isi `log_audit` (pengguna, absensi, status payroll), kunci payroll final.
- **RPC**: `generate_payroll(bulan, tahun)`, `clock_in`, `clock_out`.
- **pg_cron**:
  - auto clock out — setiap tengah malam
  - reset saldo cuti — setiap 1 Januari
  - hapus selfie > 12 bulan — setiap bulan
  - potong saldo cuti bersama — harian, untuk tanggal cuti bersama hari itu
- **Storage**: bucket `selfie` & `lampiran` (privat, signed URL).
- **Realtime**: notifikasi pengajuan, persetujuan, slip terbit.
- **Auth**: tanpa sign up publik; akun dibuat HR via Edge Function (akun HR dibuat Direksi); MFA (TOTP) HR & Direksi.
- **RLS**: lihat `security.md`.
- **Frontend export**: slip & laporan PDF via `@react-pdf/renderer`, laporan Excel via SheetJS.

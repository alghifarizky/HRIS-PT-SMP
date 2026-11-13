-- Fase 2 langkah 2.4c: No. KTP lengkap HANYA lewat RPC lihat_ktp (security §4.4, PRD EMP-06).
-- Sebelumnya RLS memberi HR/Direksi/pemilik baris SELECT seluruh kolom, termasuk no_ktp — nomor lengkap bisa
-- terbaca lewat API tanpa tercatat di log audit. Kini kolom no_ktp tidak bisa di-SELECT dari client;
-- INSERT/UPDATE tetap boleh (HR mengisi/mengubah). Tampilan memakai kolom generated no_ktp_tersamar.

alter table public.pengguna
  add column no_ktp_tersamar text generated always as (public.samarkan_ktp(no_ktp)) stored;

revoke select on public.pengguna from authenticated;
grant select (
  id, nama, email, role, aktif, atasan_id, nik, jabatan, tanggal_lahir, alamat, tanggal_masuk,
  status_menikah, jumlah_tanggungan, gaji_pokok, saldo_cuti, no_ktp_tersamar
) on public.pengguna to authenticated;

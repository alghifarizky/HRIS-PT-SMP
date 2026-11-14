-- Uji ringkasan koreksi absensi untuk karyawan (Semula, dikoreksi oleh/pada). Jalankan: npx supabase test db
begin;
select plan(10);
alter table public.pengguna alter column tanggal_masuk set default '2020-01-01';

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'hr@smp.test'),
  ('00000000-0000-0000-0000-0000000000b1', 'budi@smp.test'),
  ('00000000-0000-0000-0000-0000000000c1', 'rina@smp.test');
insert into public.pengguna (id, nama, email, role, nik, gaji_pokok, jabatan) values
  ('00000000-0000-0000-0000-0000000000a1', 'Dewi Lestari', 'hr@smp.test', 'hr', 'N-1', 5000000, 'HR'),
  ('00000000-0000-0000-0000-0000000000b1', 'Budi', 'budi@smp.test', 'atasan', 'N-2', 5000000, 'Kepala');
insert into public.pengguna (id, nama, email, role, atasan_id, nik, gaji_pokok, jabatan) values
  ('00000000-0000-0000-0000-0000000000c1', 'Rina', 'rina@smp.test', 'karyawan', '00000000-0000-0000-0000-0000000000b1', 'N-3', 4800000, 'Staf');
-- Absensi asli (seolah dari RPC; auth.uid() kosong = bukan koreksi)
insert into public.absensi (pengguna_id, tanggal, jam_masuk, jam_keluar, auto_clock_out, jam_masuk_semula, dikoreksi_oleh_nama)
  values ('00000000-0000-0000-0000-0000000000c1', '2026-11-05', '2026-11-05 07:21+07', '2026-11-05 15:00+07', true, '2026-01-01', 'palsu');
select is((select dikoreksi_oleh_nama from public.absensi), null, 'Nilai kolom ringkasan dari insert diabaikan');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
update public.absensi set jam_masuk = '2026-11-05 07:00+07', alasan_koreksi = 'Mengantar dokumen ke gudang Cikarang';
select results_eq($$ select jam_masuk_semula, jam_keluar_semula, dikoreksi_oleh_nama, dikoreksi_pada is not null from public.absensi $$,
  $$ values ('2026-11-05 07:21+07'::timestamptz, null::timestamptz, 'Dewi Lestari (HR)', true) $$, 'Koreksi pertama jam masuk: semula & pelaku tersimpan');
update public.absensi set jam_masuk = '2026-11-05 06:55+07', jam_keluar = '2026-11-05 15:02+07', alasan_koreksi = 'Koreksi kedua';
select results_eq($$ select jam_masuk_semula, jam_keluar_semula, auto_clock_out from public.absensi $$,
  $$ values ('2026-11-05 07:21+07'::timestamptz, '2026-11-05 15:00+07'::timestamptz, false) $$,
  'Semula jam masuk tetap dari koreksi pertama; semula jam keluar = hasil auto clock out');
select lives_ok($$ update public.absensi set jam_masuk_semula = '2026-11-05 09:00+07', alasan_koreksi = 'Mencoba menimpa semula' $$,
  'Update berisi kolom semula diterima, tetapi nilai semula dikembalikan trigger (diuji berikutnya)');
reset role;
select is((select jam_masuk_semula from public.absensi), '2026-11-05 07:21+07'::timestamptz, 'Kolom semula tidak bisa ditimpa client');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select lives_ok($$ update public.absensi set jam_keluar = '2026-11-05 15:10+07', alasan_koreksi = 'Mencoba menimpa semula' $$,
  'Koreksi dengan alasan sama seperti sebelumnya diterima (perbaikan 14 Nov)');
select set_config('request.headers', '{"x-alasan":"VWppIG90b21hdGlz"}', true);
select lives_ok($$ update public.absensi set jam_keluar = '2026-11-05 15:20+07' $$, 'Alasan dari header x-alasan');
select set_config('request.headers', '', true);
reset role;
select results_eq($$ select alasan_koreksi, (select alasan from public.log_audit where tabel = 'absensi' and nilai_baru ->> 'jam_keluar' like '%08:20:00%') from public.absensi $$,
  $$ values ('Uji otomatis', 'Uji otomatis') $$, 'Alasan header tersimpan di absensi & log audit');

-- Karyawan pemilik membaca ringkasan koreksinya
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select results_eq($$ select jam_masuk_semula, dikoreksi_oleh_nama, alasan_koreksi from public.absensi $$,
  $$ values ('2026-11-05 07:21+07'::timestamptz, 'Dewi Lestari (HR)', 'Uji otomatis') $$, 'Karyawan melihat semula, nama HR & alasan');
select is((select count(*)::int from public.log_audit), 0, 'Karyawan tetap tidak membaca log audit');
reset role;

select * from finish();
rollback;

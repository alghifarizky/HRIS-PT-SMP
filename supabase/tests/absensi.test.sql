-- Uji absensi (Fase 3.1). Waktu ditentukan lewat fungsi inti catat_* agar tidak bergantung hari ini.
begin;
select plan(34);
alter table public.pengguna alter column tanggal_masuk set default '2020-01-01';

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000d', 'direksi@smp.test'),
  ('00000000-0000-0000-0000-0000000000a1', 'hr@smp.test'),
  ('00000000-0000-0000-0000-0000000000b1', 'budi@smp.test'),
  ('00000000-0000-0000-0000-0000000000c1', 'rina@smp.test'),
  ('00000000-0000-0000-0000-0000000000c2', 'dimas@smp.test'),
  ('00000000-0000-0000-0000-0000000000c3', 'yoga@smp.test');
insert into public.pengguna (id, nama, email, role, nik, gaji_pokok, jabatan) values
  ('00000000-0000-0000-0000-00000000000d', 'Hendra', 'direksi@smp.test', 'direksi', null, null, 'Direktur'),
  ('00000000-0000-0000-0000-0000000000a1', 'Dewi', 'hr@smp.test', 'hr', 'N-1', 5000000, 'HR'),
  ('00000000-0000-0000-0000-0000000000b1', 'Budi', 'budi@smp.test', 'atasan', 'N-2', 5000000, 'Kepala');
insert into public.pengguna (id, nama, email, role, atasan_id, nik, gaji_pokok, jabatan) values
  ('00000000-0000-0000-0000-0000000000c1', 'Rina', 'rina@smp.test', 'karyawan', '00000000-0000-0000-0000-0000000000b1', 'N-3', 4800000, 'Staf'),
  ('00000000-0000-0000-0000-0000000000c2', 'Dimas', 'dimas@smp.test', 'karyawan', '00000000-0000-0000-0000-0000000000b1', 'N-4', 4600000, 'Staf'),
  ('00000000-0000-0000-0000-0000000000c3', 'Yoga', 'yoga@smp.test', 'karyawan', '00000000-0000-0000-0000-0000000000b1', 'N-5', 4500000, 'Staf');

insert into public.hari_libur values ('2026-12-25', 'libur_nasional', 'Hari Raya Natal');
insert into storage.objects (bucket_id, name) values
  ('selfie', '00000000-0000-0000-0000-0000000000c1/2026-11-12-a.jpg'),
  ('selfie', '00000000-0000-0000-0000-0000000000c1/2026-11-12-b.jpg'),
  ('selfie', '00000000-0000-0000-0000-0000000000c2/2026-11-12-a.jpg'),
  ('selfie', '00000000-0000-0000-0000-0000000000c3/2026-11-11-a.jpg'),
  ('selfie', '00000000-0000-0000-0000-0000000000c3/2026-11-07-a.jpg'),
  ('selfie', '00000000-0000-0000-0000-0000000000a1/2026-11-12-a.jpg'),
  ('selfie', '00000000-0000-0000-0000-00000000000d/2026-11-12-a.jpg');

select ok((select relrowsecurity from pg_class where oid = 'public.absensi'::regclass), 'RLS aktif di absensi');
select is((select public from storage.buckets where id = 'selfie'), false, 'Bucket selfie privat');

-- Clock in & batas terlambat (Kam 12 Nov, jadwal 07:00, toleransi 5 menit)
select is((public.catat_clock_in('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000c1/2026-11-12-a.jpg', '2026-11-12 07:05:59+07')).terlambat,
  false, '07:05:59 masih tepat waktu');
select is((public.catat_clock_in('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000c2/2026-11-12-a.jpg', '2026-11-12 07:06:00+07')).terlambat,
  true, '07:06 terlambat');
select throws_ok($$ select public.catat_clock_in('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000c1/2026-11-12-b.jpg', '2026-11-12 08:00+07') $$,
  '23505', 'Anda sudah clock in hari ini', 'Clock in kedua ditolak');
select throws_ok($$ select public.catat_clock_in('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000c1/2026-11-12-b.jpg', '2026-11-15 07:00+07') $$,
  '23514', 'Hari ini libur — tidak perlu clock in', 'Minggu ditolak');
select throws_ok($$ select public.catat_clock_in('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000c1/2026-11-12-b.jpg', '2026-12-25 07:00+07') $$,
  '23514', 'Hari ini libur — tidak perlu clock in', 'Tanggal merah ditolak');
select throws_ok($$ select public.catat_clock_in('00000000-0000-0000-0000-0000000000c3', '00000000-0000-0000-0000-0000000000c3/tidak-ada.jpg', '2026-11-12 07:00+07') $$,
  '23514', 'Foto selfie tidak ditemukan. Ambil foto lagi.', 'Foto yang tidak ada ditolak');
select throws_ok($$ select public.catat_clock_in('00000000-0000-0000-0000-0000000000c3', '00000000-0000-0000-0000-0000000000c1/2026-11-12-b.jpg', '2026-11-12 07:00+07') $$,
  '23514', null, 'Foto milik orang lain ditolak');
select throws_ok($$ select public.catat_clock_in('00000000-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-00000000000d/2026-11-12-a.jpg', '2026-11-12 07:00+07') $$,
  '42501', 'Direksi tidak mengikuti absensi', 'Direksi tidak absen');

-- Clock out
select is((public.catat_clock_out('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000c1/2026-11-12-b.jpg', '2026-11-12 14:55+07')).jam_keluar,
  '2026-11-12 14:55+07'::timestamptz, 'Clock out (lebih cepat boleh)');
select throws_ok($$ select public.catat_clock_out('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000c1/2026-11-12-b.jpg', '2026-11-12 15:30+07') $$,
  '23505', 'Anda sudah clock out hari ini', 'Clock out kedua ditolak');
select throws_ok($$ select public.catat_clock_out('00000000-0000-0000-0000-0000000000c3', '00000000-0000-0000-0000-0000000000c3/2026-11-11-a.jpg', '2026-11-12 15:00+07') $$,
  '23514', 'Belum clock in hari ini', 'Clock out tanpa clock in ditolak');

-- Auto clock out (lupa clock out): Rab 11 Nov → 15:00, Sab 7 Nov → 12:00
select ok((public.catat_clock_in('00000000-0000-0000-0000-0000000000c3', '00000000-0000-0000-0000-0000000000c3/2026-11-11-a.jpg', '2026-11-11 06:50+07')).id is not null, 'Yoga clock in Rabu');
insert into public.absensi (pengguna_id, tanggal, jam_masuk, foto_masuk_path)
  values ('00000000-0000-0000-0000-0000000000c3', '2026-11-07', '2026-11-07 06:55+07', '00000000-0000-0000-0000-0000000000c3/2026-11-07-a.jpg');
select is(public.proses_auto_clock_out(), 3, 'Job menutup 3 absensi tanpa clock out (Yoga Rab & Sab, Dimas Kam)');
select results_eq($$ select tanggal, jam_keluar, auto_clock_out from public.absensi where pengguna_id = '00000000-0000-0000-0000-0000000000c3' order by tanggal $$,
  $$ values ('2026-11-07'::date, '2026-11-07 12:00+07'::timestamptz, true), ('2026-11-11'::date, '2026-11-11 15:00+07'::timestamptz, true) $$,
  'Jam keluar = jam pulang jadwal hari itu');

-- RLS baca
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select is((select count(*)::int from public.absensi), 1, 'Karyawan hanya membaca absensinya sendiri');
select throws_ok($$ insert into public.absensi (pengguna_id, tanggal, jam_masuk, jam_keluar, alasan_koreksi)
  values ('00000000-0000-0000-0000-0000000000c1', '2026-11-13', '2026-11-13 07:00+07', '2026-11-13 15:00+07', 'x') $$, '42501', null, 'Karyawan tidak bisa insert langsung');
select throws_ok($$ select public.catat_clock_in('00000000-0000-0000-0000-0000000000c1', 'x', now()) $$, '42501', null, 'Fungsi inti tidak bisa dipanggil client');
select is((select count(*)::int from storage.objects where bucket_id = 'selfie'), 2, 'Karyawan hanya melihat selfie sendiri');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select is((select count(*)::int from public.absensi), 4, 'Atasan membaca absensi bawahan');
select is((select count(*)::int from storage.objects where bucket_id = 'selfie'), 5, 'Atasan melihat selfie bawahan');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select is((select count(*)::int from public.absensi), 4, 'Direksi membaca semua absensi');
select is((select count(*)::int from storage.objects where bucket_id = 'selfie' and name not like '00000000-0000-0000-0000-00000000000d/%'), 0,
  'Direksi tidak melihat selfie karyawan (security §5)');

-- Koreksi HR
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select is((select count(*)::int from storage.objects where bucket_id = 'selfie'), 7, 'HR melihat semua selfie');
select throws_ok($$ update public.absensi set jam_masuk = '2026-11-12 07:00+07' where pengguna_id = '00000000-0000-0000-0000-0000000000c2' $$,
  '23514', 'Alasan koreksi wajib diisi', 'Koreksi tanpa alasan ditolak');
select lives_ok($$ update public.absensi set jam_masuk = '2026-11-12 07:00+07', jam_keluar = '2026-11-12 16:10+07', alasan_koreksi = 'Mengantar dokumen'
  where pengguna_id = '00000000-0000-0000-0000-0000000000c2' $$, 'Koreksi dengan alasan');
select results_eq($$ select terlambat, auto_clock_out, dikoreksi_oleh::text from public.absensi where pengguna_id = '00000000-0000-0000-0000-0000000000c2' $$,
  $$ values (false, false, '00000000-0000-0000-0000-0000000000a1') $$, 'Terlambat dihitung ulang, auto clock out hilang, dikoreksi_oleh = HR');
select throws_ok($$ insert into public.absensi (pengguna_id, tanggal, jam_masuk, alasan_koreksi)
  values ('00000000-0000-0000-0000-0000000000c1', '2026-11-13', '2026-11-13 07:00+07', 'HP rusak') $$, '23514', null, 'Manual tanpa jam keluar ditolak');
select lives_ok($$ insert into public.absensi (pengguna_id, tanggal, jam_masuk, jam_keluar, alasan_koreksi)
  values ('00000000-0000-0000-0000-0000000000c1', '2026-11-13', '2026-11-13 07:20+07', '2026-11-13 15:00+07', 'HP rusak') $$, 'HR menambah absensi manual');
select is((select terlambat from public.absensi where pengguna_id = '00000000-0000-0000-0000-0000000000c1' and tanggal = '2026-11-13'), true, 'Manual 07:20 terlambat');
reset role;

-- HR absen untuk dirinya lewat RPC → bukan koreksi
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select is((public.catat_clock_in('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a1/2026-11-12-a.jpg', '2026-11-12 06:58+07')).dikoreksi_oleh,
  null, 'Clock in HR sendiri tidak tercatat sebagai koreksi');
select is((select count(*)::int from cron.job where jobname = 'auto-clock-out' and schedule = '10 17 * * *'), 1, 'Job auto clock out 00:10 WIB');
update public.pengguna set tanggal_masuk = '2026-11-16' where nama = 'Dimas';
select throws_ok($$ select public.catat_clock_in('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000c2/2026-11-12-a.jpg', '2026-11-13 07:00+07') $$,
  '23514', 'Anda baru bisa clock in mulai 16 Nov 2026', 'Clock in sebelum tanggal masuk ditolak');

select * from finish();
rollback;

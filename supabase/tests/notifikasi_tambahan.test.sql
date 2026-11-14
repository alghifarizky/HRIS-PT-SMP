-- Uji notifikasi tambahan (Fase 4.5b): auto clock out, koreksi HR, pengajuan dibatalkan.
begin;
select plan(7);
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

select is(public.label_tanggal('2026-11-06'), 'Jumat, 6 Nov 2026', 'Label tanggal Indonesia');

-- Absensi asli tanpa clock out, lalu job malam mengisi auto clock out
insert into public.absensi (pengguna_id, tanggal, jam_masuk) values ('00000000-0000-0000-0000-0000000000c1', '2026-11-06', '2026-11-06 07:02+07');
select is((select count(*)::int from public.notifikasi), 0, 'Clock in biasa tidak membuat notifikasi');
update public.absensi set jam_keluar = '2026-11-06 15:00+07', auto_clock_out = true;
select is((select pesan from public.notifikasi where judul = 'Auto clock out tercatat'),
  'Anda belum clock out pada Jumat, 6 Nov. Jam keluar diisi otomatis 15:00 WIB sesuai jam pulang.', 'Auto clock out dikabarkan');

-- Koreksi HR
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
update public.absensi set jam_masuk = '2026-11-06 07:00+07', alasan_koreksi = 'Mesin absen telat';
reset role;
select is((select pesan from public.notifikasi where judul = 'Absensi dikoreksi HR'),
  'Jam masuk Jumat, 6 Nov dikoreksi menjadi 07:00 WIB.', 'Koreksi HR dikabarkan ke karyawan');
select is((select count(*)::int from public.notifikasi where pengguna_id = '00000000-0000-0000-0000-0000000000c1'), 2, 'Koreksi tidak memicu notifikasi auto clock out lagi');

-- Pengajuan dibatalkan → atasan dikabari
select public.catat_ajukan_cuti('00000000-0000-0000-0000-0000000000c1', 'izin', '2026-11-30', '2026-11-30', 'Keluarga', null, '2026-11-12 10:00+07');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select lives_ok($$ select public.batalkan_pengajuan('cuti', (select id from public.pengajuan_cuti limit 1)) $$, 'Pengaju membatalkan');
reset role;
select is((select pesan from public.notifikasi where judul = 'Pengajuan dibatalkan' and pengguna_id = '00000000-0000-0000-0000-0000000000b1'),
  'Pengajuan izin Rina (Senin, 30 Nov 2026) dibatalkan oleh pengaju.', 'Atasan dikabari pembatalan');

select * from finish();
rollback;

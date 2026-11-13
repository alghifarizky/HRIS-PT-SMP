-- Uji aturan atasan & perubahan peran (2.4c). Jalankan: npx supabase test db
begin;
select plan(11);
alter table public.pengguna alter column tanggal_masuk set default '2020-01-01';

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000d', 'direksi@smp.test'),
  ('00000000-0000-0000-0000-0000000000a1', 'hr@smp.test'),
  ('00000000-0000-0000-0000-0000000000b1', 'budi@smp.test'),
  ('00000000-0000-0000-0000-0000000000b2', 'agus@smp.test'),
  ('00000000-0000-0000-0000-0000000000c1', 'rina@smp.test'),
  ('00000000-0000-0000-0000-0000000000c2', 'dimas@smp.test');
insert into public.pengguna (id, nama, email, role, atasan_id, nik, gaji_pokok, jabatan) values
  ('00000000-0000-0000-0000-00000000000d', 'Hendra', 'direksi@smp.test', 'direksi', null, null, null, 'Direktur'),
  ('00000000-0000-0000-0000-0000000000a1', 'Dewi', 'hr@smp.test', 'hr', null, 'N-1', 5000000, 'HR'),
  ('00000000-0000-0000-0000-0000000000b1', 'Budi', 'budi@smp.test', 'atasan', null, 'N-2', 5000000, 'Kepala IT'),
  ('00000000-0000-0000-0000-0000000000b2', 'Agus', 'agus@smp.test', 'atasan', null, 'N-3', 5000000, 'Kepala Gudang');
insert into public.pengguna (id, nama, email, role, atasan_id, nik, gaji_pokok, jabatan) values
  ('00000000-0000-0000-0000-0000000000c1', 'Rina', 'rina@smp.test', 'karyawan', '00000000-0000-0000-0000-0000000000b1', 'N-4', 4800000, 'Staf');

-- Atasan langsung Karyawan harus Atasan aktif
select throws_ok($$ insert into public.pengguna (id, nama, email, role, atasan_id, nik, gaji_pokok, jabatan)
  values ('00000000-0000-0000-0000-0000000000c2', 'Dimas', 'dimas@smp.test', 'karyawan', '00000000-0000-0000-0000-0000000000a1', 'N-5', 1, 'Staf') $$,
  '23514', 'Atasan langsung harus pengguna aktif berperan Atasan', 'Atasan langsung tidak boleh HR');
select throws_ok($$ update public.pengguna set atasan_id = '00000000-0000-0000-0000-00000000000d' where id = '00000000-0000-0000-0000-0000000000c1' $$,
  '23514', null, 'Atasan langsung tidak boleh Direksi');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);

-- Pindah jabatan & pindah atasan
select lives_ok($$ update public.pengguna set jabatan = 'Kepala Keuangan' where id = '00000000-0000-0000-0000-0000000000b1' $$,
  'HR memindahkan jabatan Budi');
select lives_ok($$ update public.pengguna set atasan_id = '00000000-0000-0000-0000-0000000000b2' where id = '00000000-0000-0000-0000-0000000000c1' $$,
  'HR memindahkan Rina ke atasan Agus');

-- Budi tanpa bawahan kini boleh turun jadi Karyawan; Agus (membawahi Rina) tidak
select lives_ok($$ update public.pengguna set role = 'karyawan', atasan_id = '00000000-0000-0000-0000-0000000000b2' where id = '00000000-0000-0000-0000-0000000000b1' $$,
  'Atasan tanpa bawahan boleh menjadi Karyawan');
select throws_ok($$ update public.pengguna set role = 'karyawan', atasan_id = '00000000-0000-0000-0000-0000000000b2' where id = '00000000-0000-0000-0000-0000000000b2' $$,
  '23514', null, 'Atasan yang masih membawahi tidak bisa diturunkan');
select throws_ok($$ update public.pengguna set role = 'hr' where id = '00000000-0000-0000-0000-0000000000b2' $$,
  '23514', 'Agus masih membawahi 2 karyawan. Pindahkan dulu ke atasan lain.', 'Pesan menyebut jumlah bawahan');
select throws_ok($$ update public.pengguna set aktif = false where id = '00000000-0000-0000-0000-0000000000b2' $$,
  '23514', null, 'Atasan yang masih membawahi tidak bisa dinonaktifkan');

-- Karyawan naik menjadi Atasan
select lives_ok($$ update public.pengguna set role = 'atasan', atasan_id = null where id = '00000000-0000-0000-0000-0000000000c1' $$,
  'Karyawan naik menjadi Atasan');
select lives_ok($$ update public.pengguna set role = 'atasan', atasan_id = '00000000-0000-0000-0000-00000000000d' where id = '00000000-0000-0000-0000-0000000000b1' $$,
  'Budi kembali jadi Atasan, atasannya Direksi');
reset role;

select is((select count(*)::int from public.log_audit where tabel = 'pengguna' and aksi = 'update' and nilai_baru ? 'jabatan'), 1,
  'Pindah jabatan tercatat di log audit');

select * from finish();
rollback;

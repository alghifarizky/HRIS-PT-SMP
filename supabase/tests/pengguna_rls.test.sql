-- Uji RLS, trigger & constraint tabel pengguna. Jalankan: npx supabase test db
begin;
select plan(30);
-- Seed lama tidak mengisi tanggal_masuk (wajib sejak trigger saldo awal); default hanya di transaksi uji
alter table public.pengguna alter column tanggal_masuk set default '2020-01-01';

-- Seed (sebagai postgres, melewati RLS)
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000d', 'direksi@smp.test'),
  ('00000000-0000-0000-0000-0000000000a1', 'hr@smp.test'),
  ('00000000-0000-0000-0000-0000000000a2', 'atasan@smp.test'),
  ('00000000-0000-0000-0000-0000000000a3', 'rina@smp.test'),
  ('00000000-0000-0000-0000-0000000000a4', 'resign@smp.test'),
  ('00000000-0000-0000-0000-0000000000a5', 'hrbaru@smp.test');

insert into public.pengguna (id, nama, email, role, aktif, atasan_id, nik, gaji_pokok, saldo_cuti) values
  ('00000000-0000-0000-0000-00000000000d', 'Direksi', 'direksi@smp.test', 'direksi', true, null, null, null, null),
  ('00000000-0000-0000-0000-0000000000a1', 'HR', 'hr@smp.test', 'hr', true, null, 'N-01', 5000000, 12),
  ('00000000-0000-0000-0000-0000000000a2', 'Atasan', 'atasan@smp.test', 'atasan', true, null, 'N-02', 5500000, 12),
  ('00000000-0000-0000-0000-0000000000a3', 'Rina Wulandari', 'rina@smp.test', 'karyawan', true,
     '00000000-0000-0000-0000-0000000000a2', 'N-03', 4800000, 12),
  ('00000000-0000-0000-0000-0000000000a4', 'Resign', 'resign@smp.test', 'karyawan', false,
     '00000000-0000-0000-0000-0000000000a2', 'N-04', 4500000, 0);

select ok((select relrowsecurity from pg_class where oid = 'public.pengguna'::regclass), 'RLS aktif di pengguna');

-- Constraint
select throws_ok($$ insert into public.pengguna (id, nama, email, role, gaji_pokok)
  values ('00000000-0000-0000-0000-0000000000a5', 'X', 'hrbaru@smp.test', 'direksi', 1) $$,
  '23514', null, 'Direksi tidak boleh punya gaji pokok');
select throws_ok($$ insert into public.pengguna (id, nama, email, role, nik, gaji_pokok, saldo_cuti)
  values ('00000000-0000-0000-0000-0000000000a5', 'X', 'hrbaru@smp.test', 'karyawan', 'N-05', 1, 1) $$,
  '23514', null, 'Karyawan wajib punya atasan');
select throws_ok($$ insert into public.pengguna (id, nama, email, role, nik, gaji_pokok, saldo_cuti, no_ktp)
  values ('00000000-0000-0000-0000-0000000000a5', 'X', 'hrbaru@smp.test', 'hr', 'N-05', 1, 1, '12345') $$,
  '23514', null, 'No. KTP wajib 16 digit');
select throws_ok($$ insert into public.pengguna (id, nama, email, role, nik, gaji_pokok, saldo_cuti)
  values ('00000000-0000-0000-0000-0000000000a5', 'X', 'hrbaru@smp.test', 'hr', 'N-05', -1, 1) $$,
  '23514', null, 'Gaji pokok tidak boleh negatif');

-- anon
set local role anon;
select throws_ok('select * from public.pengguna', '42501', null, 'anon tidak bisa membaca pengguna');
select throws_ok('select public.peran_saya()', '42501', null, 'anon tidak bisa memanggil peran_saya');
reset role;

set local role authenticated;

-- Karyawan
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}', true);
select is((select count(*)::int from public.pengguna), 1, 'Karyawan hanya melihat barisnya sendiri');
select is(public.peran_saya(), 'karyawan', 'peran_saya() = karyawan');
update public.pengguna set gaji_pokok = 9999999 where id = '00000000-0000-0000-0000-0000000000a3';
select throws_ok($$ insert into public.pengguna (id, nama, email, role, nik, gaji_pokok, saldo_cuti)
  values ('00000000-0000-0000-0000-0000000000a5', 'X', 'hrbaru@smp.test', 'hr', 'N-05', 1, 1) $$,
  '42501', null, 'Karyawan tidak bisa menambah pengguna');

-- Atasan
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}', true);
select is((select count(*)::int from public.pengguna), 1, 'Atasan hanya melihat barisnya sendiri di tabel penuh');
select ok(public.adalah_bawahan('00000000-0000-0000-0000-0000000000a3'), 'adalah_bawahan(Rina) = true untuk atasannya');

-- Karyawan nonaktif
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a4","role":"authenticated"}', true);
select is((select count(*)::int from public.pengguna), 0, 'Pengguna nonaktif tidak melihat apa pun');
select is(public.peran_saya(), null, 'peran_saya() null untuk pengguna nonaktif');

-- HR
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select is((select count(*)::int from public.pengguna), 5, 'HR melihat semua');
select lives_ok($$ update public.pengguna set gaji_pokok = 4900000 where id = '00000000-0000-0000-0000-0000000000a3' $$,
  'HR bisa mengubah gaji karyawan');
select lives_ok($$ update public.pengguna set gaji_pokok = 5200000, saldo_cuti = 10 where id = '00000000-0000-0000-0000-0000000000a1' $$,
  'HR bisa mengubah gaji & saldo sendiri');
select throws_ok($$ update public.pengguna set role = 'atasan' where id = '00000000-0000-0000-0000-0000000000a1' $$,
  '42501', null, 'HR tidak bisa mengubah perannya sendiri');
select throws_ok($$ update public.pengguna set aktif = false where id = '00000000-0000-0000-0000-0000000000a1' $$,
  '42501', null, 'HR tidak bisa menonaktifkan dirinya sendiri');
select throws_ok($$ update public.pengguna set role = 'direksi', atasan_id = null, gaji_pokok = null, saldo_cuti = null
  where id = '00000000-0000-0000-0000-0000000000a2' $$, '42501', null, 'HR tidak bisa memberi peran Direksi');
select throws_ok($$ insert into public.pengguna (id, nama, email, role)
  values ('00000000-0000-0000-0000-0000000000a5', 'X', 'hrbaru@smp.test', 'direksi') $$,
  '42501', null, 'HR tidak bisa menambah Direksi');

-- Direksi: skenario HR resign → angkat HR baru → nonaktifkan HR lama (EMP-08)
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select is((select count(*)::int from public.pengguna), 5, 'Direksi melihat semua');
select throws_ok($$ update public.pengguna set jabatan = 'diubah direksi' where id = '00000000-0000-0000-0000-0000000000a3' $$,
  '42501', null, 'Direksi tidak bisa mengubah data karyawan non-HR');
select throws_ok($$ insert into public.pengguna (id, nama, email, role, atasan_id, nik, gaji_pokok, saldo_cuti)
  values ('00000000-0000-0000-0000-0000000000a5', 'X', 'hrbaru@smp.test', 'karyawan',
          '00000000-0000-0000-0000-0000000000a2', 'N-05', 1, 1) $$,
  '42501', null, 'Direksi tidak bisa menambah karyawan non-HR');
select lives_ok($$ insert into public.pengguna (id, nama, email, role, nik, gaji_pokok, saldo_cuti)
  values ('00000000-0000-0000-0000-0000000000a5', 'HR Baru', 'hrbaru@smp.test', 'hr', 'N-05', 5000000, 12) $$,
  'Direksi bisa menambah HR baru');
select lives_ok($$ update public.pengguna set aktif = false, gaji_pokok = 5100000 where id = '00000000-0000-0000-0000-0000000000a1' $$,
  'Direksi bisa menonaktifkan & mengubah data HR');
select lives_ok($$ update public.pengguna set role = 'hr', atasan_id = null where id = '00000000-0000-0000-0000-0000000000a3' $$,
  'Direksi bisa mengangkat karyawan menjadi HR');
select throws_ok($$ update public.pengguna set role = 'direksi', gaji_pokok = null, saldo_cuti = null
  where id = '00000000-0000-0000-0000-0000000000a5' $$, '42501', null, 'Direksi tidak bisa memberi peran Direksi');
select throws_ok($$ update public.pengguna set aktif = false where id = '00000000-0000-0000-0000-00000000000d' $$,
  '42501', null, 'Direksi tidak bisa menonaktifkan dirinya sendiri');
reset role;

-- Efek update yang seharusnya diabaikan/ditolak
select is((select gaji_pokok::text || '|' || coalesce(jabatan, '-') from public.pengguna
  where id = '00000000-0000-0000-0000-0000000000a3'), '4900000.00|-',
  'Data Rina hanya berubah oleh HR (update Karyawan & Direksi tidak tembus)');

select * from finish();
rollback;

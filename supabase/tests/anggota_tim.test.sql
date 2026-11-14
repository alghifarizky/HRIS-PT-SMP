-- Uji RPC anggota_tim. Jalankan: npx supabase test db
begin;
select plan(5);
alter table public.pengguna alter column tanggal_masuk set default '2020-01-01';

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000b1', 'budi@smp.test'),
  ('00000000-0000-0000-0000-0000000000b2', 'agus@smp.test'),
  ('00000000-0000-0000-0000-0000000000c1', 'rina@smp.test'),
  ('00000000-0000-0000-0000-0000000000c2', 'dimas@smp.test'),
  ('00000000-0000-0000-0000-0000000000c3', 'yoga@smp.test');
insert into public.pengguna (id, nama, email, role, nik, gaji_pokok, jabatan) values
  ('00000000-0000-0000-0000-0000000000b1', 'Budi', 'budi@smp.test', 'atasan', 'N-1', 5000000, 'Supervisor'),
  ('00000000-0000-0000-0000-0000000000b2', 'Agus', 'agus@smp.test', 'atasan', 'N-2', 5000000, 'Supervisor');
insert into public.pengguna (id, nama, email, role, atasan_id, nik, gaji_pokok, jabatan, no_ktp) values
  ('00000000-0000-0000-0000-0000000000c1', 'Rina', 'rina@smp.test', 'karyawan', '00000000-0000-0000-0000-0000000000b1', 'N-3', 4800000, 'Staf', '3201015408960001'),
  ('00000000-0000-0000-0000-0000000000c2', 'Dimas', 'dimas@smp.test', 'karyawan', '00000000-0000-0000-0000-0000000000b1', 'N-4', 4600000, 'Operator', null),
  ('00000000-0000-0000-0000-0000000000c3', 'Yoga', 'yoga@smp.test', 'karyawan', '00000000-0000-0000-0000-0000000000b2', 'N-5', 4500000, 'Staf', null);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select results_eq('select nama, jabatan from public.anggota_tim()', $$ values ('Dimas', 'Operator'), ('Rina', 'Staf') $$,
  'Atasan hanya mendapat bawahan langsungnya');
select is((select count(*)::int from public.pengguna), 1, 'Tabel pengguna tetap hanya baris sendiri bagi Atasan');
select ok((select not (proargnames && array['gaji_pokok', 'no_ktp', 'alamat', 'tanggal_lahir']) from pg_proc where proname = 'anggota_tim'),
  'RPC tidak memuat gaji, KTP, alamat, tanggal lahir');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select is((select count(*)::int from public.anggota_tim()), 0, 'Karyawan tanpa bawahan mendapat daftar kosong');
reset role;
set local role anon;
select throws_ok('select * from public.anggota_tim()', '42501', null, 'anon tidak boleh');
reset role;

select * from finish();
rollback;

-- Uji RPC info_login. Jalankan: npx supabase test db
begin;
select plan(4);
alter table public.pengguna alter column tanggal_masuk set default '2020-01-01';

insert into auth.users (id, email, email_confirmed_at, last_sign_in_at) values
  ('00000000-0000-0000-0000-0000000000a1', 'hr@smp.test', now(), '2026-11-12 23:51:00+00'),
  ('00000000-0000-0000-0000-0000000000b1', 'budi@smp.test', null, null);
insert into public.pengguna (id, nama, email, role, nik, gaji_pokok, jabatan) values
  ('00000000-0000-0000-0000-0000000000a1', 'Dewi', 'hr@smp.test', 'hr', 'N-1', 5000000, 'HR'),
  ('00000000-0000-0000-0000-0000000000b1', 'Budi', 'budi@smp.test', 'atasan', 'N-2', 5000000, 'Kepala');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select results_eq($$ select sudah_aktif, login_terakhir from public.info_login('00000000-0000-0000-0000-0000000000a1') $$,
  $$ values (true, '2026-11-12 23:51:00+00'::timestamptz) $$, 'Akun aktif + login terakhir');
select results_eq($$ select sudah_aktif, login_terakhir from public.info_login('00000000-0000-0000-0000-0000000000b1') $$,
  $$ values (false, null::timestamptz) $$, 'Undangan belum dipakai');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select throws_ok($$ select * from public.info_login('00000000-0000-0000-0000-0000000000a1') $$, '42501', null, 'Atasan tidak boleh');
reset role;
set local role anon;
select throws_ok($$ select * from public.info_login('00000000-0000-0000-0000-0000000000a1') $$, '42501', null, 'anon tidak boleh');
reset role;

select * from finish();
rollback;

-- Uji No. KTP hanya lewat lihat_ktp (security §4.4). Jalankan: npx supabase test db
begin;
select plan(7);
alter table public.pengguna alter column tanggal_masuk set default '2020-01-01';

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'hr@smp.test'),
  ('00000000-0000-0000-0000-0000000000b1', 'budi@smp.test'),
  ('00000000-0000-0000-0000-0000000000c1', 'rina@smp.test');
insert into public.pengguna (id, nama, email, role, atasan_id, nik, gaji_pokok, jabatan, no_ktp) values
  ('00000000-0000-0000-0000-0000000000a1', 'Dewi', 'hr@smp.test', 'hr', null, 'N-1', 5000000, 'HR', null),
  ('00000000-0000-0000-0000-0000000000b1', 'Budi', 'budi@smp.test', 'atasan', null, 'N-2', 5000000, 'Kepala', null);
insert into public.pengguna (id, nama, email, role, atasan_id, nik, gaji_pokok, jabatan, no_ktp) values
  ('00000000-0000-0000-0000-0000000000c1', 'Rina', 'rina@smp.test', 'karyawan', '00000000-0000-0000-0000-0000000000b1', 'N-3', 4800000, 'Staf', '3201015408960001');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select throws_ok('select no_ktp from public.pengguna', '42501', null, 'HR tidak bisa SELECT no_ktp langsung');
select throws_ok('select * from public.pengguna', '42501', null, 'select * juga ditolak (memuat no_ktp)');
select is((select no_ktp_tersamar from public.pengguna where nama = 'Rina'), '3201********0001', 'HR membaca versi tersamar');
select lives_ok($$ update public.pengguna set no_ktp = '3201015408960002' where nama = 'Rina' $$, 'HR tetap bisa mengubah No. KTP');
select is(public.lihat_ktp('00000000-0000-0000-0000-0000000000c1'), '3201015408960002', 'Nomor lengkap lewat lihat_ktp');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select is((select no_ktp_tersamar from public.pengguna), '3201********0002', 'Karyawan melihat KTP-nya sendiri tersamar');
select throws_ok('select no_ktp from public.pengguna', '42501', null, 'Karyawan juga tidak bisa SELECT no_ktp');
reset role;

select * from finish();
rollback;

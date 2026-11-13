-- Uji alasan perubahan (header x-alasan → log_audit.alasan). Jalankan: npx supabase test db
begin;
select plan(8);
alter table public.pengguna alter column tanggal_masuk set default '2020-01-01';

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'hr@smp.test'),
  ('00000000-0000-0000-0000-0000000000b1', 'budi@smp.test'),
  ('00000000-0000-0000-0000-0000000000b2', 'agus@smp.test'),
  ('00000000-0000-0000-0000-0000000000c1', 'rina@smp.test');
insert into public.pengguna (id, nama, email, role, nik, gaji_pokok, jabatan) values
  ('00000000-0000-0000-0000-0000000000a1', 'Dewi', 'hr@smp.test', 'hr', 'N-1', 5000000, 'HR'),
  ('00000000-0000-0000-0000-0000000000b1', 'Budi', 'budi@smp.test', 'atasan', 'N-2', 5000000, 'Kepala'),
  ('00000000-0000-0000-0000-0000000000b2', 'Agus', 'agus@smp.test', 'atasan', 'N-3', 5000000, 'Kepala');
insert into public.pengguna (id, nama, email, role, atasan_id, nik, gaji_pokok, jabatan) values
  ('00000000-0000-0000-0000-0000000000c1', 'Rina', 'rina@smp.test', 'karyawan', '00000000-0000-0000-0000-0000000000b1', 'N-4', 4500000, 'Staf');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);

select throws_ok($$ update public.pengguna set gaji_pokok = 4800000 where nama = 'Rina' $$, '23514',
  'Alasan perubahan wajib diisi untuk perubahan gaji pokok, peran, atau atasan', 'Ubah gaji tanpa alasan ditolak');
select lives_ok($$ update public.pengguna set jabatan = 'Staf Senior' where nama = 'Rina' $$, 'Ubah jabatan tanpa alasan boleh');

select set_config('request.headers', '{"x-alasan":"UGVueWVzdWFpYW4gZ2FqaSB0YWh1bmFuIDIwMjYu"}', true);
select lives_ok($$ update public.pengguna set gaji_pokok = 4800000 where nama = 'Rina' $$, 'Ubah gaji dengan alasan');
select set_config('request.headers', '{"x-alasan":"TXV0YXNpIGtlIHRpbSBPcGVyYXNpb25hbCDigJQgQ2lrYXJhbmc="}', true);
select lives_ok($$ update public.pengguna set atasan_id = '00000000-0000-0000-0000-0000000000b2' where nama = 'Rina' $$, 'Pindah atasan dengan alasan (UTF-8)');

select set_config('request.headers', '{"x-alasan":"@@bukan-base64@@"}', true);
select throws_ok($$ update public.pengguna set role = 'atasan', atasan_id = null where nama = 'Rina' $$, '23514', null, 'Header rusak dianggap tanpa alasan');
select set_config('request.headers', '', true);
select set_config('request.jwt.claims', '', true);
reset role;

select bag_eq($$ select alasan from public.log_audit where tabel = 'pengguna' and aksi = 'update' $$,
  $$ values (null::text), ('Penyesuaian gaji tahunan 2026.'), ('Mutasi ke tim Operasional — Cikarang') $$,
  'Alasan tersimpan di log (jabatan tanpa alasan = null)');
select lives_ok($$ update public.pengguna set gaji_pokok = 4900000 where nama = 'Rina' $$, 'Tanpa auth.uid() (job/migrasi) tidak wajib alasan');
select is((select alasan from public.log_audit where nilai_baru ->> 'gaji_pokok' = '4900000.00'), null, 'Perubahan sistem tanpa alasan tercatat');

select * from finish();
rollback;

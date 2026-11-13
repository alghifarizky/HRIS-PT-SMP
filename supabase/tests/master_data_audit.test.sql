-- Uji master data, log audit & lihat_ktp. Jalankan: npx supabase test db
begin;
select plan(31);
-- Alasan perubahan wajib untuk gaji/peran/atasan (migrasi alasan_perubahan); header 'Uji otomatis'
select set_config('request.headers', '{"x-alasan":"VWppIG90b21hdGlz"}', true);
-- Seed lama tidak mengisi tanggal_masuk (wajib sejak trigger saldo awal); default hanya di transaksi uji
alter table public.pengguna alter column tanggal_masuk set default '2020-01-01';

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000d', 'direksi@smp.test'),
  ('00000000-0000-0000-0000-0000000000a1', 'hr@smp.test'),
  ('00000000-0000-0000-0000-0000000000a2', 'atasan@smp.test'),
  ('00000000-0000-0000-0000-0000000000a3', 'rina@smp.test'),
  ('00000000-0000-0000-0000-0000000000a4', 'resign@smp.test');

insert into public.pengguna (id, nama, email, role, aktif, atasan_id, nik, gaji_pokok, saldo_cuti, no_ktp) values
  ('00000000-0000-0000-0000-00000000000d', 'Direksi', 'direksi@smp.test', 'direksi', true, null, null, null, null, null),
  ('00000000-0000-0000-0000-0000000000a1', 'HR', 'hr@smp.test', 'hr', true, null, 'N-01', 5000000, 12, null),
  ('00000000-0000-0000-0000-0000000000a2', 'Atasan', 'atasan@smp.test', 'atasan', true, null, 'N-02', 5500000, 12, null),
  ('00000000-0000-0000-0000-0000000000a3', 'Rina', 'rina@smp.test', 'karyawan', true,
     '00000000-0000-0000-0000-0000000000a2', 'N-03', 4500000, 12, '3201015408960001'),
  ('00000000-0000-0000-0000-0000000000a4', 'Resign', 'resign@smp.test', 'karyawan', false,
     '00000000-0000-0000-0000-0000000000a2', 'N-04', 4500000, 0, null);

-- Struktur & data awal
select ok((select bool_and(relrowsecurity) from pg_class
  where oid in ('public.jadwal_kerja'::regclass, 'public.hari_libur'::regclass, 'public.pengaturan'::regclass, 'public.log_audit'::regclass)),
  'RLS aktif di jadwal_kerja, hari_libur, pengaturan, log_audit');
select results_eq('select hari::int, jam_masuk::text, jam_pulang::text from public.jadwal_kerja order by hari',
  $$ values (1,'07:00:00','15:00:00'),(2,'07:00:00','15:00:00'),(3,'07:00:00','15:00:00'),
            (4,'07:00:00','15:00:00'),(5,'07:00:00','15:00:00'),(6,'07:00:00','12:00:00') $$,
  'Jadwal awal sesuai PRD §6.2');
select results_eq('select jatah_cuti_tahunan, tanggal_cut_off::int from public.pengaturan', $$ values (12, 25) $$,
  'Pengaturan awal: jatah 12, cut-off 25');
select is((select count(*)::int from public.log_audit where tabel = 'pengguna' and aksi = 'insert'), 5, 'Insert pengguna tercatat');
select is((select nilai_baru ->> 'no_ktp' from public.log_audit where baris_id = '00000000-0000-0000-0000-0000000000a3'),
  '3201********0001', 'No. KTP di log tersamar');

-- Constraint
select throws_ok($$ update public.jadwal_kerja set jam_pulang = '06:00' where hari = 1 $$, '23514', null, 'Jam pulang harus setelah jam masuk');
select throws_ok($$ update public.pengaturan set tanggal_cut_off = 31 $$, '23514', null, 'Cut-off maksimal 28');
select throws_ok($$ insert into public.pengaturan (id, jatah_cuti_tahunan, tanggal_cut_off) values (2, 12, 25) $$,
  '23514', null, 'Pengaturan hanya satu baris');

-- anon
set local role anon;
select throws_ok('select * from public.jadwal_kerja', '42501', null, 'anon tidak bisa membaca master data');
select throws_ok($$ select public.lihat_ktp('00000000-0000-0000-0000-0000000000a3') $$, '42501', null, 'anon tidak bisa memanggil lihat_ktp');
reset role;

set local role authenticated;

-- Karyawan
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}', true);
select is((select count(*)::int from public.jadwal_kerja), 6, 'Karyawan membaca jadwal');
select is((select count(*)::int from public.pengaturan), 1, 'Karyawan membaca pengaturan');
update public.jadwal_kerja set jam_masuk = '06:00' where hari = 1;
select throws_ok($$ insert into public.hari_libur values ('2026-12-25', 'libur_nasional', 'Natal') $$, '42501', null,
  'Karyawan tidak bisa menambah hari libur');
select is((select count(*)::int from public.log_audit), 0, 'Karyawan tidak bisa membaca log audit');
select throws_ok($$ insert into public.log_audit (tabel, baris_id, aksi) values ('x', 'x', 'insert') $$, '42501', null,
  'Log audit tidak bisa ditulis dari client');
select throws_ok($$ select public.lihat_ktp('00000000-0000-0000-0000-0000000000a3') $$, '42501', null,
  'Karyawan tidak bisa memanggil lihat_ktp');

-- Pengguna nonaktif
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a4","role":"authenticated"}', true);
select is((select count(*)::int from public.jadwal_kerja), 0, 'Pengguna nonaktif tidak membaca master data');

-- HR
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select lives_ok($$ update public.jadwal_kerja set jam_pulang = '15:30' where hari = 5 $$, 'HR mengubah jadwal');
select lives_ok($$ insert into public.hari_libur values ('2026-12-25', 'libur_nasional', 'Hari Raya Natal') $$, 'HR menambah hari libur');
select throws_ok($$ insert into public.hari_libur values ('2026-12-25', 'cuti_bersama', 'Ganda') $$, '23505', null,
  'Tanggal libur ganda ditolak');
select throws_ok($$ insert into public.hari_libur values ('2026-12-24', 'cuti_bersama', '  ') $$, '23514', null,
  'Keterangan hari libur wajib');
select lives_ok($$ update public.pengaturan set jatah_cuti_tahunan = 14 $$, 'HR mengubah jatah cuti');
select lives_ok($$ update public.pengguna set gaji_pokok = 4800000 where id = '00000000-0000-0000-0000-0000000000a3' $$,
  'HR mengubah gaji karyawan');
select is(public.lihat_ktp('00000000-0000-0000-0000-0000000000a3'), '3201015408960001', 'HR melihat No. KTP lengkap');
select lives_ok($$ delete from public.hari_libur where tanggal = '2026-12-25' $$, 'HR menghapus hari libur');

-- Isi log yang dihasilkan
select results_eq($$ select nilai_lama, nilai_baru, oleh::text from public.log_audit
  where tabel = 'pengguna' and aksi = 'update' $$,
  $$ values ('{"gaji_pokok": 4500000.00}'::jsonb, '{"gaji_pokok": 4800000.00}'::jsonb, '00000000-0000-0000-0000-0000000000a1') $$,
  'Update hanya menyimpan kolom yang berubah, oleh = HR');
select results_eq($$ select baris_id, nilai_baru from public.log_audit where tabel = 'jadwal_kerja' $$,
  $$ values ('5', '{"jam_pulang": "15:30:00"}'::jsonb) $$, 'Perubahan jadwal tercatat (hanya hari 5, update Karyawan tidak tembus)');
select results_eq($$ select aksi::text, nilai_lama is null and nilai_baru is null from public.log_audit where aksi = 'lihat_ktp' $$,
  $$ values ('lihat_ktp', true) $$, 'Lihat KTP tercatat tanpa nomor');
select is((select count(*)::int from public.log_audit where tabel = 'hari_libur'), 2, 'Tambah & hapus hari libur tercatat');

-- Direksi
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select ok((select count(*) from public.log_audit) > 0, 'Direksi membaca log audit');
select throws_ok($$ insert into public.hari_libur values ('2026-12-31', 'cuti_bersama', 'X') $$, '42501', null,
  'Direksi tidak bisa mengubah master data');
reset role;

select * from finish();
rollback;

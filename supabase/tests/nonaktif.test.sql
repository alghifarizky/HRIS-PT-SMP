-- Uji penonaktifan karyawan (2.5). Jalankan: npx supabase test db
begin;
select plan(17);
alter table public.pengguna alter column tanggal_masuk set default '2020-01-01';

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000d', 'direksi@smp.test'),
  ('00000000-0000-0000-0000-0000000000a1', 'hr@smp.test'),
  ('00000000-0000-0000-0000-0000000000a2', 'hr2@smp.test'),
  ('00000000-0000-0000-0000-0000000000b1', 'budi@smp.test'),
  ('00000000-0000-0000-0000-0000000000c1', 'rina@smp.test'),
  ('00000000-0000-0000-0000-0000000000c2', 'dimas@smp.test'),
  ('00000000-0000-0000-0000-0000000000c3', 'yoga@smp.test');
insert into public.pengguna (id, nama, email, role, nik, gaji_pokok, jabatan) values
  ('00000000-0000-0000-0000-00000000000d', 'Hendra', 'direksi@smp.test', 'direksi', null, null, 'Direktur'),
  ('00000000-0000-0000-0000-0000000000a1', 'Dewi', 'hr@smp.test', 'hr', 'N-1', 5000000, 'HR'),
  ('00000000-0000-0000-0000-0000000000a2', 'Wati', 'hr2@smp.test', 'hr', 'N-6', 5000000, 'HR'),
  ('00000000-0000-0000-0000-0000000000b1', 'Budi', 'budi@smp.test', 'atasan', 'N-2', 5000000, 'Kepala');
insert into public.pengguna (id, nama, email, role, atasan_id, nik, gaji_pokok, jabatan) values
  ('00000000-0000-0000-0000-0000000000c1', 'Rina', 'rina@smp.test', 'karyawan', '00000000-0000-0000-0000-0000000000b1', 'N-3', 4500000, 'Staf'),
  ('00000000-0000-0000-0000-0000000000c2', 'Dimas', 'dimas@smp.test', 'karyawan', '00000000-0000-0000-0000-0000000000b1', 'N-4', 4500000, 'Staf');
-- Yoga: jadwal sudah lewat tapi belum diproses job (diisi langsung, trigger hanya pada UPDATE)
insert into public.pengguna (id, nama, email, role, atasan_id, nik, gaji_pokok, jabatan, tanggal_nonaktif, alasan_nonaktif) values
  ('00000000-0000-0000-0000-0000000000c3', 'Yoga', 'yoga@smp.test', 'karyawan', '00000000-0000-0000-0000-0000000000b1', 'N-5', 4500000, 'Staf',
   (now() at time zone 'Asia/Jakarta')::date - 2, 'resign');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);

-- Dijadwalkan (tanggal mendatang): tetap aktif
select lives_ok($$ update public.pengguna set tanggal_nonaktif = (now() at time zone 'Asia/Jakarta')::date + 10, alasan_nonaktif = 'resign',
  catatan_nonaktif = 'Surat resign diterima' where nama = 'Rina' $$, 'HR menjadwalkan penonaktifan');
select is((select aktif from public.pengguna where nama = 'Rina'), true, 'Terjadwal → masih aktif');
select throws_ok($$ update public.pengguna set tanggal_nonaktif = current_date + 3 where nama = 'Dimas' $$, '23514', null,
  'Tanggal tanpa alasan ditolak (nonaktif_lengkap)');
select lives_ok($$ update public.pengguna set tanggal_nonaktif = null, alasan_nonaktif = null, catatan_nonaktif = null where nama = 'Rina' $$,
  'Jadwal dibatalkan');

-- Tanggal sudah lewat → langsung nonaktif + ban
select lives_ok($$ update public.pengguna set tanggal_nonaktif = (now() at time zone 'Asia/Jakarta')::date - 1, alasan_nonaktif = 'phk'
  where nama = 'Dimas' $$, 'Tanggal kemarin');
select is((select aktif from public.pengguna where nama = 'Dimas'), false, 'Langsung nonaktif');

-- Aturan wewenang
select throws_ok($$ update public.pengguna set tanggal_nonaktif = current_date + 5, alasan_nonaktif = 'resign' where nama = 'Dewi' $$,
  '42501', null, 'Tidak bisa menjadwalkan penonaktifan diri sendiri');
select throws_ok($$ update public.pengguna set tanggal_nonaktif = current_date + 5, alasan_nonaktif = 'lainnya' where nama = 'Hendra' $$,
  '42501', 'Akun Direksi hanya dikelola developer', 'HR tidak bisa menonaktifkan Direksi');
select throws_ok($$ update public.pengguna set tanggal_nonaktif = current_date + 5, alasan_nonaktif = 'resign' where nama = 'Budi' $$,
  '23514', 'Budi masih membawahi 2 karyawan. Pindahkan dulu ke atasan lain.', 'Atasan berbawahan tidak bisa dijadwalkan');

-- Aktif kembali (rehire) + saldo baru
select lives_ok($$ update public.pengguna set aktif = true, saldo_cuti = 3 where nama = 'Dimas' $$, 'HR mengaktifkan kembali');
reset role;
select results_eq($$ select aktif, tanggal_nonaktif, alasan_nonaktif::text, saldo_cuti from public.pengguna where nama = 'Dimas' $$,
  $$ values (true, null::date, null::text, 3) $$, 'Jadwal dibersihkan, saldo disesuaikan');
select is((select banned_until from auth.users where email = 'dimas@smp.test'), null, 'Ban dicabut');

-- Direksi: jalur darurat menonaktifkan HR
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select lives_ok($$ update public.pengguna set tanggal_nonaktif = (now() at time zone 'Asia/Jakarta')::date - 1, alasan_nonaktif = 'resign'
  where nama = 'Wati' $$, 'Direksi menonaktifkan HR');
select set_config('request.jwt.claims', '', true);
reset role;
select is((select banned_until from auth.users where email = 'hr2@smp.test'), 'infinity'::timestamptz, 'HR yang dinonaktifkan di-ban');

-- Job harian
select is(public.proses_nonaktif_terjadwal(), 1, 'Job memproses 1 jadwal yang lewat (Yoga)');
select results_eq($$ select p.aktif, u.banned_until from public.pengguna p join auth.users u on u.id = p.id where p.nama = 'Yoga' $$,
  $$ values (false, 'infinity'::timestamptz) $$, 'Yoga nonaktif & di-ban oleh job');
select is((select count(*)::int from cron.job where jobname = 'nonaktif-terjadwal' and schedule = '5 17 * * *'), 1, 'Job terjadwal 00:05 WIB');

select * from finish();
rollback;

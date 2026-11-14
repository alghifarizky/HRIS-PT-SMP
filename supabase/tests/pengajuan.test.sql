-- Uji pengajuan lembur & cuti/sakit/izin, persetujuan berjenjang, notifikasi (Fase 4.1).
-- Waktu pengajuan ditentukan lewat fungsi inti catat_ajukan_* (parameter `pada`).
begin;
select plan(46);
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
update public.pengguna set saldo_cuti = 3 where nama = 'Rina';
update public.pengguna set saldo_cuti = 5 where nama = 'Budi';
insert into public.hari_libur values ('2026-12-25', 'libur_nasional', 'Hari Raya Natal');

select ok((select bool_and(relrowsecurity) from pg_class where oid in
  ('public.pengajuan_lembur'::regclass, 'public.pengajuan_cuti'::regclass, 'public.persetujuan'::regclass, 'public.notifikasi'::regclass)),
  'RLS aktif di 4 tabel baru');
select is((select public from storage.buckets where id = 'lampiran'), false, 'Bucket lampiran privat');
select is(public.hitung_hari_kerja('2026-11-16', '2026-11-22'), 6, 'Sen–Min = 6 hari kerja (Minggu libur)');
select is(public.hitung_hari_kerja('2026-12-24', '2026-12-26'), 2, 'Tanggal merah tidak dihitung');

-- ---------------- Lembur (Kam 12 Nov 2026, jadwal 07:00–15:00) ----------------
select is((public.catat_ajukan_lembur('00000000-0000-0000-0000-0000000000c1', '2026-11-12', '15:00', '17:00', 'Stock opname', '2026-11-12 10:00+07')).nomor,
  'LBR-2026-0001', 'Lembur hari kerja diterima, nomor berurutan');
select is((select row(status, tingkat_berikut, hari_libur)::text from public.pengajuan_lembur where nomor = 'LBR-2026-0001'),
  '(menunggu,1,f)', 'Status menunggu tingkat 1');
select is((select count(*)::int from public.notifikasi n join public.pengajuan_lembur l on l.id = n.objek_id
  where l.nomor = 'LBR-2026-0001' and n.pengguna_id = '00000000-0000-0000-0000-0000000000b1'), 1, 'Atasan langsung dapat notifikasi');
select throws_ok($$ select public.catat_ajukan_lembur('00000000-0000-0000-0000-0000000000c1', '2026-11-12', '17:00', '18:00', 'Lagi', '2026-11-12 10:00+07') $$,
  '23505', 'Sudah ada pengajuan lembur pada tanggal ini', 'Satu lembur aktif per tanggal');
select throws_ok($$ select public.catat_ajukan_lembur('00000000-0000-0000-0000-0000000000c2', '2026-11-12', '14:00', '16:00', 'x', '2026-11-12 10:00+07') $$,
  '23514', 'Lembur hari kerja dimulai paling cepat jam pulang (15:00)', 'Mulai sebelum jam pulang ditolak');
select throws_ok($$ select public.catat_ajukan_lembur('00000000-0000-0000-0000-0000000000c2', '2026-11-12', '15:00', '16:15', 'x', '2026-11-12 10:00+07') $$,
  '23514', 'Durasi lembur harus kelipatan 30 menit', 'Durasi bukan kelipatan 30 menit ditolak');
select throws_ok($$ select public.catat_ajukan_lembur('00000000-0000-0000-0000-0000000000c2', '2026-11-12', '15:00', '16:00', 'x', '2026-11-12 15:01+07') $$,
  '23514', 'Pengajuan lembur paling lambat jam pulang (15:00) di hari yang sama', 'Lewat jam pulang ditolak');
select is((public.catat_ajukan_lembur('00000000-0000-0000-0000-0000000000c2', '2026-11-15', '08:00', '12:00', 'Bongkar muat', '2026-11-15 07:59+07')).hari_libur,
  true, 'Lembur hari Minggu diterima sebelum jam mulai');
select throws_ok($$ select public.catat_ajukan_lembur('00000000-0000-0000-0000-0000000000c3', '2026-11-22', '08:00', '12:00', 'x', '2026-11-22 08:01+07') $$,
  '23514', 'Lembur hari libur diajukan paling lambat sebelum jam mulai lembur', 'Hari libur lewat jam mulai ditolak');
select throws_ok($$ select public.catat_ajukan_lembur('00000000-0000-0000-0000-00000000000d', '2026-11-12', '15:00', '16:00', 'x', '2026-11-12 10:00+07') $$,
  '42501', 'Direksi tidak mengajukan lembur atau cuti', 'Direksi tidak mengajukan');

-- ---------------- Cuti / sakit / izin (diajukan Kam 12 Nov) ----------------
select is((public.catat_ajukan_cuti('00000000-0000-0000-0000-0000000000c1', 'cuti', '2026-11-16', '2026-11-18', 'Acara keluarga', null, '2026-11-12 10:00+07')).jumlah_hari,
  3, 'Cuti 3 hari kerja diterima');
select throws_ok($$ select public.catat_ajukan_cuti('00000000-0000-0000-0000-0000000000c1', 'cuti', '2026-11-20', '2026-11-20', 'x', null, '2026-11-12 10:00+07') $$,
  '23514', 'Saldo cuti tidak cukup: butuh 1 hari, tersedia 0 hari', 'Saldo memperhitungkan cuti yang masih menunggu');
select throws_ok($$ select public.catat_ajukan_cuti('00000000-0000-0000-0000-0000000000c1', 'izin', '2026-11-17', '2026-11-17', 'x', null, '2026-11-12 10:00+07') $$,
  '23505', 'Tanggal bertabrakan dengan pengajuan cuti/sakit/izin lain', 'Tanggal bertabrakan ditolak');
select throws_ok($$ select public.catat_ajukan_cuti('00000000-0000-0000-0000-0000000000c1', 'izin', '2026-11-11', '2026-11-11', 'x', null, '2026-11-12 10:00+07') $$,
  '23514', 'Tanggal mulai izin tidak boleh sebelum hari ini', 'Izin mundur ditolak');
select is((public.catat_ajukan_cuti('00000000-0000-0000-0000-0000000000c1', 'sakit', '2026-11-09', '2026-11-09', 'Demam', null, '2026-11-12 10:00+07')).nomor,
  'SKT-2026-0001', 'Sakit mundur 3 hari kerja diterima');
select throws_ok($$ select public.catat_ajukan_cuti('00000000-0000-0000-0000-0000000000c2', 'sakit', '2026-11-07', '2026-11-07', 'x', null, '2026-11-12 10:00+07') $$,
  '23514', 'Pengajuan sakit paling lambat 3 hari kerja setelah tanggal sakit', 'Sakit lebih dari 3 hari kerja lalu ditolak');
select throws_ok($$ select public.catat_ajukan_cuti('00000000-0000-0000-0000-0000000000c2', 'izin', '2026-12-31', '2027-01-04', 'x', null, '2026-11-12 10:00+07') $$,
  '23514', 'Pengajuan tidak boleh melewati pergantian tahun — ajukan terpisah per tahun', 'Lintas tahun ditolak');
select throws_ok($$ select public.catat_ajukan_cuti('00000000-0000-0000-0000-0000000000c2', 'izin', '2026-11-15', '2026-11-15', 'x', null, '2026-11-12 10:00+07') $$,
  '23514', 'Rentang tanggal tidak berisi hari kerja', 'Rentang tanpa hari kerja ditolak');
select throws_ok($$ select public.catat_ajukan_cuti('00000000-0000-0000-0000-0000000000c2', 'sakit', '2026-11-12', '2026-11-12', 'x', '00000000-0000-0000-0000-0000000000c2/tidak-ada.pdf', '2026-11-12 10:00+07') $$,
  '23514', 'Lampiran tidak ditemukan. Unggah ulang.', 'Lampiran yang tidak ada ditolak');
select is((public.catat_ajukan_cuti('00000000-0000-0000-0000-0000000000b1', 'cuti', '2026-11-19', '2026-11-19', 'Urusan pribadi', null, '2026-11-12 10:00+07')).nomor,
  'CTI-2026-0002', 'Atasan mengajukan cuti');
select is((select count(*)::int from public.notifikasi where pengguna_id = '00000000-0000-0000-0000-00000000000d'), 1, 'Cuti Atasan dikabarkan ke Direksi');

create temp table id_uji as
  select nomor, id from public.pengajuan_lembur union all select nomor, id from public.pengajuan_cuti;
grant select on id_uji to authenticated;

-- ---------------- Persetujuan ----------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c2","role":"authenticated"}', true);
select throws_ok($$ select public.putuskan_pengajuan('cuti', (select id from id_uji where nomor = 'CTI-2026-0001'), 'disetujui') $$,
  '42501', null, 'Karyawan lain tidak bisa memutuskan');
select throws_ok($$ insert into public.pengajuan_lembur (nomor, pengguna_id, tanggal, jam_mulai, jam_selesai, alasan, hari_libur)
  values ('X', '00000000-0000-0000-0000-0000000000c2', '2026-11-13', '15:00', '16:00', 'x', false) $$,
  '42501', null, 'Insert langsung ke tabel ditolak (harus lewat RPC)');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c3","role":"authenticated"}', true);
select is((select count(*)::int from public.pengajuan_cuti), 0, 'Karyawan tidak melihat pengajuan orang lain');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select throws_ok($$ select public.putuskan_pengajuan('cuti', (select id from id_uji where nomor = 'CTI-2026-0001'), 'disetujui') $$,
  '42501', 'Anda bukan penyetuju pengajuan ini pada tingkat 1', 'HR tidak melompati atasan');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select throws_ok($$ select public.putuskan_pengajuan('lembur', (select id from id_uji where nomor = 'LBR-2026-0002'), 'disetujui') $$,
  '42501', null, 'Direksi bukan penyetuju pengajuan karyawan');
select lives_ok($$ select public.putuskan_pengajuan('cuti', (select id from id_uji where nomor = 'CTI-2026-0002'), 'disetujui') $$,
  'Direksi menyetujui cuti Atasan');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select is((select count(*)::int from public.pengajuan_cuti where pengguna_id = '00000000-0000-0000-0000-0000000000c1'), 2, 'Atasan melihat pengajuan bawahan');
select lives_ok($$ select public.putuskan_pengajuan('cuti', (select id from id_uji where nomor = 'CTI-2026-0001'), 'disetujui', 'OK') $$,
  'Atasan menyetujui tingkat 1');
select throws_ok($$ select public.putuskan_pengajuan('cuti', (select id from id_uji where nomor = 'CTI-2026-0001'), 'disetujui') $$,
  '42501', 'Anda bukan penyetuju pengajuan ini pada tingkat 2', 'Atasan tidak memutuskan tingkat 2');
select lives_ok($$ select public.putuskan_pengajuan('lembur', (select id from id_uji where nomor = 'LBR-2026-0002'), 'ditolak', 'Tidak ada muatan') $$,
  'Atasan menolak lembur');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select is((select count(*)::int from public.notifikasi n join id_uji i on i.id = n.objek_id where i.nomor = 'CTI-2026-0001'), 1,
  'HR dikabari untuk tingkat 2');
select lives_ok($$ select public.putuskan_pengajuan('cuti', (select id from id_uji where nomor = 'CTI-2026-0001'), 'disetujui') $$,
  'HR menyetujui tingkat 2');
select is((select count(*)::int from public.persetujuan p join id_uji i on i.id = p.pengajuan_cuti_id where i.nomor = 'CTI-2026-0001'), 2,
  'Riwayat 2 tingkat persetujuan tercatat');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select is((select status::text from public.pengajuan_cuti where nomor = 'CTI-2026-0001'), 'disetujui', 'Cuti final disetujui');
select is((select saldo_cuti from public.pengguna where id = '00000000-0000-0000-0000-0000000000c1'), 0, 'Saldo Rina terpotong 3 hari');
select is((select judul from public.notifikasi order by dibuat_pada desc limit 1), 'Cuti disetujui', 'Pengaju dikabari keputusan akhir');
select throws_ok($$ select public.batalkan_pengajuan('cuti', (select id from id_uji where nomor = 'CTI-2026-0001')) $$,
  '23514', null, 'Pengajuan yang sudah disetujui tidak bisa dibatalkan');
select lives_ok($$ select public.batalkan_pengajuan('lembur', (select id from id_uji where nomor = 'LBR-2026-0001')) $$,
  'Pengaju membatalkan lembur yang masih menunggu');
select throws_ok($$ update public.notifikasi set judul = 'x' $$, '42501', null, 'Notifikasi hanya boleh diubah kolom dibaca');

reset role;
select is((select saldo_cuti from public.pengguna where nama = 'Budi'), 4, 'Saldo Atasan terpotong saat disetujui Direksi');
select throws_ok($$ select public.catat_ajukan_lembur('00000000-0000-0000-0000-0000000000c1', '2026-11-16', '15:00', '16:00', 'x', '2026-11-12 10:00+07') $$,
  '23514', 'Anda cuti/sakit/izin pada tanggal ini', 'Lembur di hari cuti ditolak');

select * from finish();
rollback;

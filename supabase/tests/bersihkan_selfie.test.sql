-- Uji fungsi pembantu retensi selfie (3.7). Jalankan: npx supabase test db
begin;
select plan(8);
alter table public.pengguna alter column tanggal_masuk set default '2020-01-01';

insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000a1', 'hr@smp.test');
insert into public.pengguna (id, nama, email, role, nik, gaji_pokok, jabatan)
  values ('00000000-0000-0000-0000-0000000000a1', 'Dewi', 'hr@smp.test', 'hr', 'N-1', 5000000, 'HR');
insert into storage.objects (bucket_id, name, created_at) values
  ('selfie', '00000000-0000-0000-0000-0000000000a1/lama-masuk.jpg', now() - interval '13 months'),
  ('selfie', '00000000-0000-0000-0000-0000000000a1/baru-masuk.jpg', now() - interval '5 days'),
  ('selfie', '00000000-0000-0000-0000-0000000000a1/yatim-lama.jpg', now() - interval '3 days'),
  ('selfie', '00000000-0000-0000-0000-0000000000a1/yatim-baru.jpg', now() - interval '1 hour');
insert into public.absensi (pengguna_id, tanggal, jam_masuk, jam_keluar, foto_masuk_path) values
  ('00000000-0000-0000-0000-0000000000a1', ((now() at time zone 'Asia/Jakarta')::date - interval '13 months')::date,
   (((now() at time zone 'Asia/Jakarta')::date - interval '13 months')::date + time '07:00') at time zone 'Asia/Jakarta',
   (((now() at time zone 'Asia/Jakarta')::date - interval '13 months')::date + time '15:00') at time zone 'Asia/Jakarta',
   '00000000-0000-0000-0000-0000000000a1/lama-masuk.jpg'),
  ('00000000-0000-0000-0000-0000000000a1', ((now() at time zone 'Asia/Jakarta')::date - 5),
   (((now() at time zone 'Asia/Jakarta')::date - 5) + time '07:00') at time zone 'Asia/Jakarta',
   (((now() at time zone 'Asia/Jakarta')::date - 5) + time '15:00') at time zone 'Asia/Jakarta',
   '00000000-0000-0000-0000-0000000000a1/baru-masuk.jpg');

select results_eq('select foto_masuk_path from public.selfie_kedaluwarsa()', $$ values ('00000000-0000-0000-0000-0000000000a1/lama-masuk.jpg') $$,
  'Hanya absensi > 12 bulan yang kedaluwarsa');
select results_eq('select * from public.selfie_yatim()', $$ values ('00000000-0000-0000-0000-0000000000a1/yatim-lama.jpg') $$,
  'Yatim: tidak dirujuk & > 2 hari (yang 1 jam belum)');
select ok(public.cek_kunci_job((select decrypted_secret from vault.decrypted_secrets where name = 'kunci_job_bersihkan_selfie')), 'Kunci benar diterima');
select ok(not public.cek_kunci_job('salah'), 'Kunci salah ditolak');
select is((select length(decrypted_secret) from vault.decrypted_secrets where name = 'kunci_job_bersihkan_selfie'), 64, 'Kunci acak 32 byte di Vault');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select throws_ok('select public.cek_kunci_job(''x'')', '42501', null, 'Client (bahkan HR) tidak bisa memeriksa kunci');
select throws_ok('select * from public.selfie_yatim()', '42501', null, 'Client tidak bisa memanggil fungsi retensi');
reset role;
select is((select count(*)::int from cron.job where jobname = 'bersihkan-selfie' and schedule = '0 18 1 * *'), 1, 'Job bulanan terjadwal');

select * from finish();
rollback;

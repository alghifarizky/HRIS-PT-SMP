-- Uji saldo cuti awal (PRD §6.5) & usulan NIK. Jalankan: npx supabase test db
begin;
select plan(13);

-- Rumus murni (jatah 12, per 13 Nov 2026)
select is(public.jatah_cuti_proporsional(12, '2026-03-15', '2026-11-13'), 9, 'Masuk 15 Mar → 9 (contoh PRD)');
select is(public.jatah_cuti_proporsional(12, '2026-11-16', '2026-11-13'), 1, 'Masuk 16 Nov → 1 (contoh desain)');
select is(public.jatah_cuti_proporsional(12, '2026-03-01', '2026-11-13'), 10, 'Masuk 1 Mar → bulan Maret dihitung penuh');
select is(public.jatah_cuti_proporsional(12, '2026-12-02', '2026-11-13'), 0, 'Masuk 2 Des → tidak ada bulan penuh');
select is(public.jatah_cuti_proporsional(12, '2026-01-01', '2026-11-13'), 12, 'Masuk 1 Jan → penuh');
select is(public.jatah_cuti_proporsional(12, '2019-03-04', '2026-11-13'), 12, 'Masuk tahun lalu → penuh');
select is(public.jatah_cuti_proporsional(12, '2027-01-04', '2026-11-13'), 0, 'Masuk tahun depan → 0 tahun ini');
select is(public.jatah_cuti_proporsional(14, '2026-07-10', '2026-11-13'), 5, 'Jatah 14, masuk 10 Jul → Agu–Des 5 bulan → 5,83 dibulatkan ke bawah = 5');

-- Trigger: saldo dari client diabaikan
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000d', 'direksi@smp.test'),
  ('00000000-0000-0000-0000-0000000000a1', 'hr@smp.test'),
  ('00000000-0000-0000-0000-0000000000a5', 'baru@smp.test');
insert into public.pengguna (id, nama, email, role, nik, gaji_pokok, saldo_cuti, tanggal_masuk) values
  ('00000000-0000-0000-0000-00000000000d', 'Direksi', 'direksi@smp.test', 'direksi', null, null, 99, '2010-01-01'),
  ('00000000-0000-0000-0000-0000000000a1', 'HR', 'hr@smp.test', 'hr', 'SMP-2019-014', 5000000, 99, '2019-03-04');
select is((select saldo_cuti from public.pengguna where role = 'direksi'), null, 'Direksi tanpa saldo');
select is((select saldo_cuti from public.pengguna where role = 'hr'), 12, 'Saldo 99 dari client diganti jatah penuh');
select throws_ok($$ insert into public.pengguna (id, nama, email, role, nik, gaji_pokok)
  values ('00000000-0000-0000-0000-0000000000a5', 'X', 'baru@smp.test', 'hr', 'N-9', 1) $$, '23514', 'Tanggal masuk wajib diisi',
  'Tanggal masuk wajib selain Direksi');

-- Usulan NIK
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select is(public.usulan_nik(2026), 'SMP-2026-015', 'Nomor urut terbesar + 1');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000ff","role":"authenticated"}', true);
select throws_ok($$ select public.usulan_nik(2026) $$, '42501', null, 'Pengguna tanpa peran HR/Direksi ditolak');
reset role;

select * from finish();
rollback;

-- Uji penyesuaian saldo saat tanggal masuk dikoreksi. Tanggal relatif tahun berjalan agar tidak bergantung hari ini.
begin;
select plan(4);
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000c1', 'rina@smp.test');
-- masuk 1 Des tahun ini → jatah 1 hari (bila uji dijalankan Desember pun tetap tahun yang sama)
insert into public.pengguna (id, nama, email, role, nik, gaji_pokok, jabatan, tanggal_masuk)
values ('00000000-0000-0000-0000-0000000000c1', 'Rina', 'rina@smp.test', 'atasan', 'N-3', 4800000, 'Staf',
        make_date(extract(year from now() at time zone 'Asia/Jakarta')::int, 12, 1));
select is((select saldo_cuti from public.pengguna where nama = 'Rina'), 1, 'Saldo awal 1 hari (masuk 1 Des)');

update public.pengguna set tanggal_masuk = make_date(extract(year from now() at time zone 'Asia/Jakarta')::int, 3, 1) where nama = 'Rina';
select is((select saldo_cuti from public.pengguna where nama = 'Rina'), 10, 'Dikoreksi ke 1 Mar → +9 hari');

update public.pengguna set saldo_cuti = 2 where nama = 'Rina'; -- 8 hari sudah terpakai
update public.pengguna set tanggal_masuk = make_date(extract(year from now() at time zone 'Asia/Jakarta')::int - 1, 5, 1) where nama = 'Rina';
select is((select saldo_cuti from public.pengguna where nama = 'Rina'), 4, 'Masuk tahun lalu → jatah penuh, terpakai tetap terhitung (2 + 12 − 10)');

update public.pengguna set tanggal_masuk = make_date(extract(year from now() at time zone 'Asia/Jakarta')::int, 12, 1) where nama = 'Rina';
select is((select saldo_cuti from public.pengguna where nama = 'Rina'), 0, 'Tidak pernah minus (4 + 1 − 12 → 0)');

select * from finish();
rollback;

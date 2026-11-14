-- Fase 3: clock in sebelum tanggal masuk ditolak (keputusan Al, 14 Nov 2026) — agar absensi, hari hadir &
-- payroll tidak tercampur periode sebelum karyawan resmi bekerja. Selain pengecekan itu, sama dengan versi awal.
create or replace function public.catat_clock_in(pemilik uuid, foto text, pada timestamptz)
returns public.absensi
language plpgsql
security definer
set search_path = ''
as $$
declare
  p     record;
  tgl   date := (pada at time zone 'Asia/Jakarta')::date;
  hasil public.absensi;
begin
  select role, aktif, tanggal_masuk into p from public.pengguna where id = pemilik;
  if not found or not p.aktif then
    raise exception 'Akun tidak aktif' using errcode = '42501';
  end if;
  if p.tanggal_masuk is not null and tgl < p.tanggal_masuk then
    raise exception 'Anda baru bisa clock in mulai % % %', extract(day from p.tanggal_masuk)::int,
      (array['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'])[extract(month from p.tanggal_masuk)::int],
      extract(year from p.tanggal_masuk)::int
      using errcode = '23514';
  end if;
  if p.role = 'direksi' then
    raise exception 'Direksi tidak mengikuti absensi' using errcode = '42501';
  end if;
  if not exists (select 1 from public.jadwal_tanggal(tgl)) then
    raise exception 'Hari ini libur — tidak perlu clock in' using errcode = '23514';
  end if;
  perform public.cek_foto_selfie(pemilik, foto);

  perform set_config('hris.absensi_rpc', '1', true);
  insert into public.absensi (pengguna_id, tanggal, jam_masuk, foto_masuk_path)
  values (pemilik, tgl, pada, foto)
  on conflict (pengguna_id, tanggal) do nothing
  returning * into hasil;
  perform set_config('hris.absensi_rpc', '', true);
  if hasil.id is null then
    raise exception 'Anda sudah clock in hari ini' using errcode = '23505';
  end if;
  return hasil;
end;
$$;

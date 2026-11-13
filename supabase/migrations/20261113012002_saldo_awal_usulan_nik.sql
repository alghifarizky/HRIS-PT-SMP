-- Fase 2 langkah 2.3a: saldo cuti awal otomatis (PRD §6.5) & usulan NIK (EMP-03).
-- Keputusan Al (13 Nov 2026):
--   • masuk tepat tanggal 1 → bulan itu dihitung bulan penuh (1 Mar → Mar–Des = 10 bulan);
--   • tanggal masuk di tahun depan → saldo tahun ini 0 (jatah tahun itu diberikan job reset 1 Januari);
--   • usulan NIK "SMP-{tahun masuk}-{nomor urut terbesar + 1, 3 digit}", HR boleh mengubah.

/** Jatah cuti tahun berjalan untuk karyawan dengan tanggal masuk tertentu. */
create function public.jatah_cuti_proporsional(jatah integer, tanggal_masuk date, per_tanggal date)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case
    when extract(year from tanggal_masuk) < extract(year from per_tanggal) then jatah
    when extract(year from tanggal_masuk) > extract(year from per_tanggal) then 0
    else floor(
      jatah * (12 - extract(month from tanggal_masuk) + case when extract(day from tanggal_masuk) = 1 then 1 else 0 end) / 12.0
    )::integer
  end;
$$;

-- Saldo awal selalu dihitung database saat karyawan ditambahkan; nilai dari client diabaikan ("otomatis" di desain).
create function public.isi_saldo_cuti_awal()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.role = 'direksi' then
    new.saldo_cuti := null;
    return new;
  end if;
  if new.tanggal_masuk is null then
    raise exception 'Tanggal masuk wajib diisi' using errcode = '23514';
  end if;
  new.saldo_cuti := public.jatah_cuti_proporsional(
    (select jatah_cuti_tahunan from public.pengaturan where id = 1),
    new.tanggal_masuk,
    (now() at time zone 'Asia/Jakarta')::date
  );
  return new;
end;
$$;

create trigger pengguna_isi_saldo_cuti_awal
  before insert on public.pengguna
  for each row execute function public.isi_saldo_cuti_awal();

/** Usulan NIK berikutnya, mis. "SMP-2026-015". Hanya untuk HR & Direksi. */
create function public.usulan_nik(tahun_masuk integer)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  urut integer;
begin
  if coalesce(public.peran_saya(), '') not in ('hr', 'direksi') then
    raise exception 'Hanya HR dan Direksi' using errcode = '42501';
  end if;
  select coalesce(max(substring(nik from '^SMP-\d{4}-(\d+)$')::integer), 0) + 1 into urut
  from public.pengguna;
  return format('SMP-%s-%s', tahun_masuk, lpad(urut::text, 3, '0'));
end;
$$;

revoke execute on function public.usulan_nik(integer) from public, anon;
grant execute on function public.usulan_nik(integer) to authenticated;

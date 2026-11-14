-- Koreksi tanggal masuk menyesuaikan saldo cuti (keputusan Al 14 Nov 2026): saldo ± selisih jatah proporsional
-- (tanggal baru − tanggal lama), sehingga cuti yang sudah terpakai tetap terhitung. Saldo tidak minus.
-- Perubahan tercatat di log_audit lewat trigger audit pengguna yang sudah ada.
create function public.sesuaikan_saldo_tanggal_masuk()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  jatah    integer := (select jatah_cuti_tahunan from public.pengaturan where id = 1);
  hari_ini date := (now() at time zone 'Asia/Jakarta')::date;
begin
  if new.saldo_cuti is not null and old.tanggal_masuk is not null and new.tanggal_masuk is not null then
    new.saldo_cuti := greatest(0, new.saldo_cuti
      + public.jatah_cuti_proporsional(jatah, new.tanggal_masuk, hari_ini)
      - public.jatah_cuti_proporsional(jatah, old.tanggal_masuk, hari_ini));
  end if;
  return new;
end;
$$;

create trigger pengguna_sesuaikan_saldo_tanggal_masuk
  before update of tanggal_masuk on public.pengguna
  for each row when (new.tanggal_masuk is distinct from old.tanggal_masuk)
  execute function public.sesuaikan_saldo_tanggal_masuk();

-- Fase 3.6 (perbaikan): koreksi absensi ditolak bila alasannya SAMA dengan alasan sebelumnya — pesan
-- "Alasan koreksi wajib diisi" menyesatkan (laporan Al, 14 Nov 2026). Kini cukup tidak kosong. Agar tiap koreksi
-- tetap punya alasannya sendiri di log, form mengirim alasan lewat header x-alasan (→ log_audit.alasan).
create or replace function public.jaga_absensi()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  koreksi boolean := coalesce(current_setting('hris.absensi_rpc', true), '') <> '1' and auth.uid() is not null;
begin
  if (new.jam_masuk at time zone 'Asia/Jakarta')::date <> new.tanggal then
    raise exception 'Jam masuk harus pada tanggal absensi' using errcode = '23514';
  end if;
  if tg_op = 'INSERT' or new.jam_masuk is distinct from old.jam_masuk then
    new.terlambat := public.hitung_terlambat(new.tanggal, new.jam_masuk);
  end if;

  -- Kolom ringkasan koreksi hanya dari trigger: mulai dari nilai lama (atau kosong saat insert)
  if tg_op = 'INSERT' then
    new.jam_masuk_semula := null;
    new.jam_keluar_semula := null;
    new.dikoreksi_pada := null;
    new.dikoreksi_oleh_nama := null;
  else
    new.jam_masuk_semula := old.jam_masuk_semula;
    new.jam_keluar_semula := old.jam_keluar_semula;
    new.dikoreksi_pada := old.dikoreksi_pada;
    new.dikoreksi_oleh_nama := old.dikoreksi_oleh_nama;
  end if;

  if koreksi then
    if tg_op = 'INSERT' and new.jam_keluar is null then
      raise exception 'Absensi manual wajib berisi jam masuk dan jam keluar' using errcode = '23514';
    end if;
    -- Alasan dari header x-alasan (dikirim form koreksi) diutamakan; boleh sama dengan alasan sebelumnya
    new.alasan_koreksi := coalesce(public.alasan_permintaan(), new.alasan_koreksi);
    if btrim(coalesce(new.alasan_koreksi, '')) = '' then
      raise exception 'Alasan koreksi wajib diisi' using errcode = '23514';
    end if;
    new.dikoreksi_oleh := auth.uid();
    new.dikoreksi_pada := now();
    new.dikoreksi_oleh_nama := (
      select p.nama || ' (' || case p.role when 'hr' then 'HR' when 'direksi' then 'Direksi' when 'atasan' then 'Atasan' else 'Karyawan' end || ')'
      from public.pengguna p where p.id = auth.uid()
    );
    if tg_op = 'UPDATE' then
      -- "Semula" = nilai asli sebelum koreksi PERTAMA pada kolom itu
      if new.jam_masuk is distinct from old.jam_masuk and old.jam_masuk_semula is null then
        new.jam_masuk_semula := old.jam_masuk;
      end if;
      if new.jam_keluar is distinct from old.jam_keluar and old.jam_keluar_semula is null then
        new.jam_keluar_semula := old.jam_keluar;
      end if;
      if new.jam_keluar is distinct from old.jam_keluar then
        new.auto_clock_out := false;
      end if;
    end if;
  end if;
  return new;
end;
$$;

-- Fase 3 langkah 3.4: info koreksi yang boleh dilihat karyawan pemilik absensi (desain B1 hal 23:
-- "Semula 07:21 WIB", "Dewi Lestari (HR) · Jum, 6 Nov 2026 · 10:15 WIB"). Karyawan tidak boleh membaca
-- log_audit maupun baris pengguna HR, jadi ringkasannya disalin trigger ke baris absensi itu sendiri.
-- Keputusan Al (14 Nov 2026). Semua kolom diisi trigger — nilai dari client diabaikan.

alter table public.absensi
  add column jam_masuk_semula    timestamptz,
  add column jam_keluar_semula   timestamptz,
  add column dikoreksi_pada      timestamptz,
  add column dikoreksi_oleh_nama text;

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
    if btrim(coalesce(new.alasan_koreksi, '')) = ''
       or (tg_op = 'UPDATE' and new.alasan_koreksi is not distinct from old.alasan_koreksi) then
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

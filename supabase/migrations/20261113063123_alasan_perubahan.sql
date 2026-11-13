-- Fase 2 langkah 2.4d: alasan perubahan di log audit (desain B3A hal 18; keputusan Al, 13 Nov 2026).
-- Client mengirim alasan lewat header HTTP "x-alasan" (base64 UTF-8) pada permintaan yang sama dengan UPDATE;
-- PostgREST meneruskannya sebagai GUC request.headers. Alasan WAJIB bila gaji pokok, peran, atau atasan
-- berubah (oleh pengguna; job/migrasi tanpa auth.uid() dikecualikan).

alter table public.log_audit add column alasan text;

/** Alasan dari header x-alasan permintaan saat ini; null bila tidak ada / tidak valid. */
create function public.alasan_permintaan()
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  mentah text := nullif(current_setting('request.headers', true), '')::json ->> 'x-alasan';
begin
  if mentah is null then
    return null;
  end if;
  return nullif(btrim(left(convert_from(decode(mentah, 'base64'), 'UTF8'), 500)), '');
exception when others then
  return null; -- header rusak → anggap tanpa alasan
end;
$$;

create or replace function public.catat_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  lama  jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  baru  jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  kunci text  := coalesce(baru, lama) ->> tg_argv[0];
  k     text;
begin
  if tg_op = 'UPDATE' then
    for k in select jsonb_object_keys(baru) loop
      if lama -> k is not distinct from baru -> k then
        lama := lama - k;
        baru := baru - k;
      end if;
    end loop;
    if baru = '{}'::jsonb then
      return null;
    end if;
  end if;

  if lama ? 'no_ktp' then
    lama := jsonb_set(lama, '{no_ktp}', coalesce(to_jsonb(public.samarkan_ktp(lama ->> 'no_ktp')), 'null'::jsonb));
  end if;
  if baru ? 'no_ktp' then
    baru := jsonb_set(baru, '{no_ktp}', coalesce(to_jsonb(public.samarkan_ktp(baru ->> 'no_ktp')), 'null'::jsonb));
  end if;

  insert into public.log_audit (tabel, baris_id, aksi, nilai_lama, nilai_baru, oleh, alasan)
  values (tg_table_name, kunci, lower(tg_op)::public.aksi_audit, lama, baru, auth.uid(), public.alasan_permintaan());
  return null;
end;
$$;

create function public.wajib_alasan_pengguna()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is not null
     and (new.gaji_pokok is distinct from old.gaji_pokok or new.role is distinct from old.role or new.atasan_id is distinct from old.atasan_id)
     and public.alasan_permintaan() is null then
    raise exception 'Alasan perubahan wajib diisi untuk perubahan gaji pokok, peran, atau atasan' using errcode = '23514';
  end if;
  return new;
end;
$$;

-- "w" setelah pengguna_jaga_perubahan & pengguna_validasi_atasan: wewenang & aturan atasan dilaporkan lebih dulu
create trigger pengguna_wajib_alasan
  before update on public.pengguna
  for each row execute function public.wajib_alasan_pengguna();

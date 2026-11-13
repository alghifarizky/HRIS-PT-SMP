-- Fase 2 langkah 2.1: master data (jadwal_kerja, hari_libur, pengaturan), log_audit, RPC lihat_ktp.
-- Acuan: PRD MST-01/02/03, EMP-06, §6.2, §6.5; spesifikasi §7; security §4.3, §4.4, §10.
-- Keputusan Al (13 Nov 2026): perubahan jadwal langsung berlaku; log_audit.baris_id teks (kunci master data
-- bukan uuid); hari libur diisi HR lewat UI; pengaturan awal jatah 12 hari, cut-off tanggal 25.

create type public.jenis_hari_libur as enum ('libur_nasional', 'cuti_bersama');
create type public.aksi_audit as enum ('insert', 'update', 'delete', 'lihat_ktp');

-- ---------------------------------------------------------------------------
-- Master data
-- ---------------------------------------------------------------------------
create table public.jadwal_kerja (
  hari       smallint primary key check (hari between 1 and 6), -- 1 Senin … 6 Sabtu; Minggu selalu libur
  jam_masuk  time not null,
  jam_pulang time not null,
  constraint jam_pulang_setelah_masuk check (jam_pulang > jam_masuk)
);

insert into public.jadwal_kerja (hari, jam_masuk, jam_pulang) values
  (1, '07:00', '15:00'), (2, '07:00', '15:00'), (3, '07:00', '15:00'),
  (4, '07:00', '15:00'), (5, '07:00', '15:00'), (6, '07:00', '12:00');

create table public.hari_libur (
  tanggal    date primary key,
  jenis      public.jenis_hari_libur not null,
  keterangan text not null check (btrim(keterangan) <> '')
);

create table public.pengaturan (
  id                 smallint primary key default 1 check (id = 1), -- satu baris saja
  jatah_cuti_tahunan integer not null check (jatah_cuti_tahunan between 0 and 365),
  tanggal_cut_off    smallint not null check (tanggal_cut_off between 1 and 28)
);

insert into public.pengaturan (jatah_cuti_tahunan, tanggal_cut_off) values (12, 25);

-- RLS: semua pengguna aktif membaca; HR mengubah (security §4.3). Baris jadwal & pengaturan tetap (tanpa C/D).
alter table public.jadwal_kerja enable row level security;
alter table public.hari_libur enable row level security;
alter table public.pengaturan enable row level security;
revoke all on public.jadwal_kerja, public.hari_libur, public.pengaturan from anon;

create policy jadwal_kerja_select on public.jadwal_kerja for select to authenticated
  using ((select public.peran_saya()) is not null);
create policy jadwal_kerja_update_hr on public.jadwal_kerja for update to authenticated
  using ((select public.peran_saya()) = 'hr') with check ((select public.peran_saya()) = 'hr');

create policy hari_libur_select on public.hari_libur for select to authenticated
  using ((select public.peran_saya()) is not null);
create policy hari_libur_insert_hr on public.hari_libur for insert to authenticated
  with check ((select public.peran_saya()) = 'hr');
create policy hari_libur_update_hr on public.hari_libur for update to authenticated
  using ((select public.peran_saya()) = 'hr') with check ((select public.peran_saya()) = 'hr');
create policy hari_libur_delete_hr on public.hari_libur for delete to authenticated
  using ((select public.peran_saya()) = 'hr');

create policy pengaturan_select on public.pengaturan for select to authenticated
  using ((select public.peran_saya()) is not null);
create policy pengaturan_update_hr on public.pengaturan for update to authenticated
  using ((select public.peran_saya()) = 'hr') with check ((select public.peran_saya()) = 'hr');

-- ---------------------------------------------------------------------------
-- Log audit (security §10): hanya diisi trigger / RPC, dibaca HR & Direksi, tidak bisa diubah dari client.
-- ---------------------------------------------------------------------------
create table public.log_audit (
  id         uuid primary key default gen_random_uuid(),
  tabel      text not null,
  baris_id   text not null,
  aksi       public.aksi_audit not null,
  nilai_lama jsonb,
  nilai_baru jsonb,
  oleh       uuid references public.pengguna (id) on delete restrict, -- null = Sistem (job / migrasi)
  pada       timestamptz not null default now()
);

create index log_audit_pada_idx on public.log_audit (pada desc);
create index log_audit_baris_idx on public.log_audit (tabel, baris_id);

alter table public.log_audit enable row level security;
revoke all on public.log_audit from anon;
revoke insert, update, delete, truncate on public.log_audit from authenticated;

create policy log_audit_select on public.log_audit for select to authenticated
  using ((select public.peran_saya()) in ('hr', 'direksi'));

/** "3201015408960001" → "3201********0001" — log tidak boleh jadi jalur bocor No. KTP. */
create function public.samarkan_ktp(no_ktp text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case when no_ktp is null then null
              else left(no_ktp, 4) || repeat('*', greatest(length(no_ktp) - 8, 0)) || right(no_ktp, 4) end;
$$;

-- Trigger umum. Argumen: nama kolom kunci. UPDATE hanya menyimpan kolom yang berubah.
create function public.catat_audit()
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
      return null; -- tidak ada perubahan nyata
    end if;
  end if;

  if lama ? 'no_ktp' then
    lama := jsonb_set(lama, '{no_ktp}', coalesce(to_jsonb(public.samarkan_ktp(lama ->> 'no_ktp')), 'null'::jsonb));
  end if;
  if baru ? 'no_ktp' then
    baru := jsonb_set(baru, '{no_ktp}', coalesce(to_jsonb(public.samarkan_ktp(baru ->> 'no_ktp')), 'null'::jsonb));
  end if;

  insert into public.log_audit (tabel, baris_id, aksi, nilai_lama, nilai_baru, oleh)
  values (tg_table_name, kunci, lower(tg_op)::public.aksi_audit, lama, baru, auth.uid());
  return null;
end;
$$;

create trigger pengguna_audit after insert or update or delete on public.pengguna
  for each row execute function public.catat_audit('id');
create trigger jadwal_kerja_audit after insert or update or delete on public.jadwal_kerja
  for each row execute function public.catat_audit('hari');
create trigger hari_libur_audit after insert or update or delete on public.hari_libur
  for each row execute function public.catat_audit('tanggal');
create trigger pengaturan_audit after insert or update or delete on public.pengaturan
  for each row execute function public.catat_audit('id');

-- ---------------------------------------------------------------------------
-- RPC lihat_ktp (EMP-06, security §4.4): HR & Direksi saja, tercatat di log tanpa menyimpan nomornya.
-- ---------------------------------------------------------------------------
create function public.lihat_ktp(target uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  hasil text;
begin
  if coalesce(public.peran_saya(), '') not in ('hr', 'direksi') then
    raise exception 'Hanya HR dan Direksi yang dapat melihat No. KTP' using errcode = '42501';
  end if;

  select no_ktp into hasil from public.pengguna where id = target;
  if not found then
    raise exception 'Karyawan tidak ditemukan' using errcode = 'P0002';
  end if;

  insert into public.log_audit (tabel, baris_id, aksi, oleh)
  values ('pengguna', target::text, 'lihat_ktp', auth.uid());
  return hasil;
end;
$$;

revoke execute on function public.lihat_ktp(uuid) from public, anon;
grant execute on function public.lihat_ktp(uuid) to authenticated;

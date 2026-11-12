-- Fase 1 langkah 4: enum peran, tabel pengguna, helper RLS, RLS pengguna.
-- Acuan: spesifikasi.md §7 (ERD), security.md §3, §4.2–4.5, PRD EMP-03/04/07/08, AUTH-04.

create type public.peran_pengguna as enum ('karyawan', 'atasan', 'hr', 'direksi');
create type public.status_menikah as enum ('belum_menikah', 'menikah');

create table public.pengguna (
  id                uuid primary key references auth.users (id) on delete restrict, -- nonaktif, tidak dihapus
  nama              text not null check (btrim(nama) <> ''),
  email             text not null unique,
  role              public.peran_pengguna not null,
  aktif             boolean not null default true,
  atasan_id         uuid references public.pengguna (id) on delete restrict,
  nik               text unique,
  jabatan           text,
  tanggal_lahir     date,
  alamat            text,
  tanggal_masuk     date,
  no_ktp            text check (no_ktp ~ '^[0-9]{16}$'),
  status_menikah    public.status_menikah,
  jumlah_tanggungan integer not null default 0 check (jumlah_tanggungan >= 0),
  gaji_pokok        numeric(14, 2) check (gaji_pokok >= 0),
  saldo_cuti        integer check (saldo_cuti >= 0),

  constraint atasan_bukan_diri_sendiri check (atasan_id <> id),
  -- Direksi: tanpa atasan/gaji/saldo, NIK opsional. Karyawan: atasan wajib.
  -- Atasan & HR: atasan tidak dipaksa (persetujuan mereka ke Direksi berdasarkan peran).
  constraint kelengkapan_per_peran check (
    case role
      when 'direksi' then atasan_id is null and gaji_pokok is null and saldo_cuti is null
      when 'karyawan' then atasan_id is not null and gaji_pokok is not null and saldo_cuti is not null and nik is not null
      else gaji_pokok is not null and saldo_cuti is not null and nik is not null
    end
  )
);

create index pengguna_atasan_id_idx on public.pengguna (atasan_id);

-- ---------------------------------------------------------------------------
-- Helper RLS (security.md §4.2). Pengguna nonaktif → peran null → semua policy menolak.
-- ---------------------------------------------------------------------------
create function public.peran_saya()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select role::text from public.pengguna where id = auth.uid() and aktif;
$$;

create function public.adalah_bawahan(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.peran_saya() is not null
     and exists (select 1 from public.pengguna where id = target and atasan_id = auth.uid());
$$;

revoke execute on function public.peran_saya() from public, anon;
revoke execute on function public.adalah_bawahan(uuid) from public, anon;
grant execute on function public.peran_saya() to authenticated;
grant execute on function public.adalah_bawahan(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS pengguna (security.md §4.3, PRD EMP-08): R sendiri; HR R/C/U semua; Direksi R semua +
-- C/U khusus baris HR (cakupan dijaga trigger di bawah); tanpa DELETE.
-- Atasan membaca bawahan lewat view pengguna_publik (menyusul, tanpa kolom sensitif).
-- ---------------------------------------------------------------------------
alter table public.pengguna enable row level security;
revoke all on public.pengguna from anon;

create policy pengguna_select on public.pengguna
  for select to authenticated
  using (
    (id = (select auth.uid()) and (select public.peran_saya()) is not null)
    or (select public.peran_saya()) in ('hr', 'direksi')
  );

-- HR menambah siapa pun kecuali Direksi; Direksi hanya menambah HR.
create policy pengguna_insert on public.pengguna
  for insert to authenticated
  with check (
    ((select public.peran_saya()) = 'hr' and role <> 'direksi')
    or ((select public.peran_saya()) = 'direksi' and role = 'hr')
  );

create policy pengguna_update on public.pengguna
  for update to authenticated
  using ((select public.peran_saya()) in ('hr', 'direksi'))
  with check ((select public.peran_saya()) in ('hr', 'direksi'));

-- ---------------------------------------------------------------------------
-- Aturan UPDATE yang tidak bisa diungkapkan RLS (security.md §4.5):
-- 1. Tidak ada yang boleh mengubah role/aktif barisnya sendiri. HR tunggal tetap boleh ubah
--    gaji & saldo sendiri (keputusan Al, 12 Nov 2026 — diawasi payroll Direksi + log_audit).
-- 2. Peran direksi tidak bisa diberikan/dicabut dari aplikasi.
-- 3. Direksi hanya mengubah baris yang ber-peran HR sebelum atau sesudah perubahan.
-- auth.uid() null (migrasi / service_role) → diizinkan.
-- ---------------------------------------------------------------------------
create function public.jaga_perubahan_pengguna()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if old.id = auth.uid()
     and (new.role is distinct from old.role or new.aktif is distinct from old.aktif) then
    raise exception 'Tidak boleh mengubah peran atau status aktif akun sendiri'
      using errcode = '42501';
  end if;

  if new.role is distinct from old.role and 'direksi' in (old.role, new.role) then
    raise exception 'Peran Direksi tidak dapat diubah dari aplikasi'
      using errcode = '42501';
  end if;

  if public.peran_saya() = 'direksi' and old.role <> 'hr' and new.role <> 'hr' then
    raise exception 'Direksi hanya dapat mengubah data HR'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger pengguna_jaga_perubahan
  before update on public.pengguna
  for each row execute function public.jaga_perubahan_pengguna();

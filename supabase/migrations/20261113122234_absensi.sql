-- Fase 3 langkah 3.1: absensi, RPC clock in/out, koreksi HR, bucket selfie, auto clock out.
-- Acuan: PRD ATT-01–09, §6.2; spesifikasi §2 Absensi, §4.1, §5.1, §7; security §4.3, §5, §10.
-- Keputusan Al (13 Nov 2026):
--   • clock in di hari libur (Minggu, tanggal merah, cuti bersama) ditolak — dibuka untuk lembur hari libur di Fase 4;
--   • terlambat bila jam masuk (dipotong ke menit) > jam masuk jadwal + 5 menit (07:05 tepat waktu, 07:06 terlambat);
--   • pulang lebih cepat boleh — "lebih cepat N menit" dihitung di tampilan, tanpa kolom;
--   • clock in/out hanya untuk tanggal hari ini (WIB); lupa clock out → job auto clock out isi jam pulang jadwal;
--   • koreksi HR: terlambat dihitung ulang, tanda auto clock out hilang bila jam keluar dikoreksi, alasan wajib.
--   • selfie dibaca pemilik foto, atasan langsung, HR (security §5).

create table public.absensi (
  id               uuid primary key default gen_random_uuid(),
  pengguna_id      uuid not null references public.pengguna (id) on delete restrict,
  tanggal          date not null,
  jam_masuk        timestamptz not null,
  jam_keluar       timestamptz,
  foto_masuk_path  text,
  foto_keluar_path text,
  terlambat        boolean not null default false,
  auto_clock_out   boolean not null default false,
  dikoreksi_oleh   uuid references public.pengguna (id) on delete restrict,
  alasan_koreksi   text,
  constraint absensi_satu_per_hari unique (pengguna_id, tanggal),
  constraint jam_keluar_setelah_masuk check (jam_keluar is null or jam_keluar >= jam_masuk),
  constraint koreksi_beralasan check (dikoreksi_oleh is null or btrim(coalesce(alasan_koreksi, '')) <> '')
);
create index absensi_tanggal_idx on public.absensi (tanggal);

-- ---------------------------------------------------------------------------
-- Aturan jadwal
-- ---------------------------------------------------------------------------
/** Jadwal hari kerja untuk satu tanggal; tidak ada baris bila Minggu / tanggal merah / cuti bersama. */
create function public.jadwal_tanggal(tgl date)
returns table (jam_masuk time, jam_pulang time)
language sql
stable
security definer
set search_path = ''
as $$
  select j.jam_masuk, j.jam_pulang
  from public.jadwal_kerja j
  where j.hari = extract(isodow from tgl)::int
    and not exists (select 1 from public.hari_libur h where h.tanggal = tgl);
$$;

/** Terlambat bila jam masuk (WIB, dipotong ke menit) melewati jadwal + 5 menit. Hari tanpa jadwal → tidak terlambat. */
create function public.hitung_terlambat(tgl date, jam timestamptz)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select date_trunc('minute', jam at time zone 'Asia/Jakarta')::time > j.jam_masuk + interval '5 minutes'
     from public.jadwal_tanggal(tgl) j),
    false);
$$;

-- ---------------------------------------------------------------------------
-- RLS (security §4.3): R sendiri / bawahan / HR / Direksi; C/U hanya HR (koreksi). Clock in/out lewat RPC.
-- ---------------------------------------------------------------------------
alter table public.absensi enable row level security;
revoke all on public.absensi from anon;

create policy absensi_select on public.absensi for select to authenticated
  using (
    (pengguna_id = (select auth.uid()) and (select public.peran_saya()) is not null)
    or public.adalah_bawahan(pengguna_id)
    or (select public.peran_saya()) in ('hr', 'direksi')
  );
create policy absensi_insert_hr on public.absensi for insert to authenticated
  with check ((select public.peran_saya()) = 'hr');
create policy absensi_update_hr on public.absensi for update to authenticated
  using ((select public.peran_saya()) = 'hr') with check ((select public.peran_saya()) = 'hr');

-- Koreksi / tambah manual oleh HR: alasan wajib, dikoreksi_oleh otomatis, terlambat dihitung ulang.
-- RPC clock in/out menandai transaksinya (hris.absensi_rpc) agar HR yang absen untuk dirinya tidak dianggap koreksi.
create function public.jaga_absensi()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (new.jam_masuk at time zone 'Asia/Jakarta')::date <> new.tanggal then
    raise exception 'Jam masuk harus pada tanggal absensi' using errcode = '23514';
  end if;
  if tg_op = 'INSERT' or new.jam_masuk is distinct from old.jam_masuk then
    new.terlambat := public.hitung_terlambat(new.tanggal, new.jam_masuk);
  end if;

  if coalesce(current_setting('hris.absensi_rpc', true), '') <> '1' and auth.uid() is not null then
    if tg_op = 'INSERT' and new.jam_keluar is null then
      raise exception 'Absensi manual wajib berisi jam masuk dan jam keluar' using errcode = '23514';
    end if;
    if btrim(coalesce(new.alasan_koreksi, '')) = ''
       or (tg_op = 'UPDATE' and new.alasan_koreksi is not distinct from old.alasan_koreksi) then
      raise exception 'Alasan koreksi wajib diisi' using errcode = '23514';
    end if;
    new.dikoreksi_oleh := auth.uid();
    if tg_op = 'UPDATE' and new.jam_keluar is distinct from old.jam_keluar then
      new.auto_clock_out := false;
    end if;
  end if;
  return new;
end;
$$;

create trigger absensi_jaga before insert or update on public.absensi
  for each row execute function public.jaga_absensi();
create trigger absensi_audit after insert or update or delete on public.absensi
  for each row execute function public.catat_audit('id');

-- ---------------------------------------------------------------------------
-- Clock in / out (ATT-01–05). Jam dari server; foto wajib & harus milik pemanggil di bucket selfie.
-- Inti (`catat_*`) menerima waktu agar bisa diuji; RPC publik selalu memakai now().
-- ---------------------------------------------------------------------------
create function public.cek_foto_selfie(pemilik uuid, foto text)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if foto is null or split_part(foto, '/', 1) <> pemilik::text
     or not exists (select 1 from storage.objects o where o.bucket_id = 'selfie' and o.name = foto) then
    raise exception 'Foto selfie tidak ditemukan. Ambil foto lagi.' using errcode = '23514';
  end if;
end;
$$;

create function public.catat_clock_in(pemilik uuid, foto text, pada timestamptz)
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
  select role, aktif into p from public.pengguna where id = pemilik;
  if not found or not p.aktif then
    raise exception 'Akun tidak aktif' using errcode = '42501';
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

create function public.catat_clock_out(pemilik uuid, foto text, pada timestamptz)
returns public.absensi
language plpgsql
security definer
set search_path = ''
as $$
declare
  tgl   date := (pada at time zone 'Asia/Jakarta')::date;
  hasil public.absensi;
begin
  if not exists (select 1 from public.pengguna where id = pemilik and aktif) then
    raise exception 'Akun tidak aktif' using errcode = '42501';
  end if;
  perform public.cek_foto_selfie(pemilik, foto);

  perform set_config('hris.absensi_rpc', '1', true);
  update public.absensi set jam_keluar = pada, foto_keluar_path = foto
  where pengguna_id = pemilik and tanggal = tgl and jam_keluar is null
  returning * into hasil;
  perform set_config('hris.absensi_rpc', '', true);
  if hasil.id is null then
    if exists (select 1 from public.absensi where pengguna_id = pemilik and tanggal = tgl) then
      raise exception 'Anda sudah clock out hari ini' using errcode = '23505';
    end if;
    raise exception 'Belum clock in hari ini' using errcode = '23514';
  end if;
  return hasil;
end;
$$;

create function public.clock_in(foto_path text)
returns public.absensi
language sql
security definer
set search_path = ''
as $$ select * from public.catat_clock_in(auth.uid(), foto_path, now()); $$;

create function public.clock_out(foto_path text)
returns public.absensi
language sql
security definer
set search_path = ''
as $$ select * from public.catat_clock_out(auth.uid(), foto_path, now()); $$;

-- jadwal_tanggal & hitung_terlambat dipakai trigger jaga_absensi (berjalan sebagai HR) — hanya membaca jadwal
-- & hari libur yang memang boleh dibaca pengguna aktif, jadi cukup ditutup untuk anon.
revoke execute on function public.jadwal_tanggal(date), public.hitung_terlambat(date, timestamptz) from public, anon;
revoke execute on function public.cek_foto_selfie(uuid, text), public.catat_clock_in(uuid, text, timestamptz),
  public.catat_clock_out(uuid, text, timestamptz) from public, anon, authenticated;
revoke execute on function public.clock_in(text), public.clock_out(text) from public, anon;
grant execute on function public.clock_in(text), public.clock_out(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Auto clock out (ATT-06): job harian 00:10 WIB untuk hari-hari sebelumnya yang belum clock out.
-- Jam keluar = jam pulang jadwal hari itu (tidak sebelum jam masuk). Hari tanpa jadwal dilewati (Fase 4).
-- ---------------------------------------------------------------------------
create function public.proses_auto_clock_out()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  jumlah integer;
begin
  update public.absensi a
  set jam_keluar = greatest((a.tanggal + j.jam_pulang) at time zone 'Asia/Jakarta', a.jam_masuk),
      auto_clock_out = true
  from public.jadwal_kerja j
  where a.jam_keluar is null
    and a.tanggal < (now() at time zone 'Asia/Jakarta')::date
    and j.hari = extract(isodow from a.tanggal)::int;
  get diagnostics jumlah = row_count;
  return jumlah;
end;
$$;
revoke execute on function public.proses_auto_clock_out() from public, anon, authenticated;
select cron.schedule('auto-clock-out', '10 17 * * *', $$select public.proses_auto_clock_out()$$); -- 00:10 WIB

-- ---------------------------------------------------------------------------
-- Storage: bucket privat `selfie` (security §5) — path {pengguna_id}/{tanggal}-{uuid}.jpg, maks. 2 MB.
-- Upload: pemilik (yang ikut absensi). Baca: pemilik, atasan langsung, HR. Tanpa update/hapus dari client.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('selfie', 'selfie', false, 2097152, array['image/jpeg', 'image/webp'])
on conflict (id) do nothing;

create policy selfie_upload on storage.objects for insert to authenticated
  with check (
    bucket_id = 'selfie'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select public.peran_saya()) in ('karyawan', 'atasan', 'hr')
  );
create policy selfie_baca on storage.objects for select to authenticated
  using (
    bucket_id = 'selfie'
    and (
      ((storage.foldername(name))[1] = (select auth.uid())::text and (select public.peran_saya()) is not null)
      or public.adalah_bawahan(((storage.foldername(name))[1])::uuid)
      or (select public.peran_saya()) = 'hr'
    )
  );

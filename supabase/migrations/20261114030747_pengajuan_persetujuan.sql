-- Fase 4 langkah 4.1: pengajuan lembur & cuti/sakit/izin, persetujuan berjenjang, notifikasi, bucket lampiran.
-- Acuan: PRD OT-01–06, LV-01–07, APR-01–03, NTF-01/02, §6.1, §6.6, §6.7; spesifikasi §2, §4.2–4.3, §5.2–5.3, §7;
-- security §4.3, §4.5, §5.
-- Keputusan Al (14 Nov 2026):
--   • lembur hari kerja: jam mulai ≥ jam pulang jadwal; durasi kelipatan 30 menit; batas ajukan = jam pulang hari itu;
--     hari libur: batas = sebelum jam mulai lembur; satu lembur aktif per tanggal;
--   • cuti & izin: hari ini/mendatang; sakit: mundur maks. 3 hari kerja; tidak boleh lintas tahun;
--     saldo cuti memperhitungkan cuti yang masih menunggu; tabrakan tanggal ditolak; lembur di hari cuti ditolak;
--   • penyetuju ditentukan saat keputusan (atasan langsung terkini); tingkat 2 = HR mana pun; pengaju Atasan/HR → Direksi.
-- Client hanya MEMBACA tabel ini; semua tindakan lewat RPC yang memvalidasi aturan (security §4.5).

create type public.status_pengajuan as enum ('menunggu', 'disetujui', 'ditolak', 'dibatalkan');
create type public.jenis_cuti as enum ('cuti', 'sakit', 'izin');
create type public.keputusan_persetujuan as enum ('disetujui', 'ditolak');

create table public.pengajuan_lembur (
  id              uuid primary key default gen_random_uuid(),
  nomor           text not null unique,
  pengguna_id     uuid not null references public.pengguna (id) on delete restrict,
  tanggal         date not null,
  jam_mulai       time not null,
  jam_selesai     time not null,
  alasan          text not null check (btrim(alasan) <> '' and char_length(alasan) <= 500),
  hari_libur      boolean not null,
  status          public.status_pengajuan not null default 'menunggu',
  tingkat_berikut smallint check (tingkat_berikut in (1, 2)),
  diajukan_pada   timestamptz not null default now(),
  selesai_pada    timestamptz,
  constraint lembur_jam_urut check (jam_selesai > jam_mulai),
  constraint lembur_kelipatan_30_menit check (extract(epoch from (jam_selesai - jam_mulai))::int % 1800 = 0),
  constraint lembur_tingkat_sesuai_status check ((status = 'menunggu') = (tingkat_berikut is not null))
);
create index pengajuan_lembur_pengguna_idx on public.pengajuan_lembur (pengguna_id, tanggal);
create index pengajuan_lembur_menunggu_idx on public.pengajuan_lembur (status) where status = 'menunggu';

create table public.pengajuan_cuti (
  id              uuid primary key default gen_random_uuid(),
  nomor           text not null unique,
  pengguna_id     uuid not null references public.pengguna (id) on delete restrict,
  jenis           public.jenis_cuti not null,
  tanggal_mulai   date not null,
  tanggal_selesai date not null,
  jumlah_hari     integer not null check (jumlah_hari > 0),
  alasan          text not null check (btrim(alasan) <> '' and char_length(alasan) <= 500),
  lampiran_path   text,
  status          public.status_pengajuan not null default 'menunggu',
  tingkat_berikut smallint check (tingkat_berikut in (1, 2)),
  diajukan_pada   timestamptz not null default now(),
  selesai_pada    timestamptz,
  constraint cuti_tanggal_urut check (tanggal_selesai >= tanggal_mulai),
  constraint cuti_satu_tahun check (extract(year from tanggal_mulai) = extract(year from tanggal_selesai)),
  constraint cuti_tingkat_sesuai_status check ((status = 'menunggu') = (tingkat_berikut is not null))
);
create index pengajuan_cuti_pengguna_idx on public.pengajuan_cuti (pengguna_id, tanggal_mulai);
create index pengajuan_cuti_menunggu_idx on public.pengajuan_cuti (status) where status = 'menunggu';

create table public.persetujuan (
  id                  uuid primary key default gen_random_uuid(),
  pengajuan_lembur_id uuid references public.pengajuan_lembur (id) on delete restrict,
  pengajuan_cuti_id   uuid references public.pengajuan_cuti (id) on delete restrict,
  penyetuju_id        uuid not null references public.pengguna (id) on delete restrict,
  tingkat             smallint not null check (tingkat in (1, 2)),
  keputusan           public.keputusan_persetujuan not null,
  catatan             text check (char_length(catatan) <= 500),
  diputuskan_pada     timestamptz not null default now(),
  constraint persetujuan_satu_pengajuan check (num_nonnulls(pengajuan_lembur_id, pengajuan_cuti_id) = 1),
  constraint persetujuan_lembur_tingkat_unik unique (pengajuan_lembur_id, tingkat),
  constraint persetujuan_cuti_tingkat_unik unique (pengajuan_cuti_id, tingkat)
);

create table public.notifikasi (
  id          uuid primary key default gen_random_uuid(),
  pengguna_id uuid not null references public.pengguna (id) on delete restrict,
  judul       text not null,
  pesan       text not null,
  jenis_objek text check (jenis_objek in ('lembur', 'cuti')), -- tautan dibentuk aplikasi sesuai peran pembaca
  objek_id    uuid,
  dibaca      boolean not null default false,
  dibuat_pada timestamptz not null default now()
);
create index notifikasi_pengguna_idx on public.notifikasi (pengguna_id, dibuat_pada desc);

-- ---------------------------------------------------------------------------
-- RLS: baca saja. Pengaju sendiri, atasan langsung, HR & Direksi. Persetujuan mengikuti pengajuannya.
-- ---------------------------------------------------------------------------
alter table public.pengajuan_lembur enable row level security;
alter table public.pengajuan_cuti enable row level security;
alter table public.persetujuan enable row level security;
alter table public.notifikasi enable row level security;
revoke all on public.pengajuan_lembur, public.pengajuan_cuti, public.persetujuan, public.notifikasi from anon;
revoke insert, update, delete, truncate on public.pengajuan_lembur, public.pengajuan_cuti, public.persetujuan from authenticated;
revoke insert, update, delete, truncate on public.notifikasi from authenticated;
grant update (dibaca) on public.notifikasi to authenticated;

create policy lembur_select on public.pengajuan_lembur for select to authenticated
  using ((pengguna_id = (select auth.uid()) and (select public.peran_saya()) is not null)
         or public.adalah_bawahan(pengguna_id) or (select public.peran_saya()) in ('hr', 'direksi'));
create policy cuti_select on public.pengajuan_cuti for select to authenticated
  using ((pengguna_id = (select auth.uid()) and (select public.peran_saya()) is not null)
         or public.adalah_bawahan(pengguna_id) or (select public.peran_saya()) in ('hr', 'direksi'));
-- RLS tabel pengajuan ikut berlaku di subquery → hanya persetujuan dari pengajuan yang boleh dilihat
create policy persetujuan_select on public.persetujuan for select to authenticated
  using (exists (select 1 from public.pengajuan_lembur l where l.id = pengajuan_lembur_id)
         or exists (select 1 from public.pengajuan_cuti c where c.id = pengajuan_cuti_id));
create policy notifikasi_select on public.notifikasi for select to authenticated
  using (pengguna_id = (select auth.uid()) and (select public.peran_saya()) is not null);
create policy notifikasi_tandai_dibaca on public.notifikasi for update to authenticated
  using (pengguna_id = (select auth.uid())) with check (pengguna_id = (select auth.uid()));

alter publication supabase_realtime add table public.notifikasi; -- NTF-01 realtime (RLS tetap berlaku)

-- ---------------------------------------------------------------------------
-- Pembantu
-- ---------------------------------------------------------------------------
/** Jumlah hari kerja (ada jadwal & bukan hari libur / cuti bersama) dalam [mulai, selesai] — LV-02. */
create function public.hitung_hari_kerja(mulai date, selesai date)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::int from generate_series(mulai, selesai, interval '1 day') d
  where exists (select 1 from public.jadwal_tanggal(d::date));
$$;

/** Hari kerja ke-n sebelum `tgl` (untuk batas mundur pengajuan sakit). */
create function public.hari_kerja_mundur(tgl date, n integer)
returns date
language sql
stable
security definer
set search_path = ''
as $$
  select min(d) from (
    select d::date from generate_series(tgl - 31, tgl - 1, interval '1 day') d
    where exists (select 1 from public.jadwal_tanggal(d::date))
    order by d desc limit n
  ) x;
$$;

/** Nomor pengajuan berurutan per awalan per tahun, mis. LBR-2026-0201 (desain). */
create function public.nomor_pengajuan(awalan text, tahun integer)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  urut integer;
begin
  perform pg_advisory_xact_lock(hashtext(awalan || tahun));
  select coalesce(max(substring(nomor from '-(\d+)$')::integer), 0) + 1 into urut
  from (select nomor from public.pengajuan_lembur union all select nomor from public.pengajuan_cuti) n
  where nomor like awalan || '-' || tahun || '-%';
  return format('%s-%s-%s', awalan, tahun, lpad(urut::text, 4, '0'));
end;
$$;

create function public.kirim_notifikasi(penerima uuid, judul text, pesan text, jenis_objek text, objek_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.notifikasi (pengguna_id, judul, pesan, jenis_objek, objek_id) values (penerima, judul, pesan, jenis_objek, objek_id);
$$;

/** Notifikasi ke penyetuju tingkat berikut: tingkat 1 karyawan → atasan langsung; Atasan/HR → semua Direksi aktif;
 *  tingkat 2 → semua HR aktif (kecuali pengaju). */
create function public.kabari_penyetuju(pengaju uuid, tingkat smallint, judul text, pesan text, jenis_objek text, objek_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  p record;
  r record;
begin
  select role, atasan_id into p from public.pengguna where id = pengaju;
  for r in
    select id from public.pengguna
    where aktif and id <> pengaju and (
      (tingkat = 1 and p.role = 'karyawan' and id = p.atasan_id)
      or (tingkat = 1 and p.role in ('atasan', 'hr') and role = 'direksi')
      or (tingkat = 2 and role = 'hr'))
  loop
    perform public.kirim_notifikasi(r.id, judul, pesan, jenis_objek, objek_id);
  end loop;
end;
$$;

/** Pengaju sah: aktif, ikut absensi, sudah mulai bekerja pada tanggal itu. */
create function public.cek_pengaju(pengaju uuid, tgl date)
returns public.pengguna
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  p public.pengguna;
begin
  select * into p from public.pengguna where id = pengaju;
  if not found or not p.aktif then
    raise exception 'Akun tidak aktif' using errcode = '42501';
  end if;
  if p.role = 'direksi' then
    raise exception 'Direksi tidak mengajukan lembur atau cuti' using errcode = '42501';
  end if;
  if p.tanggal_masuk is not null and tgl < p.tanggal_masuk then
    raise exception 'Tanggal pengajuan sebelum tanggal masuk Anda' using errcode = '23514';
  end if;
  return p;
end;
$$;

-- ---------------------------------------------------------------------------
-- Ajukan lembur (OT-01–03). Inti menerima `pada` agar bisa diuji; RPC publik memakai now().
-- ---------------------------------------------------------------------------
create function public.catat_ajukan_lembur(pengaju uuid, tgl date, mulai time, selesai time, alasan_isi text, pada timestamptz)
returns public.pengajuan_lembur
language plpgsql
security definer
set search_path = ''
as $$
declare
  p          public.pengguna;
  j          record;
  libur      boolean;
  batas      timestamp;
  sekarang   timestamp := pada at time zone 'Asia/Jakarta';
  hasil      public.pengajuan_lembur;
  durasi_jam numeric;
begin
  p := public.cek_pengaju(pengaju, tgl);
  if selesai <= mulai then
    raise exception 'Jam selesai harus setelah jam mulai' using errcode = '23514';
  end if;
  if extract(epoch from (selesai - mulai))::int % 1800 <> 0 then
    raise exception 'Durasi lembur harus kelipatan 30 menit' using errcode = '23514';
  end if;

  select * into j from public.jadwal_tanggal(tgl);
  libur := not found;
  if libur then
    batas := tgl + mulai;
    if sekarang > batas then
      raise exception 'Lembur hari libur diajukan paling lambat sebelum jam mulai lembur' using errcode = '23514';
    end if;
  else
    if mulai < j.jam_pulang then
      raise exception 'Lembur hari kerja dimulai paling cepat jam pulang (%)', to_char(j.jam_pulang, 'HH24:MI') using errcode = '23514';
    end if;
    batas := tgl + j.jam_pulang;
    if sekarang > batas then
      raise exception 'Pengajuan lembur paling lambat jam pulang (%) di hari yang sama', to_char(j.jam_pulang, 'HH24:MI') using errcode = '23514';
    end if;
  end if;

  if exists (select 1 from public.pengajuan_lembur where pengguna_id = pengaju and tanggal = tgl and status in ('menunggu', 'disetujui')) then
    raise exception 'Sudah ada pengajuan lembur pada tanggal ini' using errcode = '23505';
  end if;
  if exists (select 1 from public.pengajuan_cuti where pengguna_id = pengaju and status = 'disetujui'
             and tgl between tanggal_mulai and tanggal_selesai) then
    raise exception 'Anda cuti/sakit/izin pada tanggal ini' using errcode = '23514';
  end if;

  insert into public.pengajuan_lembur (nomor, pengguna_id, tanggal, jam_mulai, jam_selesai, alasan, hari_libur, tingkat_berikut, diajukan_pada)
  values (public.nomor_pengajuan('LBR', extract(year from tgl)::int), pengaju, tgl, mulai, selesai, btrim(alasan_isi), libur, 1, pada)
  returning * into hasil;

  durasi_jam := extract(epoch from (selesai - mulai)) / 3600.0;
  perform public.kabari_penyetuju(pengaju, 1::smallint, 'Pengajuan lembur',
    format('%s mengajukan lembur %s (%s–%s, %s jam).', p.nama, to_char(tgl, 'DD-MM-YYYY'), to_char(mulai, 'HH24:MI'), to_char(selesai, 'HH24:MI'),
           replace(trim(trailing '.' from trim(trailing '0' from durasi_jam::text)), '.', ',')),
    'lembur', hasil.id);
  return hasil;
end;
$$;

-- ---------------------------------------------------------------------------
-- Ajukan cuti / sakit / izin (LV-01–03, LV-05)
-- ---------------------------------------------------------------------------
create function public.catat_ajukan_cuti(pengaju uuid, jenis_isi public.jenis_cuti, mulai date, selesai date, alasan_isi text, lampiran text, pada timestamptz)
returns public.pengajuan_cuti
language plpgsql
security definer
set search_path = ''
as $$
declare
  p        public.pengguna;
  hari_ini date := (pada at time zone 'Asia/Jakarta')::date;
  jumlah   integer;
  dipakai  integer;
  hasil    public.pengajuan_cuti;
  label    text := case jenis_isi when 'cuti' then 'cuti' when 'sakit' then 'sakit' else 'izin' end;
begin
  p := public.cek_pengaju(pengaju, mulai);
  if selesai < mulai then
    raise exception 'Tanggal selesai tidak boleh sebelum tanggal mulai' using errcode = '23514';
  end if;
  if extract(year from mulai) <> extract(year from selesai) then
    raise exception 'Pengajuan tidak boleh melewati pergantian tahun — ajukan terpisah per tahun' using errcode = '23514';
  end if;
  if jenis_isi = 'sakit' then
    if mulai < public.hari_kerja_mundur(hari_ini, 3) then
      raise exception 'Pengajuan sakit paling lambat 3 hari kerja setelah tanggal sakit' using errcode = '23514';
    end if;
  elsif mulai < hari_ini then
    raise exception 'Tanggal mulai % tidak boleh sebelum hari ini', label using errcode = '23514';
  end if;

  jumlah := public.hitung_hari_kerja(mulai, selesai);
  if jumlah = 0 then
    raise exception 'Rentang tanggal tidak berisi hari kerja' using errcode = '23514';
  end if;
  if exists (select 1 from public.pengajuan_cuti where pengguna_id = pengaju and status in ('menunggu', 'disetujui')
             and daterange(tanggal_mulai, tanggal_selesai, '[]') && daterange(mulai, selesai, '[]')) then
    raise exception 'Tanggal bertabrakan dengan pengajuan cuti/sakit/izin lain' using errcode = '23505';
  end if;
  if jenis_isi = 'cuti' then
    select coalesce(sum(jumlah_hari), 0) into dipakai from public.pengajuan_cuti
    where pengguna_id = pengaju and jenis = 'cuti' and status = 'menunggu';
    if coalesce(p.saldo_cuti, 0) - dipakai < jumlah then
      raise exception 'Saldo cuti tidak cukup: butuh % hari, tersedia % hari', jumlah, greatest(coalesce(p.saldo_cuti, 0) - dipakai, 0) using errcode = '23514';
    end if;
  end if;
  if lampiran is not null and (split_part(lampiran, '/', 1) <> pengaju::text
     or not exists (select 1 from storage.objects o where o.bucket_id = 'lampiran' and o.name = lampiran)) then
    raise exception 'Lampiran tidak ditemukan. Unggah ulang.' using errcode = '23514';
  end if;

  insert into public.pengajuan_cuti (nomor, pengguna_id, jenis, tanggal_mulai, tanggal_selesai, jumlah_hari, alasan, lampiran_path, tingkat_berikut, diajukan_pada)
  values (public.nomor_pengajuan(case jenis_isi when 'cuti' then 'CTI' when 'sakit' then 'SKT' else 'IZN' end, extract(year from mulai)::int),
          pengaju, jenis_isi, mulai, selesai, jumlah, btrim(alasan_isi), lampiran, 1, pada)
  returning * into hasil;

  perform public.kabari_penyetuju(pengaju, 1::smallint, format('Pengajuan %s', label),
    format('%s mengajukan %s %s s.d. %s (%s hari kerja).', p.nama, label, to_char(mulai, 'DD-MM-YYYY'), to_char(selesai, 'DD-MM-YYYY'), jumlah),
    'cuti', hasil.id);
  return hasil;
end;
$$;

-- ---------------------------------------------------------------------------
-- Batalkan (OT-04, LV-06): hanya pengaju, hanya saat menunggu
-- ---------------------------------------------------------------------------
create function public.batalkan_pengajuan(jenis text, pengajuan uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if jenis = 'lembur' then
    update public.pengajuan_lembur set status = 'dibatalkan', tingkat_berikut = null, selesai_pada = now()
    where id = pengajuan and pengguna_id = auth.uid() and status = 'menunggu';
  elsif jenis = 'cuti' then
    update public.pengajuan_cuti set status = 'dibatalkan', tingkat_berikut = null, selesai_pada = now()
    where id = pengajuan and pengguna_id = auth.uid() and status = 'menunggu';
  else
    raise exception 'Jenis pengajuan tidak dikenal' using errcode = '22023';
  end if;
  if not found then
    raise exception 'Pengajuan tidak dapat dibatalkan (bukan milik Anda atau sudah diproses)' using errcode = '23514';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Putuskan (APR-02/03, §6.1). Penyetuju ditentukan saat keputusan berdasarkan data terkini.
-- ---------------------------------------------------------------------------
create function public.putuskan_pengajuan(jenis text, pengajuan uuid, putusan public.keputusan_persetujuan, catatan_isi text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  saya      uuid := auth.uid();
  peran     text := public.peran_saya();
  pg        record; -- pengajuan
  p         public.pengguna; -- pengaju
  final     boolean;
  judul     text;
  label     text;
begin
  if peran is null then
    raise exception 'Akun tidak aktif' using errcode = '42501';
  end if;
  if jenis = 'lembur' then
    select id, pengguna_id, status, tingkat_berikut, null::public.jenis_cuti as jenis_cuti, 0 as jumlah_hari, nomor into pg
    from public.pengajuan_lembur where id = pengajuan for update;
  elsif jenis = 'cuti' then
    select id, pengguna_id, status, tingkat_berikut, c.jenis as jenis_cuti, jumlah_hari, nomor into pg
    from public.pengajuan_cuti c where id = pengajuan for update;
  else
    raise exception 'Jenis pengajuan tidak dikenal' using errcode = '22023';
  end if;
  if not found then
    raise exception 'Pengajuan tidak ditemukan' using errcode = 'P0002';
  end if;
  if pg.status <> 'menunggu' then
    raise exception 'Pengajuan sudah % — tidak perlu diputuskan lagi', pg.status using errcode = '23514';
  end if;
  select * into p from public.pengguna where id = pg.pengguna_id;
  if p.id = saya then
    raise exception 'Tidak bisa memutuskan pengajuan sendiri' using errcode = '42501';
  end if;
  if not (
       (pg.tingkat_berikut = 1 and p.role = 'karyawan' and p.atasan_id = saya)
    or (pg.tingkat_berikut = 1 and p.role in ('atasan', 'hr') and peran = 'direksi')
    or (pg.tingkat_berikut = 2 and peran = 'hr')
  ) then
    raise exception 'Anda bukan penyetuju pengajuan ini pada tingkat %', pg.tingkat_berikut using errcode = '42501';
  end if;

  insert into public.persetujuan (pengajuan_lembur_id, pengajuan_cuti_id, penyetuju_id, tingkat, keputusan, catatan)
  values (case when jenis = 'lembur' then pengajuan end, case when jenis = 'cuti' then pengajuan end, saya, pg.tingkat_berikut, putusan, nullif(btrim(catatan_isi), ''));

  final := putusan = 'ditolak' or pg.tingkat_berikut = 2 or p.role <> 'karyawan';
  label := case when jenis = 'lembur' then 'Lembur' when pg.jenis_cuti = 'cuti' then 'Cuti' when pg.jenis_cuti = 'sakit' then 'Sakit' else 'Izin' end;

  if final and putusan = 'disetujui' and pg.jenis_cuti = 'cuti' then
    -- LV-04: kurangi saldo setelah disetujui. Saldo bisa turun (cuti bersama) sejak diajukan → tolak bila kurang.
    if coalesce(p.saldo_cuti, 0) < pg.jumlah_hari then
      raise exception 'Saldo cuti pengaju tidak cukup (tersisa % hari) — tolak pengajuan ini', coalesce(p.saldo_cuti, 0) using errcode = '23514';
    end if;
    perform set_config('hris.sistem', '1', true); -- lewati jaga_perubahan_pengguna (perubahan saldo oleh sistem)
    update public.pengguna set saldo_cuti = saldo_cuti - pg.jumlah_hari where id = p.id;
    perform set_config('hris.sistem', '', true);
  end if;

  if jenis = 'lembur' then
    update public.pengajuan_lembur
    set status = case when not final then 'menunggu' when putusan = 'disetujui' then 'disetujui' else 'ditolak' end::public.status_pengajuan,
        tingkat_berikut = case when final then null else 2 end, selesai_pada = case when final then now() end
    where id = pengajuan;
  else
    update public.pengajuan_cuti
    set status = case when not final then 'menunggu' when putusan = 'disetujui' then 'disetujui' else 'ditolak' end::public.status_pengajuan,
        tingkat_berikut = case when final then null else 2 end, selesai_pada = case when final then now() end
    where id = pengajuan;
  end if;

  if final then
    judul := format('%s %s', label, case when putusan = 'disetujui' then 'disetujui' else 'ditolak' end);
    perform public.kirim_notifikasi(p.id, judul,
      format('Pengajuan %s %s oleh %s.%s', pg.nomor, case when putusan = 'disetujui' then 'disetujui' else 'ditolak' end,
             (select nama from public.pengguna where id = saya), coalesce(' Catatan: ' || nullif(btrim(catatan_isi), ''), '')),
      jenis, pengajuan);
  else
    perform public.kabari_penyetuju(p.id, 2::smallint, format('Persetujuan tingkat 2: %s', lower(label)),
      format('%s dari %s disetujui atasan, menunggu keputusan HR.', pg.nomor, p.nama), jenis, pengajuan);
  end if;
end;
$$;

-- Perubahan saldo oleh sistem (persetujuan cuti, cuti bersama, reset tahunan) melewati aturan wewenang UI
create or replace function public.jaga_perubahan_pengguna()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is null or coalesce(current_setting('hris.sistem', true), '') = '1' then
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

-- RPC publik (waktu server)
create function public.ajukan_lembur(tanggal date, jam_mulai time, jam_selesai time, alasan text)
returns public.pengajuan_lembur
language sql
security definer
set search_path = ''
as $$ select * from public.catat_ajukan_lembur(auth.uid(), tanggal, jam_mulai, jam_selesai, alasan, now()); $$;

create function public.ajukan_cuti(jenis public.jenis_cuti, tanggal_mulai date, tanggal_selesai date, alasan text, lampiran_path text default null)
returns public.pengajuan_cuti
language sql
security definer
set search_path = ''
as $$ select * from public.catat_ajukan_cuti(auth.uid(), jenis, tanggal_mulai, tanggal_selesai, alasan, lampiran_path, now()); $$;

revoke execute on function
  public.hitung_hari_kerja(date, date), public.hari_kerja_mundur(date, integer), public.nomor_pengajuan(text, integer),
  public.kirim_notifikasi(uuid, text, text, text, uuid), public.kabari_penyetuju(uuid, smallint, text, text, text, uuid),
  public.cek_pengaju(uuid, date), public.catat_ajukan_lembur(uuid, date, time, time, text, timestamptz),
  public.catat_ajukan_cuti(uuid, public.jenis_cuti, date, date, text, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.hitung_hari_kerja(date, date) to authenticated; -- form cuti menampilkan jumlah hari kerja
revoke execute on function public.ajukan_lembur(date, time, time, text), public.ajukan_cuti(public.jenis_cuti, date, date, text, text),
  public.batalkan_pengajuan(text, uuid), public.putuskan_pengajuan(text, uuid, public.keputusan_persetujuan, text) from public, anon;
grant execute on function public.ajukan_lembur(date, time, time, text), public.ajukan_cuti(public.jenis_cuti, date, date, text, text),
  public.batalkan_pengajuan(text, uuid), public.putuskan_pengajuan(text, uuid, public.keputusan_persetujuan, text) to authenticated;

-- Log audit perubahan status pengajuan (pelaku = auth.uid())
create trigger pengajuan_lembur_audit after insert or update on public.pengajuan_lembur
  for each row execute function public.catat_audit('id');
create trigger pengajuan_cuti_audit after insert or update on public.pengajuan_cuti
  for each row execute function public.catat_audit('id');

-- ---------------------------------------------------------------------------
-- Storage `lampiran` (security §5): privat, ≤ 5 MB, gambar/PDF. Upload: pemilik (folder sendiri).
-- Baca: pemilik, atasan langsung (penyetuju), HR, Direksi hanya untuk pengaju Atasan/HR (penyetujunya).
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('lampiran', 'lampiran', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'])
on conflict (id) do nothing;

create policy lampiran_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'lampiran' and (storage.foldername(name))[1] = (select auth.uid())::text
              and (select public.peran_saya()) in ('karyawan', 'atasan', 'hr'));
create policy lampiran_baca on storage.objects for select to authenticated
  using (bucket_id = 'lampiran' and (
    ((storage.foldername(name))[1] = (select auth.uid())::text and (select public.peran_saya()) is not null)
    or public.adalah_bawahan(((storage.foldername(name))[1])::uuid)
    or (select public.peran_saya()) = 'hr'
    or ((select public.peran_saya()) = 'direksi' and exists (
          select 1 from public.pengguna u where u.id::text = (storage.foldername(name))[1] and u.role in ('atasan', 'hr')))));

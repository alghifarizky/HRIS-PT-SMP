-- Fase 2 langkah 2.5: nonaktifkan karyawan dengan tanggal efektif (PRD EMP-02, security §3; desain B3A hal 19).
-- Keputusan Al (13 Nov 2026):
--   • alasan: resign / kontrak berakhir / PHK / pensiun / meninggal dunia / lainnya;
--   • tanggal efektif = hari terakhir akun aktif. Kemarin atau lebih awal → langsung nonaktif saat disimpan;
--     hari ini / mendatang → dijadwalkan, dijalankan job harian 00:05 WIB;
--   • jadwal boleh dibatalkan sebelum tanggal efektif; HR dapat mengaktifkan kembali (rehire).
-- Nonaktif = aktif false (RLS menolak semua akses) + akun Auth di-ban (tidak bisa login).
-- Pembatalan pengajuan Menunggu ditambahkan ke trigger ini di Fase 4 (tabel pengajuan belum ada).

do $$
begin
  if not has_table_privilege('auth.users', 'UPDATE') then
    raise exception 'Role migrasi tidak bisa UPDATE auth.users — ban akun perlu jalur lain (Edge Function)';
  end if;
end;
$$;

create type public.alasan_nonaktif as enum ('resign', 'kontrak_berakhir', 'phk', 'pensiun', 'meninggal_dunia', 'lainnya');

alter table public.pengguna
  add column tanggal_nonaktif date,
  add column alasan_nonaktif public.alasan_nonaktif,
  add column catatan_nonaktif text check (char_length(catatan_nonaktif) <= 500),
  add constraint nonaktif_lengkap check ((tanggal_nonaktif is null) = (alasan_nonaktif is null));

grant select (tanggal_nonaktif, alasan_nonaktif, catatan_nonaktif) on public.pengguna to authenticated;

/** Ban / buka ban akun Auth. Internal — hanya dipanggil trigger. */
create function public.atur_ban_akun(target uuid, ban boolean)
returns void
language sql
security definer
set search_path = ''
as $$
  update auth.users set banned_until = case when ban then 'infinity'::timestamptz end where id = target;
$$;
revoke execute on function public.atur_ban_akun(uuid, boolean) from public, anon, authenticated;

create function public.kelola_nonaktif()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  hari_ini date := (now() at time zone 'Asia/Jakarta')::date;
  jumlah   integer;
begin
  -- Aksi pengguna (bukan job/migrasi): wewenang & aturan penjadwalan
  if auth.uid() is not null
     and (new.tanggal_nonaktif is distinct from old.tanggal_nonaktif or new.aktif is distinct from old.aktif) then
    if new.id = auth.uid() then
      raise exception 'Tidak boleh menonaktifkan akun sendiri' using errcode = '42501';
    end if;
    if new.role = 'direksi' then
      raise exception 'Akun Direksi hanya dikelola developer' using errcode = '42501';
    end if;
  end if;

  -- Dinonaktifkan langsung tanpa tanggal (mis. lewat SQL) → tanggal efektif kemarin, alasan lainnya
  if old.aktif and not new.aktif and new.tanggal_nonaktif is null then
    new.tanggal_nonaktif := hari_ini - 1;
    new.alasan_nonaktif := coalesce(new.alasan_nonaktif, 'lainnya');
  end if;

  -- Jadwal baru: Atasan tidak boleh masih membawahi; tanggal sudah lewat → langsung nonaktif
  if new.aktif and new.tanggal_nonaktif is not null and new.tanggal_nonaktif is distinct from old.tanggal_nonaktif then
    if new.role = 'atasan' then
      select count(*) into jumlah from public.pengguna b where b.atasan_id = new.id and b.aktif and b.role = 'karyawan';
      if jumlah > 0 then
        raise exception '% masih membawahi % karyawan. Pindahkan dulu ke atasan lain.', new.nama, jumlah using errcode = '23514';
      end if;
    end if;
    if new.tanggal_nonaktif < hari_ini then
      new.aktif := false;
    end if;
  end if;

  -- Aktif kembali (rehire): bersihkan jadwal
  if not old.aktif and new.aktif then
    new.tanggal_nonaktif := null;
    new.alasan_nonaktif := null;
    new.catatan_nonaktif := null;
  end if;

  if old.aktif and not new.aktif then
    perform public.atur_ban_akun(new.id, true);
  elsif not old.aktif and new.aktif then
    perform public.atur_ban_akun(new.id, false);
  end if;
  return new;
end;
$$;

-- Urutan abjad: setelah pengguna_jaga_perubahan, sebelum pengguna_validasi_atasan (yang memeriksa bawahan
-- bila aktif berubah menjadi false di sini).
create trigger pengguna_kelola_nonaktif
  before update on public.pengguna
  for each row execute function public.kelola_nonaktif();

/** Job harian: nonaktifkan yang tanggal efektifnya sudah lewat. Gagal per baris tidak menghentikan baris lain. */
create function public.proses_nonaktif_terjadwal()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  r      record;
  jumlah integer := 0;
begin
  for r in
    select id, nama from public.pengguna
    where aktif and tanggal_nonaktif < (now() at time zone 'Asia/Jakarta')::date
  loop
    begin
      update public.pengguna set aktif = false where id = r.id;
      jumlah := jumlah + 1;
    exception when others then
      raise warning 'Gagal menonaktifkan % (%): %', r.nama, r.id, sqlerrm;
    end;
  end loop;
  return jumlah;
end;
$$;
revoke execute on function public.proses_nonaktif_terjadwal() from public, anon, authenticated;

create extension if not exists pg_cron;
select cron.schedule('nonaktif-terjadwal', '5 17 * * *', $$select public.proses_nonaktif_terjadwal()$$); -- 00:05 WIB

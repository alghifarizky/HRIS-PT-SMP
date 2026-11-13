-- Fase 2 langkah 2.4c: aturan atasan & perubahan peran (keputusan Al, 13 Nov 2026).
--   • Atasan langsung seorang Karyawan harus pengguna AKTIF berperan Atasan (dicek saat insert, atau saat
--     atasan_id / peran berubah — data lama yang tidak disentuh tidak ikut diblokir).
--   • Atasan tidak bisa diubah perannya atau dinonaktifkan selama masih membawahi Karyawan aktif.

create function public.validasi_atasan()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  jumlah integer;
begin
  if new.role = 'karyawan' and new.atasan_id is not null
     and (tg_op = 'INSERT' or new.atasan_id is distinct from old.atasan_id or new.role is distinct from old.role)
     and not exists (select 1 from public.pengguna a where a.id = new.atasan_id and a.aktif and a.role = 'atasan') then
    raise exception 'Atasan langsung harus pengguna aktif berperan Atasan' using errcode = '23514';
  end if;

  if tg_op = 'UPDATE' and old.role = 'atasan' and (new.role <> 'atasan' or (old.aktif and not new.aktif)) then
    select count(*) into jumlah from public.pengguna b where b.atasan_id = new.id and b.aktif and b.role = 'karyawan';
    if jumlah > 0 then
      raise exception '% masih membawahi % karyawan. Pindahkan dulu ke atasan lain.', new.nama, jumlah
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

-- Nama diawali "pengguna_validasi" agar berjalan SETELAH pengguna_jaga_perubahan (urutan abjad):
-- pelanggaran wewenang (42501) dilaporkan lebih dulu daripada pelanggaran data.
create trigger pengguna_validasi_atasan
  before insert or update on public.pengguna
  for each row execute function public.validasi_atasan();

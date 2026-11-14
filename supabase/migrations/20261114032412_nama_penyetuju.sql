-- Nama & jabatan penyetuju disimpan saat keputusan (pola dikoreksi_oleh_nama di absensi): pengaju tidak berhak
-- membaca baris pengguna lain, tetapi alur persetujuan di detail pengajuan (B1 hal 37–38) menampilkannya.
alter table public.persetujuan
  add column penyetuju_nama text,
  add column penyetuju_jabatan text;

create function public.isi_nama_penyetuju()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select nama, jabatan into new.penyetuju_nama, new.penyetuju_jabatan from public.pengguna where id = new.penyetuju_id;
  return new;
end;
$$;
revoke execute on function public.isi_nama_penyetuju() from public, anon, authenticated;

create trigger persetujuan_nama_penyetuju before insert on public.persetujuan
  for each row execute function public.isi_nama_penyetuju();

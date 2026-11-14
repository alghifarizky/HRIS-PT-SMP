-- Fase 3 langkah 3.5: data anggota tim untuk Atasan (ATT-08; desain B2 hal 23–30; security §4.4).
-- RLS pengguna hanya membuka baris sendiri bagi Atasan (tabel memuat gaji & KTP). RPC ini memberi data
-- publik terbatas bawahan LANGSUNG pemanggil saja — tanpa gaji, KTP, alamat, tanggal lahir.

create function public.anggota_tim()
returns table (
  id uuid,
  nama text,
  nik text,
  jabatan text,
  tanggal_masuk date,
  aktif boolean,
  tanggal_nonaktif date
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.nama, p.nik, p.jabatan, p.tanggal_masuk, p.aktif, p.tanggal_nonaktif
  from public.pengguna p
  where p.atasan_id = auth.uid()
    and public.peran_saya() is not null
  order by p.nama;
$$;

revoke execute on function public.anggota_tim() from public, anon;
grant execute on function public.anggota_tim() to authenticated;

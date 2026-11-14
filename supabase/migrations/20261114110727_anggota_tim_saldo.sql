-- Fase 4.3: Atasan melihat sisa saldo cuti bawahan langsung saat menyetujui cuti (desain B2 hal 19;
-- keputusan Al 14 Nov 2026). Gaji, KTP, alamat, tanggal lahir tetap tertutup. Kolom tipe kembalian berubah → drop & buat ulang.
drop function public.anggota_tim();

create function public.anggota_tim()
returns table (
  id uuid,
  nama text,
  nik text,
  jabatan text,
  tanggal_masuk date,
  aktif boolean,
  tanggal_nonaktif date,
  saldo_cuti integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.nama, p.nik, p.jabatan, p.tanggal_masuk, p.aktif, p.tanggal_nonaktif, p.saldo_cuti
  from public.pengguna p
  where p.atasan_id = auth.uid()
    and public.peran_saya() is not null
  order by p.nama;
$$;

revoke execute on function public.anggota_tim() from public, anon;
grant execute on function public.anggota_tim() to authenticated;

-- Fase 2 langkah 2.4d: status login & login terakhir untuk halaman detail karyawan (B3A hal 14).
-- auth.users tidak bisa dibaca client → RPC security definer, hanya HR & Direksi.
-- sudah_aktif = undangan sudah dipakai (email terkonfirmasi) — sama dengan syarat "kirim ulang" di Edge Function akun.

create function public.info_login(target uuid)
returns table (sudah_aktif boolean, login_terakhir timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if coalesce(public.peran_saya(), '') not in ('hr', 'direksi') then
    raise exception 'Hanya HR dan Direksi' using errcode = '42501';
  end if;
  return query
    select u.email_confirmed_at is not null, u.last_sign_in_at from auth.users u where u.id = target;
end;
$$;

revoke execute on function public.info_login(uuid) from public, anon;
grant execute on function public.info_login(uuid) to authenticated;

-- Fase 3 langkah 3.3: jam server untuk layar kamera ("waktu server WIB", desain B1 hal 15).
-- Client menghitung selisih sekali lalu berdetik sendiri; jam yang TERCATAT tetap now() di RPC clock_in/out.
create function public.waktu_server()
returns timestamptz
language sql
stable
set search_path = ''
as $$ select now(); $$;

revoke execute on function public.waktu_server() from public, anon;
grant execute on function public.waktu_server() to authenticated;

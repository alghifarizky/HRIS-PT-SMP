-- Fase 3 langkah 3.7: retensi selfie 12 bulan (PRD ATT-10, security §5) + foto yatim (keputusan Al, 14 Nov 2026).
-- File Storage tidak bisa dihapus lewat SQL (hanya catatannya) → Edge Function `bersihkan-selfie` menghapus lewat
-- Storage API. Job pg_cron bulanan memanggilnya lewat pg_net dengan kunci acak yang DIBANGKITKAN di database dan
-- disimpan di Vault — tidak ada di repo. Data jam absensi tetap; hanya path foto dikosongkan.

create extension if not exists pg_net with schema extensions;

-- Kunci job: acak, dibuat sekali per database (lokal & production berbeda), hanya di Vault
select vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'kunci_job_bersihkan_selfie',
  'Kunci pemanggilan Edge Function bersihkan-selfie oleh pg_cron')
where not exists (select 1 from vault.secrets where name = 'kunci_job_bersihkan_selfie');

/** Dipakai Edge Function untuk memeriksa header x-kunci-job. Hanya service_role. */
create function public.cek_kunci_job(kunci text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select decrypted_secret = kunci from vault.decrypted_secrets where name = 'kunci_job_bersihkan_selfie'), false);
$$;

/** Absensi berumur > 12 bulan (WIB) yang masih punya path foto. */
create function public.selfie_kedaluwarsa()
returns table (id uuid, foto_masuk_path text, foto_keluar_path text)
language sql
stable
security definer
set search_path = ''
as $$
  select a.id, a.foto_masuk_path, a.foto_keluar_path
  from public.absensi a
  where a.tanggal < ((now() at time zone 'Asia/Jakarta')::date - interval '12 months')
    and (a.foto_masuk_path is not null or a.foto_keluar_path is not null);
$$;

/** Foto di bucket selfie berumur > 2 hari yang tidak dirujuk absensi mana pun (upload yang clock in-nya gagal). */
create function public.selfie_yatim()
returns setof text
language sql
stable
security definer
set search_path = ''
as $$
  select o.name
  from storage.objects o
  where o.bucket_id = 'selfie'
    and o.created_at < now() - interval '2 days'
    and not exists (select 1 from public.absensi a where a.foto_masuk_path = o.name or a.foto_keluar_path = o.name);
$$;

revoke execute on function public.cek_kunci_job(text), public.selfie_kedaluwarsa(), public.selfie_yatim()
  from public, anon, authenticated;
grant execute on function public.cek_kunci_job(text), public.selfie_kedaluwarsa(), public.selfie_yatim() to service_role;

/** Dipanggil pg_cron: kirim permintaan ke Edge Function. URL fungsi project production (ref bukan rahasia). */
create function public.panggil_bersihkan_selfie()
returns bigint
language sql
security definer
set search_path = ''
as $$
  select net.http_post(
    url := 'https://weqqkcykyqwexagegstw.supabase.co/functions/v1/bersihkan-selfie',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-kunci-job', (select decrypted_secret from vault.decrypted_secrets where name = 'kunci_job_bersihkan_selfie')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
$$;
revoke execute on function public.panggil_bersihkan_selfie() from public, anon, authenticated;

-- Bulanan: 18:00 UTC tanggal 1 = 01:00 WIB tanggal 2 ("01:00 WIB tanggal 1" jatuh di hari terakhir bulan UTC —
-- tidak bisa dinyatakan cron). Selisih sehari tak berpengaruh untuk retensi 12 bulan.
select cron.schedule('bersihkan-selfie', '0 18 1 * *', $$select public.panggil_bersihkan_selfie()$$);

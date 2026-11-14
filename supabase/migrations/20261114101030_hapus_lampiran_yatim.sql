-- Pemilik boleh menghapus lampirannya sendiri selama belum dipakai pengajuan (Fase 4.2c, keputusan Al 14 Nov 2026):
-- lampiran diunggah sebelum RPC ajukan_cuti; bila pengajuan ditolak server, aplikasi menghapus file yatim itu.
create policy lampiran_hapus_yatim on storage.objects for delete to authenticated
  using (bucket_id = 'lampiran' and (storage.foldername(name))[1] = (select auth.uid())::text
         and not exists (select 1 from public.pengajuan_cuti c where c.lampiran_path = objects.name));

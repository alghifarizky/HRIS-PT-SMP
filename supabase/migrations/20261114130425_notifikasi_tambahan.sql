-- Fase 4.5b: notifikasi tambahan sesuai desain (B1 hal 45, B2 hal 2; keputusan Al 14 Nov 2026):
--   • Auto clock out tercatat → karyawan;  • Absensi dikoreksi HR → karyawan;
--   • Pengajuan dibatalkan pengaju → penyetuju yang sedang menunggu.

alter table public.notifikasi drop constraint notifikasi_jenis_objek_check;
alter table public.notifikasi add constraint notifikasi_jenis_objek_check check (jenis_objek in ('lembur', 'cuti', 'absensi'));

/** "Jumat, 6 Nov 2026" (dengan_tahun=false → "Jumat, 6 Nov") — label tanggal Indonesia untuk teks notifikasi. */
create function public.label_tanggal(d date, dengan_tahun boolean default true)
returns text
language sql
immutable
set search_path = ''
as $$
  select (array['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'])[extract(dow from d)::int + 1] || ', '
    || extract(day from d)::int || ' '
    || (array['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'])[extract(month from d)::int]
    || case when dengan_tahun then ' ' || extract(year from d)::int else '' end;
$$;

create function public.kabari_perubahan_absensi()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  jam   text := 'HH24:MI';
  masuk text := to_char(new.jam_masuk at time zone 'Asia/Jakarta', jam);
  keluar text := to_char(new.jam_keluar at time zone 'Asia/Jakarta', jam);
  tgl   text := public.label_tanggal(new.tanggal, false);
  ubah_masuk boolean;
  ubah_keluar boolean;
begin
  -- Koreksi / tambah manual oleh HR (jaga_absensi mengisi dikoreksi_pada) — bukan oleh pemilik sendiri
  if new.dikoreksi_pada is not null and (tg_op = 'INSERT' or new.dikoreksi_pada is distinct from old.dikoreksi_pada)
     and new.dikoreksi_oleh is distinct from new.pengguna_id then
    if tg_op = 'INSERT' then
      perform public.kirim_notifikasi(new.pengguna_id, 'Absensi dikoreksi HR',
        format('Absensi %s ditambahkan %s: %s–%s WIB.', tgl, coalesce(new.dikoreksi_oleh_nama, 'HR'), masuk, keluar), 'absensi', new.id);
    else
      ubah_masuk := new.jam_masuk is distinct from old.jam_masuk;
      ubah_keluar := new.jam_keluar is distinct from old.jam_keluar;
      perform public.kirim_notifikasi(new.pengguna_id, 'Absensi dikoreksi HR',
        case
          when ubah_masuk and ubah_keluar then format('Jam masuk & keluar %s dikoreksi menjadi %s–%s WIB.', tgl, masuk, keluar)
          when ubah_masuk then format('Jam masuk %s dikoreksi menjadi %s WIB.', tgl, masuk)
          when ubah_keluar then format('Jam keluar %s dikoreksi menjadi %s WIB.', tgl, coalesce(keluar, '—'))
          else format('Catatan koreksi absensi %s diperbarui.', tgl)
        end, 'absensi', new.id);
    end if;
  -- Auto clock out oleh job malam (bukan koreksi)
  elsif tg_op = 'UPDATE' and new.auto_clock_out and not old.auto_clock_out then
    perform public.kirim_notifikasi(new.pengguna_id, 'Auto clock out tercatat',
      format('Anda belum clock out pada %s. Jam keluar diisi otomatis %s WIB sesuai jam pulang.', tgl, keluar), 'absensi', new.id);
  end if;
  return null;
end;
$$;
revoke execute on function public.kabari_perubahan_absensi() from public, anon, authenticated;

create trigger absensi_kabari after insert or update on public.absensi
  for each row execute function public.kabari_perubahan_absensi();

-- Batalkan: kabari penyetuju tingkat yang sedang menunggu (B2 hal 2 "Pengajuan dibatalkan")
create or replace function public.batalkan_pengajuan(jenis text, pengajuan uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r     record;
  nama  text;
  label text;
begin
  if jenis = 'lembur' then
    select pengguna_id, tingkat_berikut, 'lembur'::text as label, public.label_tanggal(tanggal) as tgl into r
    from public.pengajuan_lembur where id = pengajuan and pengguna_id = auth.uid() and status = 'menunggu' for update;
  elsif jenis = 'cuti' then
    select pengguna_id, tingkat_berikut, c.jenis::text as label,
           public.label_tanggal(tanggal_mulai) || case when tanggal_selesai <> tanggal_mulai then ' – ' || public.label_tanggal(tanggal_selesai) else '' end as tgl
    into r from public.pengajuan_cuti c where id = pengajuan and pengguna_id = auth.uid() and status = 'menunggu' for update;
  else
    raise exception 'Jenis pengajuan tidak dikenal' using errcode = '22023';
  end if;
  if not found then
    raise exception 'Pengajuan tidak dapat dibatalkan (bukan milik Anda atau sudah diproses)' using errcode = '23514';
  end if;

  if jenis = 'lembur' then
    update public.pengajuan_lembur set status = 'dibatalkan', tingkat_berikut = null, selesai_pada = now() where id = pengajuan;
  else
    update public.pengajuan_cuti set status = 'dibatalkan', tingkat_berikut = null, selesai_pada = now() where id = pengajuan;
  end if;

  select p.nama into nama from public.pengguna p where p.id = r.pengguna_id;
  label := r.label;
  perform public.kabari_penyetuju(r.pengguna_id, r.tingkat_berikut, 'Pengajuan dibatalkan',
    format('Pengajuan %s %s (%s) dibatalkan oleh pengaju.', label, nama, r.tgl), jenis, pengajuan);
end;
$$;

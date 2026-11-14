// OT-04, LV-06 — Detail pengajuan sendiri + alur persetujuan (B1 hal 37 menunggu, 38 disetujui, 39 konfirmasi batal).
// Tingkat yang belum diputuskan menampilkan peran penyetuju (nama baru tersimpan saat keputusan).
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useProfil } from '../../auth/sesi'
import { dariTanggalDb, tanggalPanjang } from '../../lib/format'
import { durasiJam, LABEL_JENIS_CUTI, LABEL_STATUS, NADA_STATUS, rentangTanggal } from '../../lib/pengajuan'
import { Badge, KeadaanGalat, KeadaanKosong, Skeleton } from '../../komponen/keadaan'
import { BannerGalat, Tombol } from '../../komponen/form'
import Dialog from '../../komponen/Dialog'
import { useToast } from '../../komponen/toast'
import { useBatalkan, useDetailPengajuan, type Cuti, type JenisPengajuan, type Lembur } from './data'
import { AlurPersetujuan, Baris, Lampiran, tingkatPersetujuan } from './bagian'

export default function DetailPengajuan() {
  const { jenis: j, id } = useParams()
  const jenis: JenisPengajuan = j === 'cuti' ? 'cuti' : 'lembur'
  const profil = useProfil().data!
  const q = useDetailPengajuan(jenis, id!)
  const [konfirmasi, setKonfirmasi] = useState(false)
  if (q.isPending) return <Skeleton baris={6} />
  if (q.isError) return <KeadaanGalat judul="Detail pengajuan gagal dimuat" onCobaLagi={() => q.refetch()} />
  const p = q.data
  if (!p) return <KeadaanKosong judul="Pengajuan tidak ditemukan" pesan="Pengajuan ini tidak ada atau bukan milik Anda." />

  const lembur = jenis === 'lembur' ? (p as Lembur) : null
  const cuti = jenis === 'cuti' ? (p as Cuti) : null
  const penyetuju = tingkatPersetujuan(profil.role).map((t) => t.peran).join(' dan ')
  const ringkas = lembur
    ? `lembur ${tanggalPanjang(dariTanggalDb(lembur.tanggal))} (${durasiJam(lembur.jam_mulai, lembur.jam_selesai)})`
    : `${LABEL_JENIS_CUTI[cuti!.jenis].toLowerCase()} ${rentangTanggal(cuti!.tanggal_mulai, cuti!.tanggal_selesai)} (${cuti!.jumlah_hari} hari${cuti!.jenis === 'cuti' ? ' kerja' : ''})`

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-kartu border border-garis bg-permukaan p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-teks-sekunder tabular-nums">{p.nomor}</p>
            <h2 className="text-[22px] leading-7 font-semibold">{lembur ? 'Lembur' : LABEL_JENIS_CUTI[cuti!.jenis]}</h2>
          </div>
          <Badge nada={NADA_STATUS[p.status]}>{LABEL_STATUS[p.status]}</Badge>
        </div>
        <dl className="mt-3 flex flex-col gap-2 text-[15px]">
          {lembur ? (
            <>
              <Baris label="Tanggal">{tanggalPanjang(dariTanggalDb(lembur.tanggal))}{lembur.hari_libur && <span className="font-normal text-teks-sekunder"> · hari libur</span>}</Baris>
              <Baris label="Jam">{lembur.jam_mulai.slice(0, 5)} – {lembur.jam_selesai.slice(0, 5)} WIB · {durasiJam(lembur.jam_mulai, lembur.jam_selesai)}</Baris>
            </>
          ) : (
            <>
              <Baris label="Tanggal">{rentangTanggal(cuti!.tanggal_mulai, cuti!.tanggal_selesai, true)}</Baris>
              <Baris label="Jumlah">{cuti!.jumlah_hari} hari kerja</Baris>
            </>
          )}
          <Baris label="Alasan"><span className="whitespace-pre-line">{p.alasan}</span></Baris>
          {cuti && <Baris label="Lampiran"><Lampiran path={cuti.lampiran_path} /></Baris>}
        </dl>
      </section>

      <AlurPersetujuan p={p} pengaju={profil} batalOleh="Oleh Anda" />

      {p.status === 'menunggu' ? (
        <Tombol varian="bahayaGaris" onClick={() => setKonfirmasi(true)}>Batalkan pengajuan</Tombol>
      ) : (
        <p className="text-center text-[15px] text-teks-sekunder">Pengajuan yang sudah diproses tidak dapat dibatalkan.</p>
      )}
      {konfirmasi && <DialogBatal jenis={jenis} id={p.id} ringkas={ringkas} penyetuju={penyetuju} onTutup={() => setKonfirmasi(false)} />}
    </div>
  )
}

function DialogBatal({ jenis, id, ringkas, penyetuju, onTutup }: { jenis: JenisPengajuan; id: string; ringkas: string; penyetuju: string; onTutup: () => void }) {
  const m = useBatalkan(jenis, id)
  const toast = useToast()
  const navigate = useNavigate()
  return (
    <Dialog judul="Batalkan pengajuan ini?" onTutup={onTutup}>
      <p className="text-[15px] leading-[22px]">
        Pengajuan {ringkas} akan dibatalkan. {penyetuju} tidak akan memprosesnya lagi, dan tindakan ini tidak bisa dikembalikan.
      </p>
      {m.isError && <div className="mt-3"><BannerGalat>{m.error.message}</BannerGalat></div>}
      <div className="mt-5 flex flex-col gap-2">
        <Tombol varian="bahaya" memproses={m.isPending}
          onClick={() => m.mutate(undefined, { onSuccess: () => { toast('Pengajuan dibatalkan.'); navigate(`/pengajuan${jenis === 'cuti' ? '?tab=cuti' : ''}`) } })}>
          Ya, batalkan pengajuan
        </Tombol>
        <Tombol varian="sekunder" onClick={onTutup} disabled={m.isPending}>Tidak, kembali</Tombol>
      </div>
    </Dialog>
  )
}

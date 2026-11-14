// OT-04, LV-06 — Detail pengajuan sendiri + alur persetujuan (B1 hal 37 menunggu, 38 disetujui, 39 konfirmasi batal).
// Tingkat yang belum diputuskan menampilkan peran penyetuju (nama baru tersimpan saat keputusan).
import { useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Check, ChevronLeft, Clock, X } from 'lucide-react'
import { useProfil } from '../../auth/sesi'
import { dariTanggalDb, tanggalPanjang, waktuSingkat } from '../../lib/format'
import { durasiJam, LABEL_JENIS_CUTI, LABEL_STATUS, NADA_STATUS, rentangTanggal } from '../../lib/pengajuan'
import { Badge, KeadaanGalat, KeadaanKosong, Skeleton } from '../../komponen/keadaan'
import { BannerGalat, Tombol } from '../../komponen/form'
import Dialog from '../../komponen/Dialog'
import { useToast } from '../../komponen/toast'
import { useBatalkan, useDetailPengajuan, useLampiran, type Cuti, type JenisPengajuan, type Lembur, type Persetujuan } from './data'

export default function DetailPengajuan() {
  const { jenis: j, id } = useParams()
  const jenis: JenisPengajuan = j === 'cuti' ? 'cuti' : 'lembur'
  const profil = useProfil().data!
  const q = useDetailPengajuan(jenis, id!)
  const [konfirmasi, setKonfirmasi] = useState(false)
  const kembali = (
    <Link to={`/pengajuan${jenis === 'cuti' ? '?tab=cuti' : ''}`} className="fokus-ring -ml-2 inline-flex min-h-11 items-center gap-1 rounded-kontrol px-2 text-[15px] font-semibold text-primer">
      <ChevronLeft className="size-5" aria-hidden /> Pengajuan
    </Link>
  )
  if (q.isPending) return <>{kembali}<Skeleton baris={6} /></>
  if (q.isError) return <>{kembali}<KeadaanGalat judul="Detail pengajuan gagal dimuat" onCobaLagi={() => q.refetch()} /></>
  const p = q.data
  if (!p) return <>{kembali}<KeadaanKosong judul="Pengajuan tidak ditemukan" pesan="Pengajuan ini tidak ada atau bukan milik Anda." /></>

  const lembur = jenis === 'lembur' ? (p as Lembur) : null
  const cuti = jenis === 'cuti' ? (p as Cuti) : null
  // Karyawan: Atasan → HR. Atasan/HR: Direksi (satu tingkat) — PRD §6.1
  const tingkat = profil.role === 'karyawan' ? [{ n: 1, peran: 'Atasan' }, { n: 2, peran: 'HR' }] : [{ n: 1, peran: 'Direksi' }]
  const penyetuju = tingkat.map((t) => t.peran).join(' dan ')
  const ringkas = lembur
    ? `lembur ${tanggalPanjang(dariTanggalDb(lembur.tanggal))} (${durasiJam(lembur.jam_mulai, lembur.jam_selesai)})`
    : `${LABEL_JENIS_CUTI[cuti!.jenis].toLowerCase()} ${rentangTanggal(cuti!.tanggal_mulai, cuti!.tanggal_selesai)} (${cuti!.jumlah_hari} hari${cuti!.jenis === 'cuti' ? ' kerja' : ''})`

  return (
    <div className="flex flex-col gap-4">
      {kembali}
      <section className="rounded-kartu border border-garis bg-permukaan p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-teks-sekunder tabular-nums">{p.nomor}</p>
            <h1 className="text-[22px] leading-7 font-semibold">{lembur ? 'Lembur' : LABEL_JENIS_CUTI[cuti!.jenis]}</h1>
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

      <section className="rounded-kartu border border-garis bg-permukaan p-4">
        <h2 className="text-[17px] font-semibold">Alur persetujuan</h2>
        <ol className="mt-3">
          <Langkah ikon="selesai" judul="Diajukan" garis>
            <p>{profil.nama}</p>
            <p className="text-sm text-teks-sekunder">{waktuSingkat(new Date(p.diajukan_pada))} WIB</p>
          </Langkah>
          {tingkat.map((t, i) => {
            const k = p.persetujuan.find((x) => x.tingkat === t.n)
            const terakhir = i === tingkat.length - 1 && p.status !== 'dibatalkan'
            return k ? <LangkahKeputusan key={t.n} k={k} label={`Tingkat ${t.n} · ${t.peran}`} garis={!terakhir} />
              : (
                <Langkah key={t.n} ikon={p.status === 'menunggu' && p.tingkat_berikut === t.n ? 'menunggu' : String(i + 2)} judul={`Tingkat ${t.n} · ${t.peran}`} garis={!terakhir}>
                  {p.status === 'menunggu' && p.tingkat_berikut === t.n
                    ? <p className="text-sm text-peringatan">Menunggu persetujuan</p>
                    : <p className="text-sm text-teks-sekunder">{p.status === 'menunggu' ? 'Belum diproses' : 'Tidak diproses'}</p>}
                </Langkah>
              )
          })}
          {p.status === 'dibatalkan' && (
            <Langkah ikon="batal" judul="Dibatalkan">
              <p className="text-sm text-teks-sekunder">Oleh Anda{p.selesai_pada && ` · ${waktuSingkat(new Date(p.selesai_pada))} WIB`}</p>
            </Langkah>
          )}
        </ol>
      </section>

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

function Lampiran({ path }: { path: string | null }) {
  const url = useLampiran(path)
  if (!path) return <>Tidak ada</>
  if (url.isError) return <span className="text-bahaya">Gagal dimuat</span>
  if (!url.data) return <span className="text-teks-sekunder">Memuat…</span>
  return <a href={url.data} target="_blank" rel="noreferrer" className="fokus-ring rounded text-primer underline">Lihat lampiran</a>
}

function LangkahKeputusan({ k, label, garis }: { k: Persetujuan; label: string; garis: boolean }) {
  const setuju = k.keputusan === 'disetujui'
  return (
    <Langkah ikon={setuju ? 'selesai' : 'tolak'} judul={`${label} — ${setuju ? 'Disetujui' : 'Ditolak'}`} garis={garis}>
      <p>{[k.penyetuju_nama, k.penyetuju_jabatan].filter(Boolean).join(', ')}</p>
      <p className="text-sm text-teks-sekunder">{waktuSingkat(new Date(k.diputuskan_pada))} WIB</p>
      {k.catatan && <p className="mt-2 rounded-kontrol bg-latar p-3 text-[15px]">“{k.catatan}”</p>}
    </Langkah>
  )
}

function Langkah({ ikon, judul, garis, children }: { ikon: string; judul: string; garis?: boolean; children: ReactNode }) {
  const bulat =
    ikon === 'selesai' ? <span className="flex size-8 items-center justify-center rounded-full bg-sukses-ikon text-white"><Check className="size-4" /></span>
    : ikon === 'tolak' ? <span className="flex size-8 items-center justify-center rounded-full bg-bahaya-ikon text-white"><X className="size-4" /></span>
    : ikon === 'menunggu' ? <span className="flex size-8 items-center justify-center rounded-full bg-peringatan-latar text-peringatan"><Clock className="size-4" /></span>
    : ikon === 'batal' ? <span className="flex size-8 items-center justify-center rounded-full bg-latar text-teks-sekunder"><X className="size-4" /></span>
    : <span className="flex size-8 items-center justify-center rounded-full border-2 border-garis text-sm font-semibold text-teks-sekunder">{ikon}</span>
  return (
    <li className="flex gap-3">
      <div className="flex flex-col items-center" aria-hidden>
        {bulat}
        {garis && <span className={`w-0.5 flex-1 ${ikon === 'selesai' ? 'bg-sukses-ikon/40' : 'bg-garis'}`} />}
      </div>
      <div className="min-w-0 flex-1 pb-5 text-[15px]">
        <p className="font-semibold">{judul}</p>
        {children}
      </div>
    </li>
  )
}

function Baris({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[96px_1fr] gap-3">
      <dt className="text-teks-sekunder">{label}</dt>
      <dd className="font-semibold">{children}</dd>
    </div>
  )
}

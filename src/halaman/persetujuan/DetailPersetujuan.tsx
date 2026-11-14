// APR-02 — Detail persetujuan Atasan (B2 hal 11 lembur hari kerja, 12 hari libur, 13/14 sheet setujui/tolak,
// 15 gagal simpan, 16 dibatalkan pengaju, 19 cuti + bentrok tim, 20 sakit + lampiran).
import { useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router'
import { CircleAlert, Info } from 'lucide-react'
import { useProfil } from '../../auth/sesi'
import { dariTanggalDb, hariIniDb, inisial, tanggalPanjang, tanggalSingkat, waktuSingkat } from '../../lib/format'
import { jamWib } from '../../lib/absensi'
import { durasiJam, LABEL_JENIS_CUTI, LABEL_STATUS, NADA_STATUS, rentangTanggal, ringkasCuti, teksDurasi } from '../../lib/pengajuan'
import { Badge, KeadaanGalat, KeadaanKosong, Skeleton } from '../../komponen/keadaan'
import { BannerGalat, Tombol } from '../../komponen/form'
import Dialog from '../../komponen/Dialog'
import { useToast } from '../../komponen/toast'
import { useAnggotaTim } from '../absensi/data'
import { useDetailPengajuan, type Cuti, type JenisPengajuan, type Lembur } from '../pengajuan/data'
import { AlurPersetujuan, Baris, Lampiran } from '../pengajuan/bagian'
import { useKonteksPersetujuan, usePutuskan } from './data'

const menitDari = (j: string) => Number(j.slice(0, 2)) * 60 + Number(j.slice(3, 5))

export default function DetailPersetujuan() {
  const { jenis: j, id } = useParams()
  const jenis: JenisPengajuan = j === 'cuti' ? 'cuti' : 'lembur'
  const saya = useProfil().data!
  const q = useDetailPengajuan(jenis, id!)
  const tim = useAnggotaTim()
  const p = q.data
  const lembur = p && jenis === 'lembur' ? (p as Lembur) : null
  const cuti = p && jenis === 'cuti' ? (p as Cuti) : null
  const konteks = useKonteksPersetujuan(p ? { jenis, pengguna_id: p.pengguna_id, mulai: lembur?.tanggal ?? cuti!.tanggal_mulai, selesai: lembur?.tanggal ?? cuti!.tanggal_selesai } : null)
  const [lembar, setLembar] = useState<'disetujui' | 'ditolak' | null>(null)

  if (q.isPending || tim.isPending) return <Skeleton baris={6} />
  if (q.isError || tim.isError) return <KeadaanGalat judul="Detail persetujuan gagal dimuat" onCobaLagi={() => (q.refetch(), tim.refetch())} />
  const pengaju = p && tim.data.find((a) => a.id === p.pengguna_id)
  if (!p || !pengaju) return <KeadaanKosong judul="Pengajuan tidak ditemukan" pesan="Pengajuan ini tidak ada atau bukan dari anggota tim Anda." />

  const giliran = p.status === 'menunggu' && p.tingkat_berikut === 1
  const label = lembur ? 'Lembur' : LABEL_JENIS_CUTI[cuti!.jenis]
  const ringkas = lembur
    ? `${tanggalSingkat(dariTanggalDb(lembur.tanggal))} · ${lembur.jam_mulai.slice(0, 5)} – ${lembur.jam_selesai.slice(0, 5)} · ${durasiJam(lembur.jam_mulai, lembur.jam_selesai)}`
    : `${rentangTanggal(cuti!.tanggal_mulai, cuti!.tanggal_selesai, true)} · ${cuti!.jumlah_hari} hari kerja`
  const k = konteks.data

  return (
    <div className={`flex flex-col gap-4 ${giliran ? 'pb-20' : ''}`}>
      {p.status === 'dibatalkan' && (
        <p className="flex gap-3 rounded-kartu bg-latar p-4 text-[15px] leading-[22px] text-teks-sekunder ring-1 ring-garis">
          <Info className="mt-0.5 size-5 shrink-0" aria-hidden />
          <span><strong className="text-teks">Pengajuan ini dibatalkan oleh pengaju.</strong>{p.selesai_pada && ` ${waktuSingkat(new Date(p.selesai_pada))} WIB.`} Tidak ada tindakan yang diperlukan.</span>
        </p>
      )}

      <section className="rounded-kartu border border-garis bg-permukaan p-4">
        <div className="flex items-start gap-3">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primer-100 font-semibold text-primer" aria-hidden>{inisial(pengaju.nama)}</span>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[17px] font-semibold">{pengaju.nama}</h2>
            <p className="truncate text-sm text-teks-sekunder">{pengaju.jabatan ?? '—'}</p>
          </div>
          <Badge nada={NADA_STATUS[p.status]}>{LABEL_STATUS[p.status]}</Badge>
        </div>
        <p className="mt-3 border-b border-garis pb-3 text-sm text-teks-sekunder">
          <span className="tabular-nums">{p.nomor}</span>
          {p.status === 'menunggu' && ` · Menunggu persetujuan Tingkat ${p.tingkat_berikut}${giliran ? ' (Anda)' : ''}`}
        </p>
        <dl className="mt-3 flex flex-col gap-2 text-[15px]">
          <Baris label="Jenis">{label}</Baris>
          {lembur ? (
            <>
              <Baris label="Tanggal">
                {tanggalPanjang(dariTanggalDb(lembur.tanggal))}{' '}
                {lembur.tanggal === hariIniDb() ? <Tanda>Hari ini</Tanda> : lembur.hari_libur && <Tanda>Hari libur</Tanda>}
              </Baris>
              <Baris label="Jam">{lembur.jam_mulai.slice(0, 5)} – {lembur.jam_selesai.slice(0, 5)} WIB</Baris>
              <Baris label="Durasi">{teksDurasi(menitDari(lembur.jam_selesai) - menitDari(lembur.jam_mulai))}</Baris>
            </>
          ) : (
            <>
              <Baris label="Tanggal">{rentangTanggal(cuti!.tanggal_mulai, cuti!.tanggal_selesai, true)}</Baris>
              <Baris label="Jumlah">
                {cuti!.jumlah_hari} hari kerja
                {k?.kalender && (() => {
                  const t = ringkasCuti(cuti!.tanggal_mulai, cuti!.tanggal_selesai, k.kalender).tidakDihitung
                  return <span className="block text-sm font-normal text-teks-sekunder">{t.length ? `Tidak dihitung: ${t.join(', ')}` : 'Senin–Sabtu, tanpa tanggal merah'}</span>
                })()}
              </Baris>
            </>
          )}
          <Baris label="Alasan"><span className="whitespace-pre-line">{p.alasan}</span></Baris>
        </dl>
      </section>

      {lembur && k && (
        <dl className="divide-y divide-garis rounded-kartu border border-garis bg-permukaan px-4 text-[15px]">
          <div className="flex items-center justify-between gap-3 py-3">
            <dt className="text-teks-sekunder">Jadwal kerja hari itu</dt>
            <dd className="font-semibold">{k.jadwal ? `${k.jadwal.jam_masuk.slice(0, 5)} – ${k.jadwal.jam_pulang.slice(0, 5)} WIB` : 'Libur'}</dd>
          </div>
          <div className="flex items-center justify-between gap-3 py-3">
            <dt className="text-teks-sekunder">Clock in pengaju</dt>
            <dd className="flex items-center gap-2 font-semibold">
              {k.absensi ? <>{jamWib(new Date(k.absensi.jam_masuk))} WIB {k.absensi.terlambat ? <Badge nada="peringatan">Terlambat</Badge> : <Badge nada="sukses">Tepat waktu</Badge>}</>
                : lembur.tanggal > hariIniDb() ? <span className="font-normal text-teks-sekunder">Belum ada · tanggal mendatang</span>
                : <span className="font-normal text-teks-sekunder">Belum ada</span>}
            </dd>
          </div>
        </dl>
      )}

      {cuti?.jenis === 'cuti' && pengaju.saldo_cuti != null && (
        <dl className="grid grid-cols-2 divide-x divide-garis rounded-kartu border border-garis bg-permukaan">
          <div className="px-4 py-3">
            <dt className="text-sm text-teks-sekunder">Sisa saldo cuti</dt>
            <dd className="text-[22px] font-bold tabular-nums">{pengaju.saldo_cuti} hari</dd>
          </div>
          <div className="px-4 py-3">
            <dt className="text-sm text-teks-sekunder">Setelah disetujui</dt>
            <dd className={`text-[22px] font-bold tabular-nums ${pengaju.saldo_cuti < cuti.jumlah_hari ? 'text-bahaya' : ''}`}>
              {p.status === 'disetujui' ? pengaju.saldo_cuti : pengaju.saldo_cuti - cuti.jumlah_hari} hari
            </dd>
          </div>
        </dl>
      )}

      {!!k?.bentrok.length && (
        <p className="flex gap-3 rounded-kartu bg-peringatan-latar p-4 text-[15px] leading-[22px] text-peringatan">
          <CircleAlert className="mt-0.5 size-5 shrink-0" aria-hidden />
          <span>
            <strong>{k.bentrok.length} anggota tim juga cuti/sakit/izin di tanggal yang sama.</strong>{' '}
            {k.bentrok.map((b) => `${b.anggota.nama}${b.anggota.jabatan ? `, ${b.anggota.jabatan}` : ''} · ${b.jenis} ${rentangTanggal(b.tanggal_mulai, b.tanggal_selesai)} (${b.status})`).join('; ')}.
          </span>
        </p>
      )}

      {cuti && (
        <section className="rounded-kartu border border-garis bg-permukaan p-4">
          <h2 className="text-[17px] font-semibold">Lampiran</h2>
          <p className="mt-1 text-[15px]">{cuti.lampiran_path ? <Lampiran path={cuti.lampiran_path} /> : <span className="text-teks-sekunder">Tidak ada lampiran.</span>}</p>
        </section>
      )}

      <AlurPersetujuan p={p} pengaju={{ nama: pengaju.nama, role: 'karyawan' }} batalOleh="Oleh pengaju" saya={{ tingkat: 1, nama: saya.nama, jabatan: saya.jabatan }} />

      {giliran && (
        <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-10 border-t border-garis bg-permukaan">
          <div className="mx-auto grid max-w-[480px] grid-cols-2 gap-3 px-4 py-3">
            <Tombol varian="bahayaGaris" onClick={() => setLembar('ditolak')}>Tolak</Tombol>
            <Tombol onClick={() => setLembar('disetujui')}>Setujui</Tombol>
          </div>
        </div>
      )}
      {lembar && (
        <LembarKeputusan jenis={jenis} id={p.id} putusan={lembar} judul={`${pengaju.nama} · ${label}`} ringkas={ringkas}
          labelJenis={lembur ? 'lembur' : LABEL_JENIS_CUTI[cuti!.jenis].toLowerCase()} onTutup={() => setLembar(null)} />
      )}
    </div>
  )
}

function LembarKeputusan({ jenis, id, putusan, judul, ringkas, labelJenis, onTutup }: {
  jenis: JenisPengajuan; id: string; putusan: 'disetujui' | 'ditolak'; judul: string; ringkas: string; labelJenis: string; onTutup: () => void
}) {
  const m = usePutuskan(jenis, id)
  const [catatan, setCatatan] = useState('')
  const toast = useToast()
  const navigate = useNavigate()
  const setuju = putusan === 'disetujui'
  const nama = judul.split(' · ')[0]
  const kirim = () => m.mutate({ putusan, catatan }, {
    onSuccess: () => {
      const L = labelJenis[0].toUpperCase() + labelJenis.slice(1)
      toast(setuju ? `${L} ${nama} disetujui. Diteruskan ke HR.` : `${L} ${nama} ditolak.`)
      navigate(`/persetujuan${jenis === 'cuti' ? '?tab=cuti' : ''}`)
    },
  })
  return (
    <Dialog lembar judul={`${setuju ? 'Setujui' : 'Tolak'} pengajuan ${labelJenis}?`} onTutup={onTutup}>
      <div className="rounded-kartu border border-garis bg-latar px-4 py-3">
        <p className="font-semibold">{judul}</p>
        <p className="text-[15px] text-teks-sekunder">{ringkas}</p>
      </div>
      {m.isError && <div className="mt-3"><BannerGalat>{m.error.message}</BannerGalat></div>}
      <label htmlFor="catatan-keputusan" className="mt-4 block text-sm font-medium">Catatan <span className="font-normal text-teks-sekunder">(opsional)</span></label>
      <textarea id="catatan-keputusan" rows={3} maxLength={500} value={catatan} onChange={(e) => setCatatan(e.target.value)}
        placeholder={setuju ? 'Contoh: Silakan, pastikan laporan terkirim.' : 'Contoh: Jadwal bentrok dengan stock opname.'}
        className="fokus-ring mt-2 w-full rounded-kontrol border border-garis bg-permukaan px-4 py-3 text-[15px] placeholder:text-teks-3" />
      <div className="mt-4 flex flex-col gap-2">
        <Tombol varian={setuju ? 'primer' : 'bahaya'} memproses={m.isPending} onClick={kirim}>
          {m.isError ? 'Coba lagi' : setuju ? 'Ya, setujui' : 'Ya, tolak'}
        </Tombol>
        <Tombol varian="sekunder" onClick={onTutup} disabled={m.isPending}>Batal</Tombol>
      </div>
    </Dialog>
  )
}

function Tanda({ children }: { children: ReactNode }) {
  return <span className="ml-1 rounded-full bg-peringatan-latar px-2.5 py-0.5 text-[13px] font-semibold text-peringatan">{children}</span>
}

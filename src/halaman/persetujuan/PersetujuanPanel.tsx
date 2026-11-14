// APR-01–03 — Persetujuan tingkat 2 HR (B3B hal 1 lembur, 2 panel detail lembur, 3 sukses, 4 detail cuti, 5 riwayat,
// 6 kosong, 7 memuat, 8 galat). Keputusan tingkat 2 = status final. Direksi menyusul (4.4b).
import { useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router'
import { useProfil } from '../../auth/sesi'
import { dariTanggalDb, hariIniDb, inisial, tanggalPanjang, tanggalSingkat } from '../../lib/format'
import { jamWib } from '../../lib/absensi'
import { durasiJam, LABEL_JENIS_CUTI, rentangTanggal, ringkasCuti } from '../../lib/pengajuan'
import { Badge, KeadaanGalat, KeadaanKosong, Skeleton } from '../../komponen/keadaan'
import { BannerGalat, Tombol } from '../../komponen/form'
import Laci from '../../komponen/Laci'
import { useToast } from '../../komponen/toast'
import Segera from '../Segera'
import type { Cuti, JenisPengajuan, Lembur } from '../pengajuan/data'
import { AlurPersetujuan, Lampiran } from '../pengajuan/bagian'
import { usePutuskan } from './data'
import { sejak, useKonteksPanel, usePersetujuanPanel, type ItemPanel, type ItemRiwayat } from './dataPanel'

const tglWib = (iso: string) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date(iso))
const jamMenit = (iso: string) => jamWib(new Date(iso))
/** "hari ini, 08:05" · "2 hari" */
function lamaMenunggu(iso: string | null) {
  if (!iso) return '—'
  const hari = Math.round((dariTanggalDb(hariIniDb()).getTime() - dariTanggalDb(tglWib(iso)).getTime()) / 864e5)
  return hari <= 0 ? `hari ini, ${jamMenit(iso)}` : `${hari} hari`
}
const pendek = (iso: string) => `${tanggalSingkat(new Date(iso)).replace(/ \d{4}$/, '')} · ${jamMenit(iso)}`

export default function PersetujuanPanel() {
  const saya = useProfil().data!
  if (saya.role !== 'hr') return <Segera judul="Persetujuan" />
  return <PanelHr />
}

function PanelHr() {
  const [params, setParams] = useSearchParams()
  const tab: JenisPengajuan = params.get('tab') === 'cuti' ? 'cuti' : 'lembur'
  const riwayat = params.get('mode') === 'riwayat'
  const atur = (t: JenisPengajuan, r: boolean) => setParams({ ...(t === 'cuti' && { tab: t }), ...(r && { mode: 'riwayat' }) }, { replace: true })
  const q = usePersetujuanPanel()
  const [pilih, setPilih] = useState<string | null>(null)
  const daftar = q.data ? (riwayat ? q.data.riwayat[tab] : q.data.menunggu[tab]) : []
  const terpilih = daftar.find((x) => x.id === pilih) ?? null

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-[28px] leading-[34px] font-bold">Persetujuan tingkat 2</h1>
        <p className="mt-1 text-[15px] text-teks-sekunder">{tanggalPanjang(dariTanggalDb(hariIniDb()))} · pengajuan karyawan yang sudah disetujui atasan</p>
      </div>
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-garis">
        <div role="tablist" aria-label="Jenis pengajuan" className="flex gap-2">
          {(['lembur', 'cuti'] as const).map((t) => (
            <button key={t} role="tab" type="button" aria-selected={tab === t} onClick={() => { atur(t, riwayat); setPilih(null) }}
              className={`fokus-ring -mb-px h-11 border-b-2 px-3 text-[15px] font-semibold ${tab === t ? 'border-primer text-primer' : 'border-transparent text-teks-sekunder'}`}>
              {t === 'lembur' ? 'Lembur' : 'Cuti / Sakit / Izin'}
              {!!q.data?.menunggu[t].length && <span className="ml-1.5 tabular-nums">{q.data.menunggu[t].length}</span>}
            </button>
          ))}
        </div>
        <div className="mb-2 grid grid-cols-2 gap-1 rounded-kontrol bg-garis p-1">
          {[false, true].map((r) => (
            <button key={String(r)} type="button" aria-pressed={riwayat === r} onClick={() => { atur(tab, r); setPilih(null) }}
              className={`fokus-ring h-9 rounded-[6px] px-4 text-sm font-semibold ${riwayat === r ? 'bg-permukaan shadow-sm' : 'text-teks-sekunder'}`}>
              {r ? 'Riwayat' : 'Menunggu'}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-kartu border border-garis bg-permukaan">
        {q.isPending ? <Skeleton baris={6} />
          : q.isError ? <KeadaanGalat judul="Persetujuan gagal dimuat" onCobaLagi={() => q.refetch()} />
          : !daftar.length ? (riwayat
            ? <KeadaanKosong judul="Belum ada riwayat keputusan" pesan="Pengajuan yang sudah Anda setujui atau tolak akan muncul di sini." />
            : <KeadaanKosong judul="Tidak ada pengajuan yang menunggu" pesan="Pengajuan karyawan yang sudah disetujui atasan akan muncul di sini." />)
          : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[15px]">
                <thead className="text-[13px] font-semibold tracking-wide text-teks-sekunder uppercase">
                  <tr className="border-b border-garis">
                    <th scope="col" className="px-5 py-3">Pengaju</th>
                    <th scope="col" className="px-5 py-3">Jenis</th>
                    <th scope="col" className="px-5 py-3">Tanggal & durasi</th>
                    <th scope="col" className="px-5 py-3">Disetujui tingkat 1</th>
                    <th scope="col" className="px-5 py-3">{riwayat ? 'Keputusan Anda' : 'Menunggu sejak'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-garis">
                  {daftar.map((x) => {
                    const t1 = x.persetujuan.find((p) => p.tingkat === 1)
                    const aktif = x.id === pilih
                    return (
                      <tr key={x.id} onClick={() => setPilih(x.id)} className={`cursor-pointer hover:bg-latar ${aktif ? 'bg-primer-100/40 shadow-[inset_3px_0_0_var(--color-primer)]' : ''}`}>
                        <th scope="row" className="px-5 py-3 font-normal">
                          <button type="button" onClick={() => setPilih(x.id)} className="fokus-ring flex items-center gap-3 rounded text-left">
                            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primer-100 text-[13px] font-semibold text-primer" aria-hidden>{inisial(x.pengguna.nama)}</span>
                            <span>
                              <span className="block font-semibold">{x.pengguna.nama}</span>
                              <span className="block text-[13px] text-teks-sekunder">{x.pengguna.jabatan ?? '—'}</span>
                            </span>
                          </button>
                        </th>
                        <td className="px-5 py-3"><Jenis jenis={tab} x={x} /></td>
                        <td className="px-5 py-3 whitespace-nowrap"><TanggalDurasi jenis={tab} x={x} /></td>
                        <td className="px-5 py-3 whitespace-nowrap">
                          <span className="block">{t1?.penyetuju_nama ?? '—'}</span>
                          {t1 && <span className="block text-[13px] text-teks-sekunder">{pendek(t1.diputuskan_pada)}</span>}
                        </td>
                        <td className="px-5 py-3 whitespace-nowrap">
                          {riwayat
                            ? ((x as ItemRiwayat).keputusan === 'disetujui' ? <Badge nada="sukses">Disetujui</Badge> : <Badge nada="bahaya">Ditolak</Badge>)
                            : lamaMenunggu(sejak(x))}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
      </div>
      <p className="text-sm text-teks-sekunder">
        {riwayat ? 'Keputusan tingkat 2 adalah status final pengajuan.' : 'Urutan: paling lama menunggu di atas. Klik baris untuk meninjau.'}
      </p>

      {terpilih && <LaciDetail key={terpilih.id} jenis={tab} x={terpilih} bisaPutuskan={!riwayat} onTutup={() => setPilih(null)} />}
    </div>
  )
}

function Jenis({ jenis, x }: { jenis: JenisPengajuan; x: ItemPanel }) {
  const l = jenis === 'lembur' ? (x as ItemPanel<Lembur>) : null
  const c = jenis === 'cuti' ? (x as ItemPanel<Cuti>) : null
  return (
    <>
      <span className="block">{l ? (l.hari_libur ? 'Lembur hari libur' : 'Lembur') : LABEL_JENIS_CUTI[c!.jenis]}</span>
      {l?.tanggal === hariIniDb() && <Tanda>Lembur hari ini</Tanda>}
      {c?.lampiran_path && <Tanda netral>Ada lampiran</Tanda>}
    </>
  )
}

function TanggalDurasi({ jenis, x }: { jenis: JenisPengajuan; x: ItemPanel }) {
  if (jenis === 'lembur') {
    const l = x as ItemPanel<Lembur>
    return <>
      <span className="block">{tanggalSingkat(dariTanggalDb(l.tanggal))}</span>
      <span className="block text-[13px] text-teks-sekunder">{l.jam_mulai.slice(0, 5)} – {l.jam_selesai.slice(0, 5)} · {durasiJam(l.jam_mulai, l.jam_selesai)}</span>
    </>
  }
  const c = x as ItemPanel<Cuti>
  return <>
    <span className="block">{rentangTanggal(c.tanggal_mulai, c.tanggal_selesai, true)}</span>
    <span className="block text-[13px] text-teks-sekunder">{c.jumlah_hari} hari kerja</span>
  </>
}

function LaciDetail({ jenis, x, bisaPutuskan, onTutup }: { jenis: JenisPengajuan; x: ItemPanel; bisaPutuskan: boolean; onTutup: () => void }) {
  const saya = useProfil().data!
  const k = useKonteksPanel(x, jenis).data
  const m = usePutuskan(jenis, x.id)
  const toast = useToast()
  const [catatan, setCatatan] = useState('')
  const l = jenis === 'lembur' ? (x as ItemPanel<Lembur>) : null
  const c = jenis === 'cuti' ? (x as ItemPanel<Cuti>) : null
  const label = l ? 'Lembur' : LABEL_JENIS_CUTI[c!.jenis]
  const giliran = bisaPutuskan && x.status === 'menunggu' && x.tingkat_berikut === 2
  const putuskan = (putusan: 'disetujui' | 'ditolak') => m.mutate({ putusan, catatan }, {
    onSuccess: () => {
      toast(`${label} ${x.pengguna.nama} ${putusan}. Status final: ${putusan === 'disetujui' ? 'Disetujui' : 'Ditolak'}.`)
      onTutup()
    },
  })

  return (
    <Laci judul={x.pengguna.nama} subjudul={`${x.pengguna.jabatan ?? '—'} · ${x.nomor}`} onTutup={onTutup}
      kaki={giliran ? (
        <div className="grid w-full grid-cols-2 gap-3">
          <Tombol varian="bahayaGaris" disabled={m.isPending} onClick={() => putuskan('ditolak')}>Tolak</Tombol>
          <Tombol memproses={m.isPending} onClick={() => putuskan('disetujui')}>Setujui</Tombol>
        </div>
      ) : undefined}>
      <div className="flex flex-col gap-4 text-[15px]">
        <dl className="grid grid-cols-[96px_1fr] gap-x-3 gap-y-1.5">
          <dt className="text-teks-sekunder">Jenis</dt><dd className="font-semibold">{label}</dd>
          <dt className="text-teks-sekunder">Tanggal</dt>
          <dd className="font-semibold">
            {l ? `${tanggalSingkat(dariTanggalDb(l.tanggal))}${l.tanggal === hariIniDb() ? ' (hari ini)' : l.hari_libur ? ' (hari libur)' : ''}` : rentangTanggal(c!.tanggal_mulai, c!.tanggal_selesai, true)}
          </dd>
          {l ? <><dt className="text-teks-sekunder">Jam</dt><dd className="font-semibold">{l.jam_mulai.slice(0, 5)} – {l.jam_selesai.slice(0, 5)} · {durasiJam(l.jam_mulai, l.jam_selesai)}</dd></>
            : <><dt className="text-teks-sekunder">Jumlah</dt><dd className="font-semibold">{c!.jumlah_hari} hari kerja
              {k?.kalender && (() => { const t = ringkasCuti(c!.tanggal_mulai, c!.tanggal_selesai, k.kalender).tidakDihitung; return t.length ? <span className="block text-sm font-normal text-teks-sekunder">Tidak dihitung: {t.join(', ')}</span> : null })()}
            </dd></>}
          <dt className="text-teks-sekunder">Alasan</dt><dd className="font-semibold whitespace-pre-line">{x.alasan}</dd>
        </dl>

        {l && k && (
          <dl className="divide-y divide-garis rounded-kartu border border-garis px-4">
            <BarisKonteks label="Jadwal kerja hari itu">{k.jadwal ? `${k.jadwal.jam_masuk.slice(0, 5)} – ${k.jadwal.jam_pulang.slice(0, 5)} WIB` : 'Libur'}</BarisKonteks>
            <BarisKonteks label="Clock in hari itu">
              {k.absensi ? <span className={k.absensi.terlambat ? 'text-peringatan' : ''}>{jamMenit(k.absensi.jam_masuk)} WIB{k.absensi.terlambat ? ' · terlambat' : ''}</span>
                : <span className="font-normal text-teks-sekunder">{l.tanggal > hariIniDb() ? 'Belum ada · tanggal mendatang' : 'Belum ada'}</span>}
            </BarisKonteks>
          </dl>
        )}
        {c && k && (
          <dl className="divide-y divide-garis rounded-kartu border border-garis px-4">
            {c.jenis === 'cuti' && c.pengguna.saldo_cuti != null && (
              <BarisKonteks label="Sisa saldo cuti">
                {x.status === 'disetujui' ? `${c.pengguna.saldo_cuti} hari` : <span className={c.pengguna.saldo_cuti < c.jumlah_hari ? 'text-bahaya' : ''}>{c.pengguna.saldo_cuti} hari → {c.pengguna.saldo_cuti - c.jumlah_hari} hari</span>}
              </BarisKonteks>
            )}
            <BarisKonteks label="Bentrok tim">
              {k.bentrok.length
                ? <span className="text-peringatan">{k.bentrok.map((b) => `${b.pengguna.nama} · ${b.jenis} ${rentangTanggal(b.tanggal_mulai, b.tanggal_selesai)} (${b.status})`).join('; ')}</span>
                : <span className="font-normal text-teks-sekunder">Tidak ada rekan satu tim yang cuti</span>}
            </BarisKonteks>
          </dl>
        )}
        {c && <p className="text-teks-sekunder">Lampiran: {c.lampiran_path ? <Lampiran path={c.lampiran_path} /> : 'tidak ada'}</p>}

        <AlurPersetujuan p={x} pengaju={{ nama: x.pengguna.nama, role: x.pengguna.role }} batalOleh="Oleh pengaju"
          saya={{ tingkat: 2, nama: saya.nama, jabatan: saya.jabatan }} />

        {giliran && (
          <div>
            {m.isError && <div className="mb-3"><BannerGalat>{m.error.message}</BannerGalat></div>}
            <label htmlFor="catatan-hr" className="text-sm font-medium">Catatan <span className="font-normal text-teks-sekunder">(opsional)</span></label>
            <textarea id="catatan-hr" rows={3} maxLength={500} value={catatan} onChange={(e) => setCatatan(e.target.value)}
              placeholder="Catatan untuk pengaju, wajib dibaca bila ditolak"
              className="fokus-ring mt-2 w-full rounded-kontrol border border-garis bg-permukaan px-4 py-3 text-[15px] placeholder:text-teks-3" />
          </div>
        )}
      </div>
    </Laci>
  )
}

function BarisKonteks({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <dt className="text-teks-sekunder">{label}</dt>
      <dd className="text-right font-semibold">{children}</dd>
    </div>
  )
}

function Tanda({ netral, children }: { netral?: boolean; children: ReactNode }) {
  return <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[12px] font-semibold ${netral ? 'bg-latar text-teks-sekunder' : 'bg-peringatan-latar text-peringatan'}`}>{children}</span>
}


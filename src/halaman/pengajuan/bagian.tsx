// Bagian bersama detail pengajuan (B1 hal 37–38) & detail persetujuan (B2 hal 11–22): alur persetujuan, lampiran, baris.
import type { ReactNode } from 'react'
import { Check, Clock, X } from 'lucide-react'
import type { Peran } from '../../auth/sesi'
import { waktuSingkat } from '../../lib/format'
import { useLampiran, type Persetujuan } from './data'

/** Karyawan: Atasan → HR. Atasan/HR: Direksi (satu tingkat) — PRD §6.1 */
export const tingkatPersetujuan = (rolePengaju: Peran) =>
  rolePengaju === 'karyawan' ? [{ n: 1, peran: 'Atasan' }, { n: 2, peran: 'HR' }] : [{ n: 1, peran: 'Direksi' }]

type PengajuanAlur = { status: string; tingkat_berikut: number | null; diajukan_pada: string; selesai_pada: string | null; persetujuan: Persetujuan[] }

/** Tingkat yang belum diputuskan menampilkan peran penyetuju; bila `saya` penyetujunya, tampil "(Anda)" + nama sendiri. */
export function AlurPersetujuan({ p, pengaju, batalOleh, saya }: {
  p: PengajuanAlur; pengaju: { nama: string; role: Peran }; batalOleh: string
  saya?: { tingkat: number; nama: string; jabatan: string | null }
}) {
  const tingkat = tingkatPersetujuan(pengaju.role)
  return (
    <section className="rounded-kartu border border-garis bg-permukaan p-4">
      <h2 className="text-[17px] font-semibold">Alur persetujuan</h2>
      <ol className="mt-3">
        <Langkah ikon="selesai" judul="Diajukan" garis>
          <p>{pengaju.nama}</p>
          <p className="text-sm text-teks-sekunder">{waktuSingkat(new Date(p.diajukan_pada))} WIB</p>
        </Langkah>
        {tingkat.map((t, i) => {
          const k = p.persetujuan.find((x) => x.tingkat === t.n)
          const terakhir = i === tingkat.length - 1 && p.status !== 'dibatalkan'
          const giliran = p.status === 'menunggu' && p.tingkat_berikut === t.n
          const anda = saya?.tingkat === t.n && !k
          const label = `Tingkat ${t.n} · ${t.peran}${anda ? ' (Anda)' : ''}`
          return k ? <LangkahKeputusan key={t.n} k={k} label={label} garis={!terakhir} />
            : (
              <Langkah key={t.n} ikon={giliran ? 'menunggu' : String(i + 2)} judul={label} garis={!terakhir}>
                {anda && <p>{[saya.nama, saya.jabatan].filter(Boolean).join(', ')}</p>}
                {giliran
                  ? <p className="text-sm text-peringatan">{anda ? 'Menunggu keputusan Anda' : 'Menunggu persetujuan'}</p>
                  : <p className="text-sm text-teks-sekunder">{p.status === 'menunggu' ? 'Belum diproses' : p.status === 'dibatalkan' && saya ? 'Tidak diproses · dibatalkan pengaju' : 'Tidak diproses'}</p>}
              </Langkah>
            )
        })}
        {p.status === 'dibatalkan' && (
          <Langkah ikon="batal" judul="Dibatalkan">
            <p className="text-sm text-teks-sekunder">{batalOleh}{p.selesai_pada && ` · ${waktuSingkat(new Date(p.selesai_pada))} WIB`}</p>
          </Langkah>
        )}
      </ol>
    </section>
  )
}

export function Lampiran({ path }: { path: string | null }) {
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

export function Baris({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[96px_1fr] gap-3">
      <dt className="text-teks-sekunder">{label}</dt>
      <dd className="font-semibold">{children}</dd>
    </div>
  )
}

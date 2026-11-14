// Potongan kerangka yang dipakai shell mobile & panel.
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, matchPath, NavLink } from 'react-router'
import { Bell, ChevronLeft } from 'lucide-react'
import { AKSES, KEMBALI_MOBILE, type ItemNav } from '../navigasi'
import { useJumlahBelumDibaca, useNotifikasi, useTandaiDibaca } from '../halaman/notifikasi/data'
import ItemNotifikasi from '../halaman/notifikasi/ItemNotifikasi'
import { NAMA_APLIKASI } from '../lib/aplikasi'

const ROOT = ['/beranda', '/panel']

/** Judul top bar mobile dari label halaman; beranda → nama aplikasi (B1 hal 10 vs hal 49). */
export const judulMobile = (pathname: string) =>
  ROOT.includes(pathname) ? NAMA_APLIKASI : (Object.entries(AKSES).find(([ke]) => matchPath(ke, pathname))?.[1].label ?? NAMA_APLIKASI)

/** Bottom nav — tab aktif: pil biru + label tebal + aria-current="page" (B1 hal 2). */
/** Angka merah (jumlah) di ikon — lonceng & menu Persetujuan (B1 hal 2, B2 hal 4). */
export function Lencana({ n }: { n?: number }) {
  if (!n) return null
  return <span className="absolute -top-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-bahaya-ikon px-1 text-[11px] leading-none font-bold text-white tabular-nums">{n > 99 ? '99+' : n}</span>
}

export function BottomNav({ items, lencana = {} }: { items: ItemNav[]; lencana?: Record<string, number | undefined> }) {
  return (
    <nav aria-label="Navigasi utama" className="fixed inset-x-0 bottom-0 z-10 border-t border-garis bg-permukaan pb-[env(safe-area-inset-bottom)]">
      <ul className="mx-auto flex max-w-[480px]">
        {items.map(({ ke, label, ikon: Ikon }) => (
          <li key={ke} className="flex-1">
            <NavLink to={ke} end={ROOT.includes(ke)} className="fokus-ring flex min-h-16 flex-col items-center justify-center gap-1 rounded-kontrol">
              {({ isActive }) => (
                <>
                  <span className={`flex h-8 w-14 items-center justify-center rounded-full ${isActive ? 'bg-primer-100 text-primer' : 'text-teks-sekunder'}`}>
                    <span className="relative"><Ikon className="size-5" aria-hidden /><Lencana n={lencana[ke]} /></span>
                  </span>
                  <span className={`text-xs leading-4 ${isActive ? 'font-semibold text-primer' : 'text-teks-sekunder'}`}>
                    {label}{!!lencana[ke] && <span className="sr-only">, {lencana[ke]} menunggu</span>}
                  </span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}

/** Top app bar mobile: judul halaman (nama aplikasi di Beranda) + lonceng. */
/** Tujuan tombol ‹ untuk halaman turunan (null = halaman utama, tampil lonceng). */
export function kembaliMobile(pathname: string) {
  for (const [ke, tujuan] of Object.entries(KEMBALI_MOBILE)) {
    const m = matchPath(ke, pathname)
    if (m) return tujuan(m.params)
  }
  return null
}

export function TopBarMobile({ ke, judul = NAMA_APLIKASI, ekstra, kembali }: { ke: string; judul?: string; ekstra?: ReactNode; kembali?: string | null }) {
  return (
    <header className="sticky top-0 z-10 border-b border-garis bg-permukaan">
      <div className={`mx-auto flex h-14 max-w-[480px] items-center justify-between pr-2 ${kembali ? 'pl-1' : 'pl-4'}`}>
        <div className="flex min-w-0 items-center gap-1">
          {kembali && (
            <Link to={kembali} aria-label="Kembali" className="fokus-ring flex size-11 shrink-0 items-center justify-center rounded-kontrol">
              <ChevronLeft className="size-6" aria-hidden />
            </Link>
          )}
          {/* halaman turunan tidak punya judul sendiri — top bar menjadi h1-nya */}
          {kembali ? <h1 className="min-w-0 truncate text-[17px] leading-6 font-bold">{judul}</h1>
            : <span className="min-w-0 truncate text-[17px] leading-6 font-bold">{judul}</span>}
        </div>
        <div className="flex items-center gap-1">
          {ekstra}
          {!kembali && <TombolNotifikasi ke={ke} />}
        </div>
      </div>
    </header>
  )
}

/** Lonceng HP: membuka halaman notifikasi. */
export function TombolNotifikasi({ ke }: { ke: string }) {
  const n = useJumlahBelumDibaca().data
  return (
    <Link to={ke} aria-label={n ? `Notifikasi, ${n} belum dibaca` : 'Notifikasi'} className="fokus-ring flex size-11 items-center justify-center rounded-kontrol text-teks">
      <span className="relative"><Bell className="size-6" aria-hidden /><Lencana n={n} /></span>
    </Link>
  )
}

/** Lonceng panel desktop: dropdown notifikasi (B4 hal 12). Tutup dengan klik di luar / Esc. */
export function LoncengPanel() {
  const [buka, setBuka] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const n = useJumlahBelumDibaca().data
  useEffect(() => {
    if (!buka) return
    const luar = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setBuka(false)
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setBuka(false)
    document.addEventListener('mousedown', luar)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', luar); document.removeEventListener('keydown', esc) }
  }, [buka])
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setBuka((b) => !b)} aria-expanded={buka} aria-label={n ? `Notifikasi, ${n} belum dibaca` : 'Notifikasi'}
        className="fokus-ring flex size-11 items-center justify-center rounded-kontrol text-teks">
        <span className="relative"><Bell className="size-6" aria-hidden /><Lencana n={n} /></span>
      </button>
      {buka && <DropdownNotifikasi onTutup={() => setBuka(false)} />}
    </div>
  )
}

function DropdownNotifikasi({ onTutup }: { onTutup: () => void }) {
  const q = useNotifikasi()
  const tandai = useTandaiDibaca()
  return (
    <div className="absolute top-full right-0 z-20 mt-2 w-[360px] overflow-hidden rounded-kartu border border-garis bg-permukaan shadow-xl">
      <div className="flex items-center justify-between border-b border-garis px-4 py-3">
        <p className="font-semibold">Notifikasi</p>
        {!!q.data?.some((x) => !x.dibaca) && (
          <button type="button" onClick={() => tandai.mutate('semua')} className="fokus-ring rounded text-sm font-semibold text-primer">Tandai semua dibaca</button>
        )}
      </div>
      <div className="max-h-[420px] overflow-y-auto">
        {q.isPending ? <p className="p-4 text-sm text-teks-sekunder">Memuat…</p>
          : q.isError ? <p className="p-4 text-sm text-bahaya">Notifikasi gagal dimuat.</p>
          : !q.data.length ? <p className="p-4 text-sm text-teks-sekunder">Belum ada notifikasi.</p>
          : <ul className="divide-y divide-garis">{q.data.map((x) => <ItemNotifikasi key={x.id} n={x} ringkas onPilih={onTutup} />)}</ul>}
      </div>
    </div>
  )
}

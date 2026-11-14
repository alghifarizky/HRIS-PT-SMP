// Potongan kerangka yang dipakai shell mobile & panel.
import type { ReactNode } from 'react'
import { Link, matchPath, NavLink } from 'react-router'
import { Bell } from 'lucide-react'
import { AKSES, type ItemNav } from '../navigasi'
import { NAMA_APLIKASI } from '../lib/aplikasi'

const ROOT = ['/beranda', '/panel']

/** Judul top bar mobile dari label halaman; beranda → nama aplikasi (B1 hal 10 vs hal 49). */
export const judulMobile = (pathname: string) =>
  ROOT.includes(pathname) ? NAMA_APLIKASI : (Object.entries(AKSES).find(([ke]) => matchPath(ke, pathname))?.[1].label ?? NAMA_APLIKASI)

/** Bottom nav — tab aktif: pil biru + label tebal + aria-current="page" (B1 hal 2).
 *  Bukan position:fixed — diletakkan di dasar kolom setinggi layar (lihat LayoutMobile) agar tidak ikut
 *  bergeser saat scroll elastis / bilah alamat Safari iOS mengecil. */
export function BottomNav({ items }: { items: ItemNav[] }) {
  return (
    <nav aria-label="Navigasi utama" className="z-10 shrink-0 border-t border-garis bg-permukaan pb-[env(safe-area-inset-bottom)]">
      <ul className="mx-auto flex max-w-[480px]">
        {items.map(({ ke, label, ikon: Ikon }) => (
          <li key={ke} className="flex-1">
            <NavLink to={ke} end={ROOT.includes(ke)} className="fokus-ring flex min-h-16 flex-col items-center justify-center gap-1 rounded-kontrol">
              {({ isActive }) => (
                <>
                  <span className={`flex h-8 w-14 items-center justify-center rounded-full ${isActive ? 'bg-primer-100 text-primer' : 'text-teks-sekunder'}`}>
                    <Ikon className="size-5" aria-hidden />
                  </span>
                  <span className={`text-xs leading-4 ${isActive ? 'font-semibold text-primer' : 'text-teks-sekunder'}`}>{label}</span>
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
export function TopBarMobile({ ke, judul = NAMA_APLIKASI, ekstra }: { ke: string; judul?: string; ekstra?: ReactNode }) {
  return (
    <header className="z-10 shrink-0 border-b border-garis bg-permukaan pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex h-14 max-w-[480px] items-center justify-between pr-2 pl-4">
        <span className="min-w-0 truncate text-[17px] leading-6 font-bold">{judul}</span>
        <div className="flex items-center gap-1">
          {ekstra}
          <TombolNotifikasi ke={ke} />
        </div>
      </div>
    </header>
  )
}

// shortcut: tanpa badge jumlah belum dibaca — ditambah saat tabel notifikasi dibuat (NTF-, Fase 4)
export function TombolNotifikasi({ ke }: { ke: string }) {
  return (
    <Link to={ke} aria-label="Notifikasi" className="fokus-ring flex size-11 items-center justify-center rounded-kontrol text-teks">
      <Bell className="size-6" aria-hidden />
    </Link>
  )
}

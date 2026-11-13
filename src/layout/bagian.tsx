// Potongan kerangka yang dipakai shell mobile & panel.
import type { ReactNode } from 'react'
import { Link, matchPath, NavLink } from 'react-router'
import { Bell } from 'lucide-react'
import { AKSES, type ItemNav } from '../navigasi'

const ROOT = ['/beranda', '/panel']

/** Judul top bar mobile dari label halaman; beranda → "HRIS PT. SMP" (B1 hal 10 vs hal 49). */
export const judulMobile = (pathname: string) =>
  ROOT.includes(pathname) ? 'HRIS PT. SMP' : (Object.entries(AKSES).find(([ke]) => matchPath(ke, pathname))?.[1].label ?? 'HRIS PT. SMP')

/** Bottom nav — tab aktif: pil biru + label tebal + aria-current="page" (B1 hal 2). */
export function BottomNav({ items }: { items: ItemNav[] }) {
  return (
    <nav aria-label="Navigasi utama" className="fixed inset-x-0 bottom-0 z-10 border-t border-garis bg-permukaan pb-[env(safe-area-inset-bottom)]">
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

/** Top app bar mobile: judul halaman ("HRIS PT. SMP" di Beranda) + lonceng. */
export function TopBarMobile({ ke, judul = 'HRIS PT. SMP', ekstra }: { ke: string; judul?: string; ekstra?: ReactNode }) {
  return (
    <header className="sticky top-0 z-10 border-b border-garis bg-permukaan">
      <div className="mx-auto flex h-14 max-w-[480px] items-center justify-between pr-2 pl-4">
        <span className="text-[17px] leading-6 font-bold">{judul}</span>
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

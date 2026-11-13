// Shell panel HR & Direksi — desain B3A hal 3, B4 hal 1 (≥ 1024 px) & B4 hal 46 (Direksi < 1024 px).
// HR di layar kecil diarahkan ke "Akun saya" (keputusan Al, 13 Nov 2026 — panel HR tidak punya desain mobile).
import { Link, matchPath, NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { Laptop, LogOut, Search, User } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { NAMA_APLIKASI } from '../lib/aplikasi'
import { useProfil } from '../auth/sesi'
import { AKSES, LABEL_PERAN, NAV_PANEL, NAV_PANEL_BAWAH, NAV_PANEL_MOBILE_DIREKSI, type ItemNav } from '../navigasi'
import { BottomNav, judulMobile, TombolNotifikasi, TopBarMobile } from './bagian'

const kelasMenu = ({ isActive }: { isActive: boolean }) =>
  `fokus-ring flex h-11 items-center gap-3 rounded-kontrol px-3 text-[15px] ${isActive ? 'bg-primer-50 font-semibold text-primer' : 'text-teks hover:bg-latar'}`

function ItemMenu({ item }: { item: ItemNav }) {
  const Ikon = item.ikon
  return (
    <NavLink to={item.ke} end={item.ke === '/panel'} className={kelasMenu}>
      <Ikon className="size-5" aria-hidden />
      {item.label}
    </NavLink>
  )
}

export default function LayoutPanel() {
  const profil = useProfil().data!
  const { pathname } = useLocation()
  const judul = Object.entries(AKSES).find(([ke]) => matchPath(ke, pathname))?.[1].label ?? ''
  const hr = profil.role === 'hr'
  const inisial = profil.nama.split(' ').slice(0, 2).map((k) => k[0]).join('').toUpperCase()

  return (
    <div className="min-h-dvh bg-latar lg:flex">
      <aside className="sticky top-0 hidden h-dvh w-[248px] shrink-0 flex-col overflow-y-auto border-r border-garis bg-permukaan lg:flex">
        <div className="flex h-16 items-center gap-3 px-5">
          <img src="/logo-smp.png" alt="" width={36} height={36} className="size-9" />
          <div>
            <p className="text-[15px] leading-5 font-bold">{NAMA_APLIKASI}</p>
            <p className="text-xs leading-4 text-teks-sekunder">Panel {LABEL_PERAN[profil.role]}</p>
          </div>
        </div>
        <nav aria-label="Menu panel" className="mt-2 flex flex-col gap-1 px-3">
          {(NAV_PANEL[profil.role] ?? []).map((i) => (
            <ItemMenu key={i.ke} item={i} />
          ))}
          <hr className="mx-2 my-3 border-garis" />
          {hr && (
            <Link to="/beranda" className="fokus-ring flex items-start gap-3 rounded-kontrol px-3 py-2 text-[15px] hover:bg-latar">
              <User className="mt-0.5 size-5" aria-hidden />
              <span>
                Akun saya
                <span className="block text-xs leading-4 text-teks-sekunder">Absen, pengajuan & slip (mobile)</span>
              </span>
            </Link>
          )}
          <ItemMenu item={NAV_PANEL_BAWAH} />
          <button type="button" onClick={() => supabase.auth.signOut()} className="fokus-ring flex h-11 items-center gap-3 rounded-kontrol px-3 text-[15px] font-semibold text-bahaya hover:bg-bahaya-latar">
            <LogOut className="size-5" aria-hidden />
            Keluar
          </button>
        </nav>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-10 hidden h-16 items-center justify-between border-b border-garis bg-permukaan px-8 lg:flex">
          <p className="text-[22px] leading-7 font-semibold">{judul}</p>
          <div className="flex items-center gap-4">
            <CariKaryawan />
            <TombolNotifikasi ke="/panel/notifikasi" />
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-full bg-primer-100 text-sm font-semibold text-primer" aria-hidden>
                {inisial}
              </span>
              <div>
                <p className="text-[15px] leading-5 font-semibold">{profil.nama}</p>
                <p className="text-xs leading-4 text-teks-sekunder">{LABEL_PERAN[profil.role]}</p>
              </div>
            </div>
          </div>
        </header>
        <div className="lg:hidden">
          <TopBarMobile ke="/panel/notifikasi" judul={judulMobile(pathname)} />
        </div>

        {hr ? (
          <>
            <PanelHrLayarKecil />
            <main className="hidden p-8 lg:block">
              <Outlet />
            </main>
          </>
        ) : (
          <>
            <main className="mx-auto max-w-[480px] px-4 pt-6 pb-28 lg:max-w-none lg:p-8">
              <Outlet />
            </main>
            <div className="lg:hidden">
              <BottomNav items={NAV_PANEL_MOBILE_DIREKSI} />
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function PanelHrLayarKecil() {
  return (
    <main className="mx-auto flex max-w-[440px] flex-col items-center px-6 pt-16 text-center lg:hidden">
      <div className="flex size-[72px] items-center justify-center rounded-full bg-info-latar">
        <Laptop className="size-8 text-info-ikon" aria-hidden />
      </div>
      <h1 className="mt-6 text-[22px] leading-7 font-semibold">Panel HR dirancang untuk layar laptop</h1>
      <p className="mt-3 text-[15px] leading-[22px] text-teks-sekunder">
        Buka panel dari laptop. Untuk absen, pengajuan, dan slip gaji Anda sendiri, buka Akun saya.
      </p>
      <Link to="/beranda" className="fokus-ring mt-8 flex h-12 w-full items-center justify-center rounded-kontrol bg-primer text-base font-semibold text-white hover:bg-primer-700">
        Buka Akun saya
      </Link>
      <button type="button" onClick={() => supabase.auth.signOut()} className="fokus-ring mt-3 min-h-11 rounded-kontrol px-3 text-[15px] font-semibold text-bahaya">
        Keluar
      </button>
    </main>
  )
}

/** Kolom "Cari karyawan (nama / NIK)" di top bar → membuka daftar karyawan dengan kata kunci. */
function CariKaryawan() {
  const navigate = useNavigate()
  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault()
        const q = String(new FormData(e.currentTarget).get('q') ?? '').trim()
        navigate(q ? `/panel/karyawan?q=${encodeURIComponent(q)}` : '/panel/karyawan')
        e.currentTarget.reset()
      }}
      className="relative"
    >
      <Search className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-teks-3" aria-hidden />
      <input
        name="q"
        type="search"
        aria-label="Cari karyawan (nama atau NIK)"
        placeholder="Cari karyawan (nama / NIK)"
        className="fokus-ring h-11 w-[320px] rounded-kontrol border border-garis bg-permukaan pr-3 pl-10 text-[15px] placeholder:text-teks-3"
      />
    </form>
  )
}

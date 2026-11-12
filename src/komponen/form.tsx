// Komponen form dasar — design system v1 (B1 hal 2): kontrol 48 px, radius 8, label di atas field.
import { useState, type ComponentProps, type ReactNode } from 'react'
import { CircleAlert, Eye, EyeOff } from 'lucide-react'

export function Field({ id, label, galat, children }: { id: string; label: string; galat?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col">
      <label htmlFor={id} className="text-sm leading-5 font-medium">
        {label}
      </label>
      <div className="mt-2">{children}</div>
      {galat && (
        <p id={`${id}-galat`} className="mt-2 flex items-center gap-1.5 text-sm text-bahaya">
          <CircleAlert className="size-4 shrink-0 text-bahaya-ikon" aria-hidden />
          {galat}
        </p>
      )}
    </div>
  )
}

type InputProps = ComponentProps<'input'> & { galat?: boolean }

export function Input({ galat, className = '', ...p }: InputProps) {
  return (
    <input
      aria-invalid={galat || undefined}
      aria-describedby={galat && p.id ? `${p.id}-galat` : undefined}
      className={`fokus-ring h-12 w-full rounded-kontrol border bg-permukaan px-4 text-[15px] placeholder:text-teks-3 ${galat ? 'border-bahaya-ikon' : 'border-garis'} ${className}`}
      {...p}
    />
  )
}

export function InputPassword(p: Omit<InputProps, 'type'>) {
  const [lihat, setLihat] = useState(false)
  return (
    <div className="relative">
      <Input {...p} type={lihat ? 'text' : 'password'} className="pr-14" />
      <button
        type="button"
        onClick={() => setLihat((v) => !v)}
        aria-label={lihat ? 'Sembunyikan password' : 'Tampilkan password'}
        aria-pressed={lihat}
        className="fokus-ring absolute top-0 right-0 flex size-12 items-center justify-center rounded-kontrol text-teks-sekunder"
      >
        {lihat ? <EyeOff className="size-5" aria-hidden /> : <Eye className="size-5" aria-hidden />}
      </button>
    </div>
  )
}

export function BannerGalat({ children }: { children: ReactNode }) {
  return (
    <div role="alert" className="flex gap-3 rounded-kartu bg-bahaya-latar p-4 text-[15px] leading-[22px] text-bahaya">
      <CircleAlert className="mt-0.5 size-5 shrink-0 text-bahaya-ikon" aria-hidden />
      <span>{children}</span>
    </div>
  )
}

export function TombolPrimer({ memproses, children, className = '', ...p }: ComponentProps<'button'> & { memproses?: boolean }) {
  return (
    <button
      disabled={memproses || p.disabled}
      className={`fokus-ring flex h-12 w-full items-center justify-center gap-2 rounded-kontrol bg-primer text-base font-semibold text-white hover:bg-primer-700 disabled:opacity-80 ${className}`}
      {...p}
    >
      {memproses && <span className="size-5 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden />}
      {memproses ? 'Memproses' : children}
    </button>
  )
}

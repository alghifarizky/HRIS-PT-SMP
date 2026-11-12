import { z } from 'zod'

export const skemaEmail = z
  .string()
  .trim()
  .min(1, 'Email wajib diisi.')
  .pipe(z.email('Format email tidak valid. Contoh: nama@gmail.com'))

// Sama dengan auth.minimum_password_length di supabase/config.toml
export const skemaPasswordBaru = z.string().min(8, 'Password minimal 8 karakter.')

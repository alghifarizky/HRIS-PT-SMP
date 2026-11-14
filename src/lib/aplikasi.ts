// Nama aplikasi untuk tampilan (permintaan pengguna, 13 Nov 2026). Ubah di sini saja;
// index.html, template email (supabase/templates) & sender_name (supabase/config.toml) ditulis terpisah.
export const NAMA_APLIKASI = 'HRIS PT SUMBER MIGAS PANTARA'

/**
 * Alamat aplikasi untuk link di email (undangan, kirim ulang, lupa password). VITE_APP_URL mengunci ke alamat
 * resmi — tanpa itu link mengikuti alamat browser pengirim (mis. HR di localhost → link karyawan ke localhost).
 * Harus terdaftar di APP_ORIGINS (Edge Function akun) & redirect URL Supabase.
 */
export const urlAturPassword = () => `${import.meta.env.VITE_APP_URL || window.location.origin}/atur-password`

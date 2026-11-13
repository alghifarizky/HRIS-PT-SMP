// Edge Function `akun` — operasi akun yang butuh service_role (EMP-02, EMP-08, AUTH-02).
// service_role HANYA untuk Auth admin (undang, kirim ulang, ubah email). Data `pengguna` ditulis dengan token
// pemanggil sehingga RLS tetap berlaku & log_audit mencatat HR/Direksi sebagai pelaku (security §10).
//
// POST { aksi: 'undang', redirectTo, data: {...} }        → buat akun + kirim undangan
// POST { aksi: 'kirim_ulang', redirectTo, id }            → kirim ulang undangan (akun belum aktif)
// POST { aksi: 'ubah_email', id, email }                  → ganti email login & data pengguna
import '@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'

const URL = Deno.env.get('SUPABASE_URL')!
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const CORS = {
  'Access-Control-Allow-Origin': '*', // aman: otorisasi lewat token Bearer, bukan cookie
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const jawab = (status: number, isi: Record<string, unknown>) => Response.json(isi, { status, headers: CORS })
const galat = (status: number, pesan: string) => jawab(status, { galat: pesan })

type Peran = 'karyawan' | 'atasan' | 'hr' | 'direksi'
/** HR mengelola semua kecuali Direksi; Direksi hanya mengelola HR (EMP-08). */
const boleh = (pemanggil: Peran | null, target: Peran) =>
  (pemanggil === 'hr' && target !== 'direksi') || (pemanggil === 'direksi' && target === 'hr')

const tanggal = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal tidak valid.')
const opsional = <T extends z.ZodType>(s: T) => s.nullable().optional()
const teks = (maks: number) => z.string().trim().min(1).max(maks, `Maksimal ${maks} karakter.`)

// Cermin constraint & trigger DB (kelengkapan_per_peran, no_ktp, tanggal masuk) agar ditolak SEBELUM email terkirim
const DataKaryawan = z
  .object({
    email: z.email('Format email tidak valid.').transform((e) => e.toLowerCase()),
    nama: teks(100),
    role: z.enum(['karyawan', 'atasan', 'hr', 'direksi']),
    atasan_id: opsional(z.uuid()),
    nik: opsional(teks(30)),
    jabatan: opsional(teks(100)),
    tanggal_lahir: opsional(tanggal),
    alamat: opsional(teks(300)),
    tanggal_masuk: opsional(tanggal),
    no_ktp: opsional(z.string().regex(/^\d{16}$/, 'No. KTP harus 16 digit angka.')),
    status_menikah: opsional(z.enum(['belum_menikah', 'menikah'])),
    jumlah_tanggungan: z.number().int().min(0).max(20).default(0),
    gaji_pokok: opsional(z.number().min(0).max(999_999_999_999)),
  })
  .superRefine((d, ctx) => {
    const wajib = (k: keyof typeof d, pesan: string) => d[k] == null && ctx.addIssue({ code: 'custom', path: [k], message: pesan })
    if (d.role === 'direksi') {
      if (d.atasan_id || d.gaji_pokok != null) ctx.addIssue({ code: 'custom', message: 'Direksi tidak memiliki atasan dan gaji pokok.' })
      return
    }
    if (d.role === 'karyawan') wajib('atasan_id', 'Atasan langsung wajib diisi untuk peran Karyawan.')
    wajib('nik', 'NIK karyawan wajib diisi.')
    wajib('jabatan', 'Jabatan wajib diisi.')
    wajib('gaji_pokok', 'Gaji pokok wajib diisi.')
    wajib('tanggal_masuk', 'Tanggal masuk wajib diisi.')
  })

// Asal aplikasi yang boleh menerima link undangan. Production: set secret APP_ORIGINS (mis. domain Vercel).
// Supabase TIDAK menolak redirect_to di luar allow-list saat undangan — maka dicek di sini.
const ORIGIN_DIIZINKAN = (Deno.env.get('APP_ORIGINS') ?? 'http://localhost:5173,http://127.0.0.1:5173').split(',').map((o) => o.trim())
const redirectTo = z.url().refine((u) => {
  const url = new globalThis.URL(u)
  return ORIGIN_DIIZINKAN.includes(url.origin) && url.pathname === '/atur-password'
}, 'Alamat aplikasi tidak diizinkan.')

const Permintaan = z.discriminatedUnion('aksi', [
  z.object({ aksi: z.literal('undang'), redirectTo, data: DataKaryawan }),
  z.object({ aksi: z.literal('kirim_ulang'), redirectTo, id: z.uuid() }),
  z.object({ aksi: z.literal('ubah_email'), id: z.uuid(), email: z.email('Format email tidak valid.').transform((e) => e.toLowerCase()) }),
])

/** Pesan Bahasa Indonesia untuk galat Postgres dari insert/update `pengguna`. */
function pesanDb(e: { code?: string; message: string; details?: string | null }) {
  if (e.code === '23505') {
    const teksGalat = `${e.message} ${e.details ?? ''}`
    if (teksGalat.includes('nik')) return 'NIK sudah dipakai karyawan lain.'
    if (teksGalat.includes('email')) return 'Email sudah terdaftar.'
    return 'Data sudah ada.'
  }
  if (e.code === '23503') return 'Atasan langsung tidak ditemukan.'
  if (e.code === '23514') return 'Data tidak lengkap untuk peran ini.'
  if (e.code === '42501') return 'Anda tidak berwenang melakukan ini.'
  return 'Gagal menyimpan data karyawan.'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return galat(405, 'Metode tidak didukung.')

  const authorization = req.headers.get('Authorization')
  if (!authorization) return galat(401, 'Sesi tidak valid. Silakan masuk ulang.')
  const sebagaiPemanggil = createClient(URL, ANON, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const admin = createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } })

  const { data: u } = await sebagaiPemanggil.auth.getUser()
  if (!u.user) return galat(401, 'Sesi tidak valid. Silakan masuk ulang.')
  const { data: peran } = await sebagaiPemanggil.rpc('peran_saya')

  const masuk = Permintaan.safeParse(await req.json().catch(() => null))
  if (!masuk.success) return galat(400, masuk.error.issues[0]?.message ?? 'Permintaan tidak valid.')
  const p = masuk.data

  if (p.aksi === 'undang') {
    if (!boleh(peran, p.data.role)) return galat(403, 'Anda tidak berwenang menambahkan akun dengan peran ini.')

    // Cek bentrok lebih dulu agar undangan tidak terkirim untuk data yang pasti ditolak
    // .eq terpisah, bukan .or(`…${nik}`) — NIK teks bebas tidak boleh disusun ke dalam string filter
    const { data: emailDipakai } = await sebagaiPemanggil.from('pengguna').select('id').eq('email', p.data.email).maybeSingle()
    if (emailDipakai) return galat(409, 'Email sudah terdaftar.')
    if (p.data.nik) {
      const { data: nikDipakai } = await sebagaiPemanggil.from('pengguna').select('id').eq('nik', p.data.nik).maybeSingle()
      if (nikDipakai) return galat(409, 'NIK sudah dipakai karyawan lain.')
    }

    const { data: undangan, error: eUndang } = await admin.auth.admin.inviteUserByEmail(p.data.email, { redirectTo: p.redirectTo })
    if (eUndang) {
      if (eUndang.code === 'email_exists' || eUndang.status === 422) return galat(409, 'Email sudah terdaftar.')
      console.error('undang', eUndang)
      return galat(502, 'Undangan gagal dikirim. Coba lagi beberapa saat.')
    }

    const { error: eSimpan } = await sebagaiPemanggil.from('pengguna').insert({ id: undangan.user.id, ...p.data })
    if (eSimpan) {
      await admin.auth.admin.deleteUser(undangan.user.id) // jangan tinggalkan akun Auth tanpa data pengguna
      console.error('simpan', eSimpan)
      return galat(eSimpan.code === '42501' ? 403 : 409, pesanDb(eSimpan))
    }
    return jawab(201, { id: undangan.user.id })
  }

  // kirim_ulang & ubah_email: target harus terlihat oleh pemanggil (RLS) dan boleh dikelolanya
  const { data: target } = await sebagaiPemanggil.from('pengguna').select('id, email, role, aktif').eq('id', p.id).maybeSingle()
  if (!target) return galat(404, 'Karyawan tidak ditemukan.')
  if (!boleh(peran, target.role)) return galat(403, 'Anda tidak berwenang mengelola akun ini.')

  if (p.aksi === 'kirim_ulang') {
    if (!target.aktif) return galat(409, 'Akun nonaktif tidak bisa diundang ulang.')
    const { data: akun } = await admin.auth.admin.getUserById(target.id)
    if (akun.user?.email_confirmed_at) return galat(409, 'Akun sudah aktif. Karyawan bisa memakai "Lupa password".')
    const { error } = await admin.auth.admin.inviteUserByEmail(target.email, { redirectTo: p.redirectTo })
    if (error) {
      console.error('kirim_ulang', error)
      return galat(502, 'Undangan gagal dikirim. Coba lagi beberapa saat.')
    }
    return jawab(200, { ok: true })
  }

  // ubah_email
  if (p.email === target.email) return jawab(200, { ok: true })
  const { data: dipakai } = await sebagaiPemanggil.from('pengguna').select('id').eq('email', p.email).maybeSingle()
  if (dipakai) return galat(409, 'Email sudah terdaftar.')

  const { error: eAuth } = await admin.auth.admin.updateUserById(target.id, { email: p.email, email_confirm: true })
  if (eAuth) {
    console.error('ubah_email auth', eAuth)
    return galat(eAuth.code === 'email_exists' ? 409 : 502, eAuth.code === 'email_exists' ? 'Email sudah terdaftar.' : 'Email gagal diubah.')
  }
  const { data: tersimpan, error: eData } = await sebagaiPemanggil.from('pengguna').update({ email: p.email }).eq('id', target.id).select('id')
  if (eData || !tersimpan?.length) {
    await admin.auth.admin.updateUserById(target.id, { email: target.email, email_confirm: true }) // kembalikan
    console.error('ubah_email data', eData)
    return galat(eData?.code === '42501' || !tersimpan?.length ? 403 : 409, eData ? pesanDb(eData) : 'Anda tidak berwenang melakukan ini.')
  }
  return jawab(200, { ok: true })
})

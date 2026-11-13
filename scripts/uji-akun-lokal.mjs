// Uji integrasi Edge Function `akun` terhadap stack LOKAL (bukan production).
// Prasyarat: `npx supabase start` dan `npx supabase functions serve akun --no-verify-jwt`.
// Jalankan: node --env-file=<(npx supabase status -o env) scripts/uji-akun-lokal.mjs
import { createClient } from '@supabase/supabase-js'

const { API_URL, ANON_KEY, SERVICE_ROLE_KEY } = process.env
if (!API_URL?.startsWith('http://127.0.0.1')) throw new Error('Hanya untuk stack lokal (API_URL 127.0.0.1)')
const MAILPIT = 'http://127.0.0.1:54324'
const REDIRECT = 'http://localhost:5173/atur-password'
const sfx = Date.now().toString(36)
const opsi = { auth: { persistSession: false, autoRefreshToken: false } }
const admin = createClient(API_URL, SERVICE_ROLE_KEY, opsi)

let gagal = 0
const cek = (ok, nama, detail = '') => {
  console.log(`${ok ? '✓' : '✗'} ${nama}${ok ? '' : `  ${detail}`}`)
  if (!ok) gagal++
}

async function buatPengguna(role, extra = {}) {
  const email = `${role}.${sfx}@uji.test`
  const { data, error } = await admin.auth.admin.createUser({ email, password: 'RahasiaUji123', email_confirm: true })
  if (error) throw error
  const baris = role === 'direksi'
    ? { id: data.user.id, nama: `Uji ${role}`, email, role }
    : { id: data.user.id, nama: `Uji ${role}`, email, role, nik: `UJI-${role}-${sfx}`, gaji_pokok: 5000000, tanggal_masuk: '2020-01-01', ...extra }
  const { error: e2 } = await admin.from('pengguna').insert(baris)
  if (e2) throw e2
  const klien = createClient(API_URL, ANON_KEY, opsi)
  await klien.auth.signInWithPassword({ email, password: 'RahasiaUji123' })
  return { id: data.user.id, email, klien }
}

const panggil = async (klien, isi) => {
  const { data: s } = await klien.auth.getSession()
  const r = await fetch(`${API_URL}/functions/v1/akun`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: ANON_KEY, Authorization: `Bearer ${s.session?.access_token ?? ANON_KEY}` },
    body: JSON.stringify(isi),
  })
  return { status: r.status, isi: await r.json() }
}

const hr = await buatPengguna('hr')
const direksi = await buatPengguna('direksi')
const atasan = await buatPengguna('atasan')
const karyawan = await buatPengguna('karyawan', { atasan_id: atasan.id })

const dataBaru = (role, extra = {}) => ({
  email: `Baru.${role}.${sfx}@UJI.test`, nama: 'Putri Anggraini', role, atasan_id: atasan.id,
  nik: `SMP-2026-${sfx}-${role}`, jabatan: 'Staf', tanggal_masuk: '2026-11-16', no_ktp: '3201015408960001',
  status_menikah: 'belum_menikah', jumlah_tanggungan: 0, gaji_pokok: 4300000, ...extra,
})

// --- undang ---
let r = await panggil(hr.klien, { aksi: 'undang', redirectTo: REDIRECT, data: { ...dataBaru('karyawan'), atasan_id: null } })
cek(r.status === 400 && r.isi.galat.includes('Atasan'), 'Karyawan tanpa atasan ditolak sebelum email', JSON.stringify(r))

r = await panggil(hr.klien, { aksi: 'undang', redirectTo: 'https://jahat.test/atur-password', data: dataBaru('karyawan') })
cek(r.status === 400 && r.isi.galat === 'Alamat aplikasi tidak diizinkan.', 'redirectTo ke domain lain ditolak', JSON.stringify(r))
r = await panggil(hr.klien, { aksi: 'undang', redirectTo: 'http://localhost:5173/lain', data: dataBaru('karyawan') })
cek(r.status === 400, 'redirectTo selain /atur-password ditolak', JSON.stringify(r))

r = await panggil(hr.klien, { aksi: 'undang', redirectTo: REDIRECT, data: dataBaru('karyawan') })
cek(r.status === 201 && r.isi.id, 'HR mengundang karyawan', JSON.stringify(r))
const idBaru = r.isi.id

const { data: baris } = await admin.from('pengguna').select('email, saldo_cuti, role').eq('id', idBaru).single()
cek(baris?.email === `baru.karyawan.${sfx}@uji.test`, 'Email disimpan huruf kecil', baris?.email)
cek(baris?.saldo_cuti === 1, 'Saldo awal otomatis: masuk 16 Nov → 1 hari', String(baris?.saldo_cuti))

const { data: log } = await admin.from('log_audit').select('oleh, aksi').eq('baris_id', idBaru).eq('aksi', 'insert').single()
cek(log?.oleh === hr.id, 'Log audit mencatat HR sebagai pelaku (bukan Sistem)', JSON.stringify(log))

r = await panggil(hr.klien, { aksi: 'undang', redirectTo: REDIRECT, data: { ...dataBaru('karyawan'), nik: `lain-${sfx}` } })
cek(r.status === 409 && r.isi.galat === 'Email sudah terdaftar.', 'Email ganda ditolak', JSON.stringify(r))

r = await panggil(hr.klien, { aksi: 'undang', redirectTo: REDIRECT, data: { ...dataBaru('karyawan'), email: `lain.${sfx}@uji.test` } })
cek(r.status === 409 && r.isi.galat.includes('NIK'), 'NIK ganda ditolak', JSON.stringify(r))

r = await panggil(hr.klien, { aksi: 'undang', redirectTo: REDIRECT, data: { ...dataBaru('direksi'), atasan_id: null, gaji_pokok: null, nik: null } })
cek(r.status === 403, 'HR tidak bisa membuat Direksi', JSON.stringify(r))

r = await panggil(direksi.klien, { aksi: 'undang', redirectTo: REDIRECT, data: dataBaru('karyawan', { email: `d.${sfx}@uji.test`, nik: `D-${sfx}` }) })
cek(r.status === 403, 'Direksi tidak bisa membuat Karyawan', JSON.stringify(r))

r = await panggil(direksi.klien, { aksi: 'undang', redirectTo: REDIRECT, data: dataBaru('hr', { atasan_id: null }) })
cek(r.status === 201, 'Direksi bisa membuat HR (EMP-08)', JSON.stringify(r))
const idHrBaru = r.isi.id

r = await panggil(karyawan.klien, { aksi: 'undang', redirectTo: REDIRECT, data: dataBaru('atasan', { email: `k.${sfx}@uji.test`, nik: `K-${sfx}` }) })
cek(r.status === 403, 'Karyawan tidak bisa mengundang', JSON.stringify(r))

r = await panggil(createClient(API_URL, ANON_KEY, opsi), { aksi: 'undang', redirectTo: REDIRECT, data: dataBaru('karyawan') })
cek(r.status === 401, 'Tanpa login ditolak', JSON.stringify(r))

// --- email undangan (Mailpit) ---
const surat = await (await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:baru.karyawan.${sfx}@uji.test`)}`)).json()
const idSurat = surat.messages?.[0]?.ID
const isiSurat = idSurat ? await (await fetch(`${MAILPIT}/api/v1/message/${idSurat}`)).json() : null
cek(isiSurat?.Subject === 'Undangan akun HRIS PT. SMP', 'Email undangan terkirim dengan subjek Indonesia', isiSurat?.Subject)
cek(/\/atur-password\?token_hash=[^&"]+&(amp;)?type=invite/.test(isiSurat?.HTML ?? ''), 'Link undangan membawa token_hash ke /atur-password')

// --- pakai link undangan seperti halaman /atur-password ---
const tokenHash = (isiSurat?.HTML ?? '').match(/token_hash=([^&"]+)/)?.[1]
const tamu = createClient(API_URL, ANON_KEY, opsi)
const { error: eVerif } = await tamu.auth.verifyOtp({ token_hash: tokenHash, type: 'invite' })
const { error: ePw } = eVerif ? { error: eVerif } : await tamu.auth.updateUser({ password: 'PasswordBaru123' })
cek(!eVerif && !ePw, 'Link undangan bisa dipakai membuat password', eVerif?.message ?? ePw?.message)
const { error: eMasuk } = await createClient(API_URL, ANON_KEY, opsi).auth.signInWithPassword({ email: `baru.karyawan.${sfx}@uji.test`, password: 'PasswordBaru123' })
cek(!eMasuk, 'Karyawan baru bisa login dengan password barunya', eMasuk?.message)

// --- kirim ulang ---
r = await panggil(direksi.klien, { aksi: 'kirim_ulang', redirectTo: REDIRECT, id: idHrBaru })
cek(r.status === 200, 'Kirim ulang undangan untuk akun belum aktif', JSON.stringify(r))
r = await panggil(hr.klien, { aksi: 'kirim_ulang', redirectTo: REDIRECT, id: idBaru })
cek(r.status === 409, 'Kirim ulang ditolak setelah karyawan membuat password', JSON.stringify(r))
r = await panggil(hr.klien, { aksi: 'kirim_ulang', redirectTo: REDIRECT, id: karyawan.id })
cek(r.status === 409 && r.isi.galat.includes('sudah aktif'), 'Kirim ulang ditolak untuk akun yang sudah aktif', JSON.stringify(r))

// --- ubah email ---
r = await panggil(hr.klien, { aksi: 'ubah_email', id: karyawan.id, email: `Ganti.${sfx}@uji.test` })
cek(r.status === 200, 'HR mengubah email karyawan', JSON.stringify(r))
const { data: akun } = await admin.auth.admin.getUserById(karyawan.id)
const { data: pk } = await admin.from('pengguna').select('email').eq('id', karyawan.id).single()
cek(akun.user.email === `ganti.${sfx}@uji.test` && pk.email === akun.user.email, 'Email Auth & pengguna sama-sama berubah', `${akun.user.email} / ${pk.email}`)
r = await panggil(hr.klien, { aksi: 'ubah_email', id: karyawan.id, email: hr.email })
cek(r.status === 409, 'Ubah ke email yang sudah dipakai ditolak', JSON.stringify(r))
r = await panggil(direksi.klien, { aksi: 'ubah_email', id: karyawan.id, email: `x.${sfx}@uji.test` })
cek(r.status === 403, 'Direksi tidak bisa mengubah email karyawan non-HR', JSON.stringify(r))

console.log(gagal ? `\n${gagal} uji GAGAL` : '\nSemua uji lolos')
process.exit(gagal ? 1 : 0)

// Uji integrasi Edge Function `bersihkan-selfie` terhadap stack LOKAL (bukan production).
// Prasyarat: `npx supabase start` dan `npx supabase functions serve`.
// Jalankan: node --env-file=<(npx supabase status -o env) scripts/uji-bersihkan-selfie-lokal.mjs
import { execFileSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'

const { API_URL, SERVICE_ROLE_KEY } = process.env
if (!API_URL?.startsWith('http://127.0.0.1')) throw new Error('Hanya untuk stack lokal (API_URL 127.0.0.1)')
const admin = createClient(API_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const psql = (sql) =>
  execFileSync('docker', ['exec', 'supabase_db_HRIS_PT_SMP', 'psql', '-U', 'postgres', '-tAc', sql], { encoding: 'utf8' }).trim()

let gagal = 0
const cek = (ok, nama, detail = '') => {
  console.log(`${ok ? '✓' : '✗'} ${nama}${ok ? '' : `  ${detail}`}`)
  if (!ok) gagal++
}

// Data: 1 absensi 13 bulan lalu (foto harus dihapus), 1 absensi 5 hari lalu (foto tetap), 1 foto yatim 3 hari
const sfx = Date.now().toString(36)
const email = `hr.${sfx}@uji.test`
const { data: u } = await admin.auth.admin.createUser({ email, password: 'Rahasia123', email_confirm: true })
const id = u.user.id
const { error: eP } = await admin.from('pengguna').insert({ id, nama: `HR ${sfx}`, email, role: 'hr', nik: `B-${sfx}`, gaji_pokok: 1, jabatan: 'HR', tanggal_masuk: '2020-01-01' })
if (eP) throw eP

const jpeg = new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type: 'image/jpeg' })
const path = { lama: `${id}/lama-${sfx}.jpg`, baru: `${id}/baru-${sfx}.jpg`, yatim: `${id}/yatim-${sfx}.jpg` }
for (const p of Object.values(path)) {
  const { error } = await admin.storage.from('selfie').upload(p, jpeg, { contentType: 'image/jpeg' })
  if (error) throw error
}
psql(`update storage.objects set created_at = now() - interval '3 days' where name = '${path.yatim}'`)

const tglLama = psql(`select ((now() at time zone 'Asia/Jakarta')::date - interval '13 months')::date`)
const tglBaru = psql(`select (now() at time zone 'Asia/Jakarta')::date - 5`)
const { data: ab, error: eA } = await admin.from('absensi').insert([
  { pengguna_id: id, tanggal: tglLama, jam_masuk: `${tglLama}T07:00:00+07:00`, jam_keluar: `${tglLama}T15:00:00+07:00`, foto_masuk_path: path.lama },
  { pengguna_id: id, tanggal: tglBaru, jam_masuk: `${tglBaru}T07:00:00+07:00`, jam_keluar: `${tglBaru}T15:00:00+07:00`, foto_masuk_path: path.baru },
]).select('id, tanggal')
if (eA) throw eA
const idLama = ab.find((a) => a.tanggal === tglLama).id

const panggil = (kunci) => fetch(`${API_URL}/functions/v1/bersihkan-selfie`, { method: 'POST', headers: { 'x-kunci-job': kunci, 'Content-Type': 'application/json' }, body: '{}' })

let r = await panggil('kunci-salah')
cek(r.status === 401, 'Tanpa kunci yang benar ditolak', r.status)

const kunci = psql(`select decrypted_secret from vault.decrypted_secrets where name = 'kunci_job_bersihkan_selfie'`)
r = await panggil(kunci)
const hasil = await r.json()
cek(r.status === 200 && hasil.absensi_dikosongkan >= 1 && hasil.file_kedaluwarsa_dihapus >= 1 && hasil.file_yatim_dihapus >= 1, 'Fungsi berjalan', JSON.stringify(hasil))

const { data: lama } = await admin.from('absensi').select('foto_masuk_path, jam_masuk, jam_keluar').eq('id', idLama).single()
cek(lama.foto_masuk_path === null, 'Path foto absensi > 12 bulan dikosongkan')
cek(new Date(lama.jam_masuk).getTime() === new Date(`${tglLama}T07:00:00+07:00`).getTime() && !!lama.jam_keluar, 'Jam absensi lama TETAP')

const ada = async (p) => {
  const folder = p.split('/')[0]
  const { data } = await admin.storage.from('selfie').list(folder, { search: p.split('/')[1] })
  return (data ?? []).some((f) => `${folder}/${f.name}` === p)
}
cek(!(await ada(path.lama)), 'File selfie > 12 bulan terhapus dari Storage')
cek(!(await ada(path.yatim)), 'File yatim > 2 hari terhapus')
cek(await ada(path.baru), 'File selfie baru (5 hari) TETAP ada')

console.log(gagal ? `\n${gagal} uji GAGAL` : '\nSemua uji lolos')
process.exit(gagal ? 1 : 0)

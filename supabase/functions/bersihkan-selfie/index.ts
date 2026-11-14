// Edge Function `bersihkan-selfie` — retensi selfie 12 bulan (ATT-10, security §5) + foto yatim > 2 hari.
// Dipanggil job pg_cron bulanan (public.panggil_bersihkan_selfie) dengan header x-kunci-job (kunci di Vault).
// Urutan: kosongkan path di absensi DULU, baru hapus file — bila hapus file gagal, file jadi yatim dan
// tersapu pada jalan berikutnya; jam absensi tidak pernah diubah.
import '@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from '@supabase/supabase-js'

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
})
const PER_HAPUS = 500 // batas aman per panggilan Storage remove

async function hapusFile(paths: string[]) {
  let terhapus = 0
  for (let i = 0; i < paths.length; i += PER_HAPUS) {
    const { data, error } = await admin.storage.from('selfie').remove(paths.slice(i, i + PER_HAPUS))
    if (error) throw new Error(`hapus file: ${error.message}`)
    terhapus += data.length
  }
  return terhapus
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return Response.json({ galat: 'Metode tidak didukung.' }, { status: 405 })
  const kunci = req.headers.get('x-kunci-job') ?? ''
  const { data: sah } = await admin.rpc('cek_kunci_job', { kunci })
  if (!sah) return Response.json({ galat: 'Tidak berwenang.' }, { status: 401 })

  try {
    // 1. Absensi > 12 bulan: kosongkan path, lalu hapus file
    const { data: lama, error: eLama } = await admin.rpc('selfie_kedaluwarsa')
    if (eLama) throw new Error(`selfie_kedaluwarsa: ${eLama.message}`)
    const baris = lama as { id: string; foto_masuk_path: string | null; foto_keluar_path: string | null }[]
    if (baris.length) {
      const { error } = await admin.from('absensi').update({ foto_masuk_path: null, foto_keluar_path: null }).in('id', baris.map((b) => b.id))
      if (error) throw new Error(`kosongkan path: ${error.message}`)
    }
    const fileLama = await hapusFile(baris.flatMap((b) => [b.foto_masuk_path, b.foto_keluar_path]).filter((p): p is string => !!p))

    // 2. Foto yatim > 2 hari (termasuk sisa langkah 1 yang gagal dihapus sebelumnya)
    const { data: yatim, error: eYatim } = await admin.rpc('selfie_yatim')
    if (eYatim) throw new Error(`selfie_yatim: ${eYatim.message}`)
    const fileYatim = await hapusFile(yatim as string[])

    const hasil = { absensi_dikosongkan: baris.length, file_kedaluwarsa_dihapus: fileLama, file_yatim_dihapus: fileYatim }
    console.log('bersihkan-selfie', hasil)
    return Response.json(hasil)
  } catch (e) {
    console.error('bersihkan-selfie gagal', e)
    return Response.json({ galat: String(e) }, { status: 500 })
  }
})

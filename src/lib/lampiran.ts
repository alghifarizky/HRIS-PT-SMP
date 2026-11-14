// Siapkan lampiran surat dokter/dokumen (security §5: ≤ 5 MB, gambar/PDF). Foto diperkecil di browser agar foto HP
// (sering > 5 MB) tetap bisa diunggah — keputusan Al 14 Nov 2026: sisi terpanjang 1600 px, JPEG.
export const MAKS_LAMPIRAN = 5 * 1024 * 1024
const SISI_MAKS = 1600

export async function siapkanLampiran(file: File): Promise<{ blob: Blob; ext: string }> {
  if (file.type === 'application/pdf') {
    if (file.size > MAKS_LAMPIRAN) throw new Error('PDF lebih dari 5 MB. Perkecil atau foto dokumennya saja.')
    return { blob: file, ext: 'pdf' }
  }
  if (!file.type.startsWith('image/')) throw new Error('Pilih foto atau file PDF.')
  try {
    const gambar = await createImageBitmap(file)
    const skala = Math.min(1, SISI_MAKS / Math.max(gambar.width, gambar.height))
    const kanvas = document.createElement('canvas')
    kanvas.width = Math.round(gambar.width * skala)
    kanvas.height = Math.round(gambar.height * skala)
    kanvas.getContext('2d')!.drawImage(gambar, 0, 0, kanvas.width, kanvas.height)
    const blob = await new Promise<Blob | null>((ok) => kanvas.toBlob(ok, 'image/jpeg', 0.85))
    if (blob) return { blob, ext: 'jpg' }
  } catch {
    // format yang tidak bisa dibaca browser (mis. HEIC di Chrome) — kirim apa adanya bila cukup kecil
  }
  if (file.size > MAKS_LAMPIRAN) throw new Error('Foto lebih dari 5 MB dan tidak bisa diperkecil. Coba foto ulang.')
  return { blob: file, ext: file.name.split('.').pop()?.toLowerCase() || 'jpg' }
}

export const ukuranFile = (b: number) => (b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1).replace('.', ',')} MB`)

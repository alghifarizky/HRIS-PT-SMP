// Alasan perubahan dikirim lewat header "x-alasan" (base64 UTF-8 — header HTTP hanya ASCII), dibaca trigger
// log audit lewat public.alasan_permintaan(). Wajib di DB bila gaji pokok, peran, atau atasan berubah.
export const HEADER_ALASAN = 'x-alasan'

export function kodeAlasan(alasan: string) {
  let biner = ''
  for (const b of new TextEncoder().encode(alasan.trim())) biner += String.fromCharCode(b)
  return btoa(biner)
}

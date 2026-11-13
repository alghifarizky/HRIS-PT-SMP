export type AlasanNonaktif = 'resign' | 'kontrak_berakhir' | 'phk' | 'pensiun' | 'meninggal_dunia' | 'lainnya'

export const LABEL_ALASAN_NONAKTIF: Record<AlasanNonaktif, string> = {
  resign: 'Resign',
  kontrak_berakhir: 'Kontrak berakhir',
  phk: 'PHK',
  pensiun: 'Pensiun',
  meninggal_dunia: 'Meninggal dunia',
  lainnya: 'Lainnya',
}

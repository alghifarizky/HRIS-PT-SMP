import { describe, expect, it } from 'vitest'
import { durasiJam, rentangTanggal } from './pengajuan'

describe('pengajuan', () => {
  it('durasi jam lembur', () => {
    expect(durasiJam('12:00:00', '14:30:00')).toBe('2,5 jam')
    expect(durasiJam('15:00:00', '17:00:00')).toBe('2 jam')
  })
  it('rentang tanggal', () => {
    expect(rentangTanggal('2026-11-02', '2026-11-02')).toBe('Sen, 2 Nov 2026')
    expect(rentangTanggal('2026-12-24', '2026-12-29')).toBe('24 – 29 Des 2026')
    expect(rentangTanggal('2026-11-30', '2026-12-02')).toBe('30 Nov – 2 Des 2026')
    expect(rentangTanggal('2026-12-24', '2026-12-29', true)).toBe('Kam, 24 Des – Sel, 29 Des 2026')
  })
})

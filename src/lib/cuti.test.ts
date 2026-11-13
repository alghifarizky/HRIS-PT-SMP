import { describe, expect, it } from 'vitest'
import { jatahProporsional } from './cuti'

// Kasus sama dengan supabase/tests/saldo_nik.test.sql
describe('jatahProporsional (cermin SQL)', () => {
  it.each([
    ['2026-03-15', 12, 9], ['2026-11-16', 12, 1], ['2026-03-01', 12, 10], ['2026-12-02', 12, 0],
    ['2026-01-01', 12, 12], ['2019-03-04', 12, 12], ['2027-01-04', 12, 0], ['2026-07-10', 14, 5],
  ])('masuk %s, jatah %i → %i', (tgl, jatah, harap) => expect(jatahProporsional(jatah, tgl, '2026-11-13').hari).toBe(harap))
  it('daftar bulan penuh tersisa', () => expect(jatahProporsional(12, '2026-11-16', '2026-11-13').bulan).toEqual(['Desember']))
})

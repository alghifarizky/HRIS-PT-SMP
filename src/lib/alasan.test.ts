import { describe, expect, it } from 'vitest'
import { kodeAlasan } from './alasan'

const balik = (b64: string) => new TextDecoder().decode(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)))

describe('kodeAlasan', () => {
  it('ASCII sama dengan base64 biasa', () => expect(kodeAlasan('Uji otomatis')).toBe('VWppIG90b21hdGlz'))
  it('UTF-8 (tanda pisah) bolak-balik utuh', () => expect(balik(kodeAlasan('Mutasi ke tim Operasional — Cikarang'))).toBe('Mutasi ke tim Operasional — Cikarang'))
  it('spasi di tepi dibuang', () => expect(balik(kodeAlasan('  Naik jabatan  '))).toBe('Naik jabatan'))
})

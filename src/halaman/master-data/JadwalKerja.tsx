// MST-01 — B3C hal 11. Perubahan langsung berlaku (keputusan Al, 13 Nov 2026).
// Isian jam teks 24 jam, bukan <input type="time"> — yang itu ikut bahasa OS (bisa AM/PM).
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Lock } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { jamValid, keteranganJadwal, NAMA_HARI, rapikanJam } from '../../lib/jadwal'
import { BannerGalat, Tombol } from '../../komponen/form'
import { KeadaanGalat, Skeleton } from '../../komponen/keadaan'
import { useToast } from '../../komponen/toast'

type Jadwal = { hari: number; jam_masuk: string; jam_pulang: string }
const jj = (t: string) => t.slice(0, 5) // "07:00:00" → "07:00"

export default function JadwalKerja() {
  const qc = useQueryClient()
  const toast = useToast()
  const [ubahan, setUbahan] = useState<Record<number, Partial<Jadwal>>>({})

  const q = useQuery({
    queryKey: ['jadwal_kerja'],
    queryFn: async () => {
      const { data, error } = await supabase.from('jadwal_kerja').select('hari, jam_masuk, jam_pulang').order('hari')
      if (error) throw error
      return (data as Jadwal[]).map((j) => ({ ...j, jam_masuk: jj(j.jam_masuk), jam_pulang: jj(j.jam_pulang) }))
    },
  })

  const baris = (q.data ?? []).map((j) => ({ ...j, ...ubahan[j.hari] }))
  const berubah = baris.filter((b, i) => b.jam_masuk !== q.data![i].jam_masuk || b.jam_pulang !== q.data![i].jam_pulang)
  const adaGalat = baris.some((b) => !keteranganJadwal(b.hari, b.jam_masuk, b.jam_pulang))

  const simpan = useMutation({
    mutationFn: async () => {
      for (const b of berubah) {
        const { data, error } = await supabase
          .from('jadwal_kerja')
          .update({ jam_masuk: b.jam_masuk, jam_pulang: b.jam_pulang })
          .eq('hari', b.hari)
          .select('hari')
        if (error) throw error
        if (!data.length) throw new Error('tanpa izin')
      }
    },
    onSuccess: () => {
      setUbahan({})
      toast('Jadwal kerja disimpan.')
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['jadwal_kerja'] }),
  })

  const set = (hari: number, kolom: 'jam_masuk' | 'jam_pulang', nilai: string) =>
    setUbahan((u) => ({ ...u, [hari]: { ...u[hari], [kolom]: nilai } }))

  return (
    <section className="rounded-kartu border border-garis bg-permukaan" aria-labelledby="judul-jadwal">
      <h2 id="judul-jadwal" className="border-b border-garis px-5 py-4 text-[17px] leading-6 font-semibold">
        Jadwal kerja mingguan
      </h2>

      {q.isPending ? (
        <Skeleton baris={7} />
      ) : q.isError ? (
        <KeadaanGalat judul="Jadwal kerja gagal dimuat" onCobaLagi={() => q.refetch()} />
      ) : (
        <>
          <table className="w-full text-left text-[15px]">
            <thead className="bg-latar text-[13px] font-semibold tracking-wide text-teks-sekunder uppercase">
              <tr>
                <th scope="col" className="px-5 py-3">Hari</th>
                <th scope="col" className="px-5 py-3">Masuk</th>
                <th scope="col" className="px-5 py-3">Pulang</th>
                <th scope="col" className="px-5 py-3">Keterangan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-garis">
              {baris.map((b) => {
                const ket = keteranganJadwal(b.hari, b.jam_masuk, b.jam_pulang)
                return (
                  <tr key={b.hari}>
                    <th scope="row" className="px-5 py-3 font-semibold">{NAMA_HARI[b.hari]}</th>
                    {(['jam_masuk', 'jam_pulang'] as const).map((k) => (
                      <td key={k} className="px-5 py-3">
                        <input
                          type="text"
                          inputMode="numeric"
                          placeholder="07:00"
                          maxLength={5}
                          required
                          value={b[k]}
                          onChange={(e) => set(b.hari, k, e.target.value)}
                          onBlur={(e) => set(b.hari, k, rapikanJam(e.target.value))}
                          aria-label={`Jam ${k === 'jam_masuk' ? 'masuk' : 'pulang'} ${NAMA_HARI[b.hari]}`}
                          aria-invalid={!ket || undefined}
                          className={`fokus-ring h-11 w-[96px] rounded-kontrol border bg-permukaan px-3 tabular-nums ${ket ? 'border-garis' : 'border-bahaya-ikon'}`}
                        />
                      </td>
                    ))}
                    <td className={`px-5 py-3 ${ket ? 'text-teks-sekunder' : 'text-bahaya'}`}>{ket ?? (jamValid(b.jam_masuk) && jamValid(b.jam_pulang) ? 'Jam pulang harus setelah jam masuk (Sen–Jum lebih dari 1 jam).' : 'Isi jam format 24 jam, contoh 15:30.')}</td>
                  </tr>
                )
              })}
              <tr className="bg-latar/60">
                <th scope="row" className="px-5 py-3 font-semibold">Minggu</th>
                <td colSpan={2} className="px-5 py-3 text-teks-sekunder">
                  <span className="inline-flex items-center gap-2">
                    <Lock className="size-4" aria-hidden /> Libur · tidak bisa diedit
                  </span>
                </td>
                <td className="px-5 py-3 text-teks-sekunder">Libur</td>
              </tr>
            </tbody>
          </table>

          {simpan.isError && (
            <div className="px-5 pt-4">
              <BannerGalat>Jadwal gagal disimpan. Periksa koneksi Anda, lalu coba lagi — isian Anda tidak hilang.</BannerGalat>
            </div>
          )}
          <div className="flex items-center justify-between gap-4 border-t border-garis px-5 py-4">
            <p className="text-sm text-teks-sekunder">Perubahan langsung berlaku dan tercatat di Log audit.</p>
            <Tombol onClick={() => simpan.mutate()} memproses={simpan.isPending} disabled={!berubah.length || adaGalat}>
              Simpan perubahan
            </Tombol>
          </div>
        </>
      )}
    </section>
  )
}

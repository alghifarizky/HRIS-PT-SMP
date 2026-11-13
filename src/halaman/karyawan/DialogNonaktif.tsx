// EMP-02 — Nonaktifkan (B3A hal 19), batalkan jadwal, aktifkan kembali (keputusan Al, 13 Nov 2026).
// Aturan & ban akun dijaga trigger kelola_nonaktif; dialog hanya mengirim kolom.
import { useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CircleAlert } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { jatahProporsional } from '../../lib/cuti'
import { dariTanggalDb, hariIniDb, tanggalPendek } from '../../lib/format'
import { BannerGalat, Field, Input, Tombol } from '../../komponen/form'
import Dialog from '../../komponen/Dialog'
import { useToast } from '../../komponen/toast'
import { LABEL_ALASAN_NONAKTIF, type AlasanNonaktif } from './label'
import type { DetailKaryawan } from './data'

const kelasIsian = 'fokus-ring w-full rounded-kontrol border border-garis bg-permukaan px-3 text-[15px]'

/** Simpan perubahan kolom penonaktifan; pesan trigger DB (Bahasa Indonesia) diteruskan apa adanya. */
function useSimpan(k: DetailKaryawan, pesanSukses: string, onTutup: () => void) {
  const qc = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: async (ubah: Record<string, unknown>) => {
      const { data, error } = await supabase.from('pengguna').update(ubah).eq('id', k.id).select('id')
      if (error) {
        if (/membawahi|akun sendiri|Direksi hanya/.test(error.message)) throw new Error(error.message)
        throw new Error('Perubahan gagal disimpan. Periksa koneksi Anda, lalu coba lagi.')
      }
      if (!data.length) throw new Error('Anda tidak berwenang mengubah status karyawan ini.')
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['karyawan'] })
      await qc.invalidateQueries({ queryKey: ['info_login', k.id] })
      toast(pesanSukses)
      onTutup()
    },
  })
}

function Aksi({ onTutup, children }: { onTutup: () => void; children: ReactNode }) {
  return (
    <div className="mt-6 flex justify-end gap-3">
      <Tombol varian="sekunder" onClick={onTutup}>Batal</Tombol>
      {children}
    </div>
  )
}

export function DialogNonaktifkan({ k, onTutup }: { k: DetailKaryawan; onTutup: () => void }) {
  const hariIni = hariIniDb()
  const [tanggal, setTanggal] = useState(hariIni)
  const [alasan, setAlasan] = useState<AlasanNonaktif>('resign')
  const [catatan, setCatatan] = useState('')
  const m = useSimpan(k, tanggal < hariIni ? `${k.nama} dinonaktifkan.` : `${k.nama} dijadwalkan nonaktif setelah ${tanggalPendek(dariTanggalDb(tanggal))}.`, onTutup)
  const langsung = !!tanggal && tanggal < hariIni

  return (
    <Dialog judul={`Nonaktifkan ${k.nama}?`} onTutup={onTutup}>
      <div className="flex flex-col gap-4">
        <Field
          id="tanggal-efektif"
          label="Tanggal efektif"
          wajib
          galat={!tanggal ? 'Tanggal efektif wajib diisi.' : undefined}
          bantuan={langsung ? 'Tanggal sudah lewat — akun langsung dinonaktifkan saat disimpan.' : 'Akun tetap aktif sampai akhir tanggal ini.'}
        >
          <Input id="tanggal-efektif" type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} galat={!tanggal} />
        </Field>
        <Field id="alasan-nonaktif" label="Alasan" wajib>
          <select id="alasan-nonaktif" value={alasan} onChange={(e) => setAlasan(e.target.value as AlasanNonaktif)} className={`${kelasIsian} h-12 lg:h-11`}>
            {(Object.keys(LABEL_ALASAN_NONAKTIF) as AlasanNonaktif[]).map((a) => (
              <option key={a} value={a}>{LABEL_ALASAN_NONAKTIF[a]}</option>
            ))}
          </select>
        </Field>
        <Field id="catatan-nonaktif" label="Catatan (opsional)">
          <textarea id="catatan-nonaktif" rows={2} maxLength={500} value={catatan} onChange={(e) => setCatatan(e.target.value)} placeholder="Contoh: Surat resign diterima Sen, 2 Nov 2026." className={`${kelasIsian} py-3 placeholder:text-teks-3`} />
        </Field>
        <p className="flex gap-3 rounded-kontrol bg-peringatan-latar p-3 text-[15px] text-peringatan">
          <CircleAlert className="mt-0.5 size-5 shrink-0 text-peringatan-ikon" aria-hidden />
          Akun tidak bisa login; data & slip tetap tersimpan. Pengajuan yang masih Menunggu akan dibatalkan otomatis.
        </p>
        {m.isError && <BannerGalat>{m.error.message}</BannerGalat>}
      </div>
      <Aksi onTutup={onTutup}>
        <Tombol
          varian="bahaya"
          disabled={!tanggal}
          memproses={m.isPending}
          onClick={() => m.mutate({ tanggal_nonaktif: tanggal, alasan_nonaktif: alasan, catatan_nonaktif: catatan.trim() || null })}
        >
          Nonaktifkan
        </Tombol>
      </Aksi>
    </Dialog>
  )
}

export function DialogBatalNonaktif({ k, onTutup }: { k: DetailKaryawan; onTutup: () => void }) {
  const m = useSimpan(k, `Penonaktifan ${k.nama} dibatalkan.`, onTutup)
  return (
    <Dialog judul="Batalkan penonaktifan?" onTutup={onTutup}>
      <p className="text-[15px] leading-[22px] text-teks-sekunder">
        {k.nama} dijadwalkan nonaktif setelah {tanggalPendek(dariTanggalDb(k.tanggal_nonaktif!))}. Jika dibatalkan, akun tetap aktif seperti biasa.
      </p>
      {m.isError && <div className="mt-4"><BannerGalat>{m.error.message}</BannerGalat></div>}
      <Aksi onTutup={onTutup}>
        <Tombol memproses={m.isPending} onClick={() => m.mutate({ tanggal_nonaktif: null, alasan_nonaktif: null, catatan_nonaktif: null })}>
          Ya, batalkan
        </Tombol>
      </Aksi>
    </Dialog>
  )
}

export function DialogAktifkanKembali({ k, onTutup }: { k: DetailKaryawan; onTutup: () => void }) {
  const pengaturan = useQuery({
    queryKey: ['pengaturan'],
    queryFn: async () => {
      const { data, error } = await supabase.from('pengaturan').select('jatah_cuti_tahunan, tanggal_cut_off').single()
      if (error) throw error
      return data as { jatah_cuti_tahunan: number; tanggal_cut_off: number }
    },
  })
  const hariIni = hariIniDb()
  const usulan = pengaturan.data ? jatahProporsional(pengaturan.data.jatah_cuti_tahunan, hariIni, hariIni).hari : null
  const [saldo, setSaldo] = useState<string | null>(null) // null = pakai usulan
  const nilaiSaldo = saldo ?? (usulan != null ? String(usulan) : '')
  const saldoValid = /^\d{1,3}$/.test(nilaiSaldo)
  const m = useSimpan(k, `${k.nama} diaktifkan kembali.`, onTutup)
  const butuhSaldo = k.role !== 'direksi'

  return (
    <Dialog judul={`Aktifkan kembali ${k.nama}?`} onTutup={onTutup}>
      <p className="text-[15px] leading-[22px] text-teks-sekunder">
        Akun bisa login lagi dengan password lamanya (atau lewat "Lupa password"). Data & riwayat sebelumnya tetap ada.
      </p>
      {butuhSaldo && (
        <div className="mt-4">
          <Field
            id="saldo-aktif"
            label="Saldo cuti tahun ini"
            wajib
            galat={nilaiSaldo && !saldoValid ? 'Isi angka 0–999.' : undefined}
            bantuan={usulan != null ? `Usulan ${usulan} hari: proporsional sejak hari ini. Boleh diubah.` : undefined}
          >
            <div className="flex items-center gap-3">
              <Input id="saldo-aktif" inputMode="numeric" value={nilaiSaldo} onChange={(e) => setSaldo(e.target.value.replace(/\D/g, '').slice(0, 3))} className="w-[120px]" />
              <span className="text-[15px] text-teks-sekunder">hari</span>
            </div>
          </Field>
        </div>
      )}
      {m.isError && <div className="mt-4"><BannerGalat>{m.error.message}</BannerGalat></div>}
      <Aksi onTutup={onTutup}>
        <Tombol
          disabled={butuhSaldo && !saldoValid}
          memproses={m.isPending}
          onClick={() => m.mutate(butuhSaldo ? { aktif: true, saldo_cuti: Number(nilaiSaldo) } : { aktif: true })}
        >
          Aktifkan kembali
        </Tombol>
      </Aksi>
    </Dialog>
  )
}

// Detail karyawan — HR B3A hal 14 (Profil), 18 (Riwayat perubahan), 20 (KTP ditampilkan); Direksi B4 hal 28–33.
// Tab Absensi/Pengajuan/Slip menyusul di fasenya. Nonaktifkan menyusul di langkah 2.5.
// Direksi: hanya-baca + jalur darurat "Jadikan HR" (PRD EMP-08, keputusan Al 13 Nov 2026).
import { useState, type ReactNode } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useProfil } from '../../auth/sesi'
import { LABEL_PERAN } from '../../navigasi'
import { dariTanggalDb, rupiah, tahunIni, tanggalPanjang, tanggalPendek, waktuSingkat } from '../../lib/format'
import { BannerGalat, Field, Tombol } from '../../komponen/form'
import { Badge, KeadaanGalat, KeadaanKosong, Skeleton } from '../../komponen/keadaan'
import Dialog from '../../komponen/Dialog'
import { useToast } from '../../komponen/toast'
import { useDaftarKaryawan, useKaryawan, type DetailKaryawan as Detail } from './data'
import { uraikanLog, type BarisLog } from './riwayat'
import { HEADER_ALASAN, kodeAlasan } from '../../lib/alasan'

const TAB = [
  { id: 'profil', label: 'Profil' },
  { id: 'absensi', label: 'Absensi' },
  { id: 'pengajuan', label: 'Pengajuan' },
  { id: 'slip', label: 'Slip gaji' },
  { id: 'riwayat', label: 'Riwayat perubahan' },
] as const

const inisial = (nama: string) => nama.split(' ').slice(0, 2).map((k) => k[0]).join('').toUpperCase()
const tgl = (s: string | null) => (s ? tanggalPendek(dariTanggalDb(s)) : '—')

export default function DetailKaryawan() {
  const { id } = useParams()
  const peranSaya = useProfil().data!.role
  const q = useKaryawan(id)
  const [params, setParams] = useSearchParams()
  const tab = TAB.find((t) => t.id === params.get('tab')) ?? TAB[0]
  const [jadikanHr, setJadikanHr] = useState(false)

  if (q.isPending) return <Skeleton baris={10} />
  if (q.isError) return <KeadaanGalat judul="Data karyawan gagal dimuat" onCobaLagi={() => q.refetch()} />
  if (!q.data) return <KeadaanKosong judul="Karyawan tidak ditemukan" pesan="Data mungkin sudah dihapus atau tautan salah." />
  const k = q.data
  const bolehJadikanHr = peranSaya === 'direksi' && k.aktif && (k.role === 'karyawan' || k.role === 'atasan')

  return (
    <div>
      <nav aria-label="Breadcrumb" className="text-sm text-teks-sekunder">
        <Link to="/panel/karyawan" className="fokus-ring rounded text-primer hover:underline">Karyawan</Link> › {k.nama}
      </nav>

      <div className="mt-3 rounded-kartu border border-garis bg-permukaan px-6 pt-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="flex size-14 items-center justify-center rounded-full bg-primer-100 text-lg font-semibold text-primer" aria-hidden>
              {inisial(k.nama)}
            </span>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-[24px] leading-8 font-semibold">{k.nama}</h1>
                {k.aktif ? <Badge nada="sukses">Aktif</Badge> : <Badge nada="netral">Nonaktif</Badge>}
              </div>
              <p className="mt-0.5 text-[15px] text-teks-sekunder">
                {[k.jabatan, LABEL_PERAN[k.role], k.nik, k.atasan && `Atasan: ${k.atasan.nama}`].filter(Boolean).join(' · ')}
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            {peranSaya === 'hr' && (
              <Link to={`/panel/karyawan/${k.id}/edit`} className="fokus-ring flex h-11 items-center rounded-kontrol border border-garis bg-permukaan px-5 font-semibold hover:bg-latar">
                Edit
              </Link>
            )}
            {bolehJadikanHr && (
              <Tombol varian="sekunder" onClick={() => setJadikanHr(true)}>
                Jadikan HR
              </Tombol>
            )}
          </div>
        </div>

        <div role="tablist" aria-label="Bagian detail karyawan" className="mt-4 flex gap-1">
          {TAB.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`tab-${t.id}`}
              aria-selected={t.id === tab.id}
              aria-controls="panel-detail"
              onClick={() => setParams(t.id === 'profil' ? {} : { tab: t.id }, { replace: true })}
              className={`fokus-ring -mb-px h-11 border-b-2 px-4 text-[15px] ${t.id === tab.id ? 'border-primer font-semibold text-primer' : 'border-transparent text-teks-sekunder hover:text-teks'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div role="tabpanel" id="panel-detail" aria-labelledby={`tab-${tab.id}`} className="mt-4">
        {tab.id === 'profil' && <Profil k={k} />}
        {tab.id === 'riwayat' && <Riwayat id={k.id} />}
        {tab.id === 'absensi' && <Menyusul judul="Absensi" fase="Fase 3 (absensi)" />}
        {tab.id === 'pengajuan' && <Menyusul judul="Pengajuan" fase="Fase 4 (lembur & cuti)" />}
        {tab.id === 'slip' && <Menyusul judul="Slip gaji" fase="Fase 5 (payroll)" />}
      </div>

      {jadikanHr && <DialogJadikanHr k={k} onTutup={() => setJadikanHr(false)} />}
    </div>
  )
}

function Kartu({ judul, children }: { judul: string; children: ReactNode }) {
  return (
    <section className="rounded-kartu border border-garis bg-permukaan p-5">
      <h2 className="border-b border-garis pb-2 text-[13px] font-semibold tracking-wide text-teks-sekunder uppercase">{judul}</h2>
      <dl className="divide-y divide-garis">{children}</dl>
    </section>
  )
}

function Baris({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 text-[15px]">
      <dt className="text-teks-sekunder">{label}</dt>
      <dd className="text-right font-semibold">{children}</dd>
    </div>
  )
}

function Profil({ k }: { k: Detail }) {
  const qc = useQueryClient()
  const toast = useToast()
  const peranSaya = useProfil().data!.role
  const direksi = k.role === 'direksi'
  const [ktp, setKtp] = useState<string | null>(null)
  const [galat, setGalat] = useState<string | null>(null)

  const login = useQuery({
    queryKey: ['info_login', k.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('info_login', { target: k.id })
      if (error) throw error
      return (data as { sudah_aktif: boolean; login_terakhir: string | null }[])[0] ?? null
    },
  })

  const lihat = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('lihat_ktp', { target: k.id })
      if (error) throw error
      return data as string | null
    },
    onSuccess: (no) => {
      setKtp(no ?? '')
      qc.invalidateQueries({ queryKey: ['log', k.id] })
    },
    onError: () => setGalat('No. KTP gagal ditampilkan. Periksa koneksi Anda, lalu coba lagi.'),
  })

  // HR mengelola semua kecuali Direksi; Direksi hanya HR (sama dengan Edge Function akun)
  const bolehKelolaAkun = (peranSaya === 'hr' && !direksi) || (peranSaya === 'direksi' && k.role === 'hr')
  const kirimUlang = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.functions.invoke('akun', {
        body: { aksi: 'kirim_ulang', redirectTo: `${window.location.origin}/atur-password`, id: k.id },
      })
      if (error) {
        const isi = await (error as { context?: Response }).context?.json?.().catch(() => null)
        throw new Error(isi?.galat ?? 'Undangan gagal dikirim. Periksa koneksi Anda, lalu coba lagi.')
      }
    },
    onSuccess: () => toast(`Undangan dikirim ulang ke ${k.email}.`),
    onError: (e) => setGalat(e.message),
  })

  return (
    <div className="flex flex-col gap-4">
      {galat && <BannerGalat>{galat}</BannerGalat>}
      <div className="grid grid-cols-3 items-start gap-4">
        <Kartu judul="Data pribadi">
          <Baris label="Nama lengkap">{k.nama}</Baris>
          <Baris label="Tanggal lahir">{tgl(k.tanggal_lahir)}</Baris>
          <Baris label="No. KTP">
            {ktp !== null ? (
              <span className="flex flex-col items-end gap-1">
                <span className="flex items-center gap-3 tabular-nums">
                  {ktp || '—'}
                  <button type="button" onClick={() => setKtp(null)} className="fokus-ring rounded font-semibold text-primer">Sembunyikan</button>
                </span>
                <span className="text-[13px] font-normal text-teks-sekunder">Tindakan ini tercatat di Log audit.</span>
              </span>
            ) : k.no_ktp_tersamar ? (
              <span className="flex items-center gap-3 tabular-nums">
                {k.no_ktp_tersamar}
                <button type="button" disabled={lihat.isPending} onClick={() => lihat.mutate()} className="fokus-ring rounded font-semibold text-primer disabled:opacity-60">
                  {lihat.isPending ? 'Memuat…' : 'Tampilkan'}
                </button>
              </span>
            ) : (
              '—'
            )}
          </Baris>
          <Baris label="Alamat">{k.alamat ?? '—'}</Baris>
          <Baris label="Status menikah">{k.status_menikah === 'menikah' ? 'Menikah' : k.status_menikah ? 'Belum menikah' : '—'}</Baris>
          <Baris label="Tanggungan">{k.jumlah_tanggungan}</Baris>
        </Kartu>

        <Kartu judul="Kepegawaian">
          <Baris label="NIK karyawan"><span className="tabular-nums">{k.nik ?? '—'}</span></Baris>
          <Baris label="Jabatan">{k.jabatan ?? '—'}</Baris>
          <Baris label="Peran">{LABEL_PERAN[k.role]}</Baris>
          {!direksi && <Baris label="Atasan langsung">{k.atasan?.nama ?? '—'}</Baris>}
          <Baris label="Tanggal masuk">{k.tanggal_masuk ? tanggalPanjang(dariTanggalDb(k.tanggal_masuk)) : '—'}</Baris>
          {!direksi && <Baris label="Gaji pokok"><span className="tabular-nums">{k.gaji_pokok != null ? rupiah(k.gaji_pokok) : '—'}</span></Baris>}
        </Kartu>

        <Kartu judul={direksi ? 'Akun' : 'Akun & cuti'}>
          <Baris label="Email"><span className="break-all">{k.email}</span></Baris>
          <Baris label="Status login">
            {login.isPending ? '…' : login.isError || !login.data ? '—' : login.data.sudah_aktif ? 'Aktif' : <Badge nada="peringatan">Menunggu undangan</Badge>}
          </Baris>
          <Baris label="Login terakhir">
            {login.data?.login_terakhir ? `${waktuSingkat(new Date(login.data.login_terakhir))} WIB` : login.isPending ? '…' : 'Belum pernah'}
          </Baris>
          {!direksi && <Baris label={`Saldo cuti ${tahunIni()}`}>{k.aktif && k.saldo_cuti != null ? `${k.saldo_cuti} hari` : '—'}</Baris>}
          {/* shortcut: "Cuti menunggu" (desain hal 14) menyusul bersama fitur cuti (Fase 4) */}
          {login.data && !login.data.sudah_aktif && k.aktif && bolehKelolaAkun && (
            <div className="pt-3">
              <Tombol varian="sekunder" className="w-full" onClick={() => kirimUlang.mutate()} memproses={kirimUlang.isPending}>
                Kirim ulang undangan
              </Tombol>
            </div>
          )}
        </Kartu>
      </div>
    </div>
  )
}

function Riwayat({ id }: { id: string }) {
  const daftar = useDaftarKaryawan()
  const q = useQuery({
    queryKey: ['log', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('log_audit')
        .select('id, aksi, nilai_lama, nilai_baru, alasan, pada, pelaku:pengguna!oleh(nama, role)')
        .eq('tabel', 'pengguna')
        .eq('baris_id', id)
        .order('pada', { ascending: false })
      if (error) throw error
      return data as unknown as (BarisLog & { id: string; pada: string; alasan: string | null; pelaku: { nama: string; role: keyof typeof LABEL_PERAN } | null })[]
    },
  })
  const namaPengguna = (pid: string) => daftar.data?.find((p) => p.id === pid)?.nama ?? '(tidak dikenal)'

  return (
    <section aria-labelledby="judul-riwayat" className="rounded-kartu border border-garis bg-permukaan">
      <h2 id="judul-riwayat" className="border-b border-garis px-5 py-4 text-[17px] leading-6 font-semibold">Riwayat perubahan</h2>
      {q.isPending ? (
        <Skeleton baris={4} />
      ) : q.isError ? (
        <KeadaanGalat judul="Riwayat gagal dimuat" onCobaLagi={() => q.refetch()} />
      ) : !q.data.length ? (
        <KeadaanKosong judul="Belum ada riwayat" pesan="Perubahan data karyawan ini akan tercatat di sini." />
      ) : (
        <ol className="divide-y divide-garis">
          {q.data.map((log) => {
            const { judul, perubahan } = uraikanLog(log, namaPengguna)
            return (
              <li key={log.id} className="grid grid-cols-[220px_1fr] gap-4 px-5 py-4 text-[15px]">
                <div>
                  <p className="tabular-nums">{waktuSingkat(new Date(log.pada))}</p>
                  <p className="text-sm text-teks-sekunder">{log.pelaku ? `${log.pelaku.nama} (${LABEL_PERAN[log.pelaku.role]})` : 'Sistem'}</p>
                </div>
                <div>
                  <p className="font-semibold">{judul}</p>
                  {perubahan.length > 0 && (
                    <ul className="mt-1 space-y-0.5 text-teks-sekunder">
                      {perubahan.map((p) => (
                        <li key={p.label}>
                          {p.label}: <span className="text-teks">{p.lama}</span> → <span className="font-semibold text-teks">{p.baru}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {log.alasan && <p className="mt-1 text-sm text-teks-sekunder">Alasan: {log.alasan}</p>}
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}

function Menyusul({ judul, fase }: { judul: string; fase: string }) {
  return (
    <section className="rounded-kartu border border-garis bg-permukaan">
      <KeadaanKosong judul={`${judul} segera hadir`} pesan={`Data ${judul.toLowerCase()} karyawan tampil di sini setelah ${fase} selesai.`} />
    </section>
  )
}

function DialogJadikanHr({ k, onTutup }: { k: Detail; onTutup: () => void }) {
  const qc = useQueryClient()
  const toast = useToast()
  const [alasan, setAlasan] = useState('')
  const [alasanKosong, setAlasanKosong] = useState(false)
  const m = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from('pengguna')
        .update({ role: 'hr' })
        .eq('id', k.id)
        .setHeader(HEADER_ALASAN, kodeAlasan(alasan))
        .select('id')
      if (error) throw new Error(error.code === '23514' && /membawahi/.test(error.message) ? error.message : 'Peran gagal diubah. Periksa koneksi Anda, lalu coba lagi.')
      if (!data.length) throw new Error('Anda tidak berwenang mengubah peran karyawan ini.')
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['karyawan'] })
      toast(`${k.nama} kini berperan HR.`)
      onTutup()
    },
  })

  return (
    <Dialog judul={`Jadikan ${k.nama} sebagai HR?`} onTutup={onTutup}>
      <p className="text-[15px] leading-[22px] text-teks-sekunder">
        Gunakan hanya bila HR keluar tanpa serah terima. {k.nama} akan dapat mengelola data karyawan, absensi, dan payroll. Tindakan ini tercatat di Log audit.
      </p>
      <div className="mt-4">
        <Field id="alasan-hr" label="Alasan perubahan" wajib galat={alasanKosong ? 'Alasan wajib diisi.' : undefined}>
          <textarea
            id="alasan-hr"
            rows={2}
            value={alasan}
            onChange={(e) => setAlasan(e.target.value)}
            placeholder="Contoh: HR sebelumnya resign tanpa serah terima."
            className="fokus-ring w-full rounded-kontrol border border-garis bg-permukaan px-4 py-3 text-[15px] placeholder:text-teks-3"
          />
        </Field>
      </div>
      {m.isError && (
        <div className="mt-4">
          <BannerGalat>{m.error.message}</BannerGalat>
        </div>
      )}
      <div className="mt-6 flex justify-end gap-3">
        <Tombol varian="sekunder" onClick={onTutup}>Batal</Tombol>
        <Tombol onClick={() => (alasan.trim() ? m.mutate() : setAlasanKosong(true))} memproses={m.isPending}>Ya, jadikan HR</Tombol>
      </div>
    </Dialog>
  )
}

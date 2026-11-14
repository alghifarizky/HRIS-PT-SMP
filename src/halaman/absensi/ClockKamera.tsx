// ATT-01–05 — Clock in/out dengan selfie (B1 hal 15 kamera, 16 pratinjau, 17–18 sukses, 19 izin ditolak,
// 20 gagal kirim, 21 offline). Kamera langsung (getUserMedia), TANPA input galeri (CLAUDE.md).
// Alur: ambil foto → kompres JPEG ≤ 720 px → upload ke bucket selfie ({uid}/{tanggal}-{uuid}.jpg) → RPC clock_in/out.
// Jam yang tercatat = now() server saat RPC; jam berdetik di layar hanya tampilan (selisih jam server).
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { CameraOff, CircleAlert, CircleCheck, WifiOff, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useProfil } from '../../auth/sesi'
import { NAMA_APLIKASI } from '../../lib/aplikasi'
import { durasi, jamWib, menitLebihCepat, menitTerlambat } from '../../lib/absensi'
import { hariIniDb, tanggalPanjang } from '../../lib/format'
import { BannerGalat, Tombol } from '../../komponen/form'
import { Badge, Skeleton } from '../../komponen/keadaan'
import { useAbsensiHariIni, useSelisihServer, type BarisAbsensi, type Jadwal } from './data'

type Tahap =
  | { jenis: 'kamera' }
  | { jenis: 'pratinjau'; foto: Blob; url: string; diambil: Date; gagal?: boolean; mengirim?: boolean }
  | { jenis: 'sukses'; hasil: BarisAbsensi; url: string }
  | { jenis: 'galat'; sebab: 'izin' | 'tanpa_kamera' | 'offline' | 'ditolak'; pesan?: string }

// Pesan aturan dari RPC (Bahasa Indonesia) yang ditampilkan apa adanya
const PESAN_ATURAN = /libur|sudah clock|Belum clock in|baru bisa clock in|tidak aktif|Direksi/

export default function ClockKamera() {
  const q = useAbsensiHariIni()
  // Mode dikunci dari data PERTAMA: setelah RPC berhasil data dimuat ulang (sudah ada jam masuk/keluar) —
  // menurunkan mode ulang membuat layar sukses berganti mode / dialihkan ke Beranda (bug 13 Nov 2026).
  const [awal, setAwal] = useState<{ mode: 'masuk' | 'keluar' | 'selesai'; jadwal: Jadwal | null } | null>(null)
  if (q.data && !awal) {
    const a = q.data.absensi
    setAwal({ mode: a?.jam_keluar ? 'selesai' : a ? 'keluar' : 'masuk', jadwal: q.data.jadwal })
  }

  if (q.isError && !awal) return <LayarGalat judul="Clock In" ikon={<CircleAlert />} teks="Data absensi gagal dimuat. Periksa koneksi Anda, lalu coba lagi." aksi={<Tombol onClick={() => q.refetch()}>Coba lagi</Tombol>} />
  if (!awal) return <div className="min-h-dvh bg-teks p-6"><Skeleton baris={3} /></div>
  if (awal.mode === 'selesai') return <Navigate to="/beranda" replace /> // hari ini sudah lengkap
  return <Alur mode={awal.mode} jadwal={awal.jadwal} />
}

function Alur({ mode, jadwal }: { mode: 'masuk' | 'keluar'; jadwal: Jadwal | null }) {
  const judul = mode === 'masuk' ? 'Clock In' : 'Clock Out'
  const uid = useProfil().data!.id
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [tahap, setTahap] = useState<Tahap>({ jenis: 'kamera' })
  const pathTerunggah = useRef<string | null>(null) // jangan upload ulang foto yang sama saat kirim ulang

  const kirim = async (t: Extract<Tahap, { jenis: 'pratinjau' }>) => {
    if (!navigator.onLine) return setTahap({ jenis: 'galat', sebab: 'offline' })
    setTahap({ ...t, mengirim: true, gagal: false })
    if (!pathTerunggah.current) {
      const path = `${uid}/${hariIniDb()}-${crypto.randomUUID()}.jpg`
      const { error } = await supabase.storage.from('selfie').upload(path, t.foto, { contentType: 'image/jpeg', upsert: false })
      if (error) return setTahap(navigator.onLine ? { ...t, gagal: true, mengirim: false } : { jenis: 'galat', sebab: 'offline' })
      pathTerunggah.current = path
    }
    const { data, error } = await supabase.rpc(mode === 'masuk' ? 'clock_in' : 'clock_out', { foto_path: pathTerunggah.current })
    if (error) {
      if (PESAN_ATURAN.test(error.message)) return setTahap({ jenis: 'galat', sebab: 'ditolak', pesan: error.message })
      if (/Foto selfie/.test(error.message)) pathTerunggah.current = null
      return setTahap(navigator.onLine ? { ...t, gagal: true, mengirim: false } : { jenis: 'galat', sebab: 'offline' })
    }
    await qc.invalidateQueries({ queryKey: ['absensi_hari_ini'] })
    setTahap({ jenis: 'sukses', hasil: data as BarisAbsensi, url: t.url })
  }

  const ulangi = () => {
    if (tahap.jenis === 'pratinjau') URL.revokeObjectURL(tahap.url)
    pathTerunggah.current = null
    setTahap({ jenis: 'kamera' })
  }

  switch (tahap.jenis) {
    case 'kamera':
      return <Kamera judul={judul} onTutup={() => navigate('/beranda')} onFoto={(foto, diambil) => setTahap({ jenis: 'pratinjau', foto, url: URL.createObjectURL(foto), diambil })} onGalat={(sebab) => setTahap({ jenis: 'galat', sebab })} />
    case 'pratinjau':
      return <Pratinjau t={tahap} onTutup={() => navigate('/beranda')} onUlangi={ulangi} onKirim={() => kirim(tahap)} />
    case 'sukses':
      return <Sukses mode={mode} hasil={tahap.hasil} url={tahap.url} jadwal={jadwal} />
    case 'galat':
      if (tahap.sebab === 'izin')
        return (
          <LayarGalat judul={judul} ikon={<CameraOff />} teks={`${judul} wajib dengan foto selfie. Izinkan kamera untuk ${NAMA_APLIKASI}, lalu coba lagi.`} aksi={<Tombol onClick={ulangi}>Coba lagi</Tombol>}>
            <div className="mt-6 space-y-4 text-left text-[15px]">
              <div>
                <p className="font-semibold">iPhone (Safari)</p>
                <p className="text-teks-sekunder">Buka Pengaturan › Safari › Kamera › pilih Izinkan. Atau ketuk "aA" di bilah alamat › Pengaturan Situs Web › Kamera › Izinkan.</p>
              </div>
              <div>
                <p className="font-semibold">Android (Chrome)</p>
                <p className="text-teks-sekunder">Ketuk ikon pengaturan di samping alamat situs › Izin › Kamera › Izinkan, lalu muat ulang halaman.</p>
              </div>
            </div>
          </LayarGalat>
        )
      if (tahap.sebab === 'tanpa_kamera')
        return <LayarGalat judul={judul} ikon={<CameraOff />} teks="Kamera tidak ditemukan atau sedang dipakai aplikasi lain. Tutup aplikasi kamera lain, lalu coba lagi." aksi={<Tombol onClick={ulangi}>Coba lagi</Tombol>} />
      if (tahap.sebab === 'offline')
        return <LayarGalat judul={judul} ikon={<WifiOff />} judulIsi="Tidak ada koneksi internet" teks={`${judul} membutuhkan koneksi agar jam tercatat dari server. Periksa data seluler atau Wi-Fi Anda.`} aksi={<Tombol onClick={ulangi}>Coba lagi</Tombol>} />
      return <LayarGalat judul={judul} ikon={<CircleAlert />} teks={tahap.pesan ?? 'Absensi tidak dapat dicatat.'} />
  }
}

function Kamera({ judul, onTutup, onFoto, onGalat }: { judul: string; onTutup: () => void; onFoto: (foto: Blob, diambil: Date) => void; onGalat: (sebab: 'izin' | 'tanpa_kamera') => void }) {
  const video = useRef<HTMLVideoElement>(null)
  const [siap, setSiap] = useState(false)
  // Kamera dinyalakan sekali; onGalat induk hanya memanggil setTahap (stabil) — cukup disimpan saat pertama
  const galat = useRef(onGalat)
  const selisih = useSelisihServer()
  const [sekarang, setSekarang] = useState(() => Date.now())

  useEffect(() => {
    const t = setInterval(() => setSekarang(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    let aliran: MediaStream | null = null
    let batal = false
    if (!navigator.mediaDevices?.getUserMedia) {
      galat.current('tanpa_kamera')
      return
    }
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 960 } }, audio: false })
      .then((s) => {
        if (batal) return s.getTracks().forEach((t) => t.stop())
        aliran = s
        if (video.current) {
          video.current.srcObject = s
          video.current.play().then(() => setSiap(true)).catch(() => setSiap(true))
        }
      })
      .catch((e: DOMException) => galat.current(e.name === 'NotAllowedError' || e.name === 'SecurityError' ? 'izin' : 'tanpa_kamera'))
    return () => {
      batal = true
      aliran?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  const jepret = () => {
    const v = video.current
    if (!v || !v.videoWidth) return
    const skala = Math.min(1, 720 / v.videoWidth)
    const kanvas = document.createElement('canvas')
    kanvas.width = Math.round(v.videoWidth * skala)
    kanvas.height = Math.round(v.videoHeight * skala)
    kanvas.getContext('2d')!.drawImage(v, 0, 0, kanvas.width, kanvas.height)
    const diambil = new Date(sekarang + (selisih.data ?? 0))
    kanvas.toBlob((b) => b && onFoto(b, diambil), 'image/jpeg', 0.8)
  }

  const jamServer = new Date(sekarang + (selisih.data ?? 0))
  const [jm, dt] = [jamWib(jamServer), String(new Date(jamServer).getUTCSeconds()).padStart(2, '0')]

  return (
    <main className="relative flex min-h-dvh flex-col bg-teks text-white">
      <HeaderGelap judul={judul} onTutup={onTutup} />
      <div className="text-center">
        <p className="text-[44px] leading-none font-bold tabular-nums" aria-live="off">
          {selisih.data === undefined ? '--:--' : jm}
          <span className="text-2xl text-white/60">:{selisih.data === undefined ? '--' : dt}</span>
        </p>
        <p className="mt-2 text-[15px] text-white/70">{tanggalPanjang(jamServer)} · waktu server WIB</p>
      </div>

      <div className="relative mx-auto mt-6 aspect-[3/4] w-full max-w-[360px] flex-1 overflow-hidden">
        <video ref={video} playsInline muted className="size-full -scale-x-100 object-cover" aria-label="Pratinjau kamera depan" />
        <div className="pointer-events-none absolute inset-[12%_14%] rounded-[50%] border-[3px] border-dashed border-white/90" aria-hidden />
      </div>
      <p className="mt-4 px-6 text-center text-[15px]">Posisikan wajah di dalam bingkai. Pastikan wajah terlihat jelas dan cukup cahaya.</p>

      <div className="flex flex-col items-center gap-2 pt-6 pb-[max(24px,env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={jepret}
          disabled={!siap}
          aria-label="Ambil foto"
          className="flex size-[72px] items-center justify-center rounded-full border-4 border-white focus-visible:ring-4 focus-visible:ring-primer-100 focus-visible:outline-none disabled:opacity-40"
        >
          <span className="size-14 rounded-full bg-white" />
        </button>
        <span className="text-sm text-white/80">Kamera depan</span>
      </div>
    </main>
  )
}

function Pratinjau({ t, onTutup, onUlangi, onKirim }: { t: Extract<Tahap, { jenis: 'pratinjau' }>; onTutup: () => void; onUlangi: () => void; onKirim: () => void }) {
  return (
    <main className="flex min-h-dvh flex-col bg-teks text-white">
      <HeaderGelap judul="Pratinjau foto" onTutup={onTutup} />
      <p className="text-center text-[15px] text-white/70">
        {jamWib(t.diambil)} WIB · {tanggalPanjang(t.diambil)}
      </p>
      <img src={t.url} alt="Foto selfie yang akan dikirim" className="mx-auto mt-4 aspect-[3/4] w-full max-w-[360px] flex-1 object-cover" />
      <div className="mx-auto w-full max-w-[440px] px-4 pt-4 pb-[max(24px,env(safe-area-inset-bottom))]">
        {t.gagal && (
          <div className="mb-4">
            <BannerGalat>
              <strong className="font-semibold">Foto gagal dikirim. Jam belum tercatat.</strong> Coba kirim ulang — foto Anda masih tersimpan di layar ini.
            </BannerGalat>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Tombol varian="sekunder" onClick={onUlangi} disabled={t.mengirim}>Ulangi</Tombol>
          <Tombol onClick={onKirim} memproses={t.mengirim}>{t.gagal ? 'Kirim ulang' : 'Kirim'}</Tombol>
        </div>
      </div>
    </main>
  )
}

function Sukses({ mode, hasil, url, jadwal }: { mode: 'masuk' | 'keluar'; hasil: BarisAbsensi; url: string; jadwal: Jadwal | null }) {
  const navigate = useNavigate()
  const masuk = new Date(hasil.jam_masuk)
  const keluar = hasil.jam_keluar ? new Date(hasil.jam_keluar) : null
  const jam = mode === 'masuk' ? masuk : keluar!
  const terlambat = jadwal ? menitTerlambat(masuk, jadwal.jam_masuk) : 0
  const cepat = keluar && jadwal ? menitLebihCepat(keluar, jadwal.jam_pulang) : 0
  const jadwalMasuk = jadwal?.jam_masuk.slice(0, 5)

  let badge: ReactNode = null
  let pesan = ''
  if (mode === 'masuk') {
    badge = hasil.terlambat ? <Badge nada="peringatan">Terlambat</Badge> : <Badge nada="sukses">Tepat waktu</Badge>
    pesan = hasil.terlambat
      ? `Terlambat ${terlambat} menit dari jam masuk ${jadwalMasuk}. Keterlambatan dapat memengaruhi potongan gaji.`
      : terlambat > 0
        ? `Masih dalam toleransi 5 menit dari jam masuk ${jadwalMasuk}. Selamat bekerja!`
        : `Anda masuk sebelum jam kerja ${jadwalMasuk}. Selamat bekerja!`
  } else {
    badge = cepat > 0 ? <Badge nada="peringatan">Lebih cepat {cepat} menit</Badge> : null
    pesan = `Total jam kerja hari ini ${durasi(masuk, keluar!)}.${cepat > 0 ? ` Jam pulang ${jadwal!.jam_pulang.slice(0, 5)}.` : ' Sampai jumpa besok!'}`
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-[440px] flex-col bg-permukaan px-6 pt-16 pb-[max(24px,env(safe-area-inset-bottom))] text-center">
      <div className="mx-auto flex size-[72px] items-center justify-center rounded-full bg-sukses-latar">
        <CircleCheck className="size-9 text-sukses-ikon" aria-hidden />
      </div>
      <h1 className="mt-6 text-[22px] leading-7 font-semibold">{mode === 'masuk' ? 'Clock in berhasil' : 'Clock out berhasil'}</h1>
      <p className="mt-1 text-[15px] text-teks-sekunder">{tanggalPanjang(jam)}</p>
      <p className="mt-4 text-[44px] leading-none font-bold tabular-nums">{jamWib(jam)} WIB</p>
      {badge && <div className="mt-3">{badge}</div>}
      <p className="mt-3 text-[15px] leading-[22px] text-teks-sekunder">{pesan}</p>

      <div className="mt-8 flex items-center gap-4 rounded-kartu border border-garis p-3 text-left">
        <img src={url} alt="" className="size-14 shrink-0 rounded-kontrol object-cover" />
        <div>
          <p className="text-[15px] font-semibold">Foto selfie terkirim</p>
          <p className="text-sm text-teks-sekunder">Jam diambil dari server, bukan dari ponsel.</p>
        </div>
      </div>

      <Tombol className="mt-auto w-full" onClick={() => navigate('/beranda', { replace: true })}>Kembali ke Beranda</Tombol>
    </main>
  )
}

function HeaderGelap({ judul, onTutup }: { judul: string; onTutup: () => void }) {
  return (
    <header className="flex h-14 items-center justify-center px-2 pt-[env(safe-area-inset-top)]">
      <button type="button" onClick={onTutup} aria-label="Tutup" className="absolute left-2 flex size-11 items-center justify-center rounded-kontrol focus-visible:ring-4 focus-visible:ring-primer-100 focus-visible:outline-none">
        <X className="size-6" aria-hidden />
      </button>
      <h1 className="text-[17px] font-semibold text-white/80">{judul}</h1>
    </header>
  )
}

function LayarGalat({ judul, judulIsi, ikon, teks, aksi, children }: { judul: string; judulIsi?: string; ikon: ReactNode; teks: string; aksi?: ReactNode; children?: ReactNode }) {
  const navigate = useNavigate()
  return (
    <main className="mx-auto flex min-h-dvh max-w-[440px] flex-col bg-permukaan px-6 pb-[max(24px,env(safe-area-inset-bottom))]">
      <header className="relative flex h-14 items-center justify-center">
        <button type="button" onClick={() => navigate('/beranda')} aria-label="Tutup" className="fokus-ring absolute left-0 flex size-11 items-center justify-center rounded-kontrol">
          <X className="size-6" aria-hidden />
        </button>
        <span className="text-[17px] font-semibold">{judul}</span>
      </header>
      <div className="mt-10 flex flex-col items-center text-center">
        <div className="flex size-[72px] items-center justify-center rounded-full bg-bahaya-latar text-bahaya-ikon [&>svg]:size-8">{ikon}</div>
        {judulIsi && <h2 className="mt-6 text-[22px] leading-7 font-semibold">{judulIsi}</h2>}
        <p className="mt-3 text-[15px] leading-[22px] text-teks-sekunder">{teks}</p>
      </div>
      {children}
      <div className="mt-auto flex flex-col gap-3 pt-8">
        {aksi}
        <Tombol varian="sekunder" onClick={() => navigate('/beranda')}>Kembali ke Beranda</Tombol>
      </div>
    </main>
  )
}

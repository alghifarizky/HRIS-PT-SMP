// MST-01/02/03 — desain B3C hal 11–15. Tab disimpan di URL (?tab=) agar bisa dibagikan & bertahan saat reload.
import { useSearchParams } from 'react-router'
import JadwalKerja from './JadwalKerja'
import HariLibur from './HariLibur'
import Pengaturan from './Pengaturan'

const TAB = [
  { id: 'jadwal', label: 'Jadwal kerja', Isi: JadwalKerja },
  { id: 'hari-libur', label: 'Hari libur', Isi: HariLibur },
  { id: 'pengaturan', label: 'Pengaturan', Isi: Pengaturan },
] as const

export default function MasterData() {
  const [params, setParams] = useSearchParams()
  const aktif = TAB.find((t) => t.id === params.get('tab')) ?? TAB[0]

  return (
    <div>
      <h1 className="text-[28px] leading-[34px] font-semibold">Master data</h1>
      <p className="mt-1 text-[15px] text-teks-sekunder">Aturan dasar yang dipakai absensi, cuti, dan payroll</p>

      <div role="tablist" aria-label="Bagian master data" className="mt-6 flex gap-1 border-b border-garis">
        {TAB.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={t.id === aktif.id}
            aria-controls="panel-master-data"
            onClick={() => setParams({ tab: t.id }, { replace: true })}
            className={`fokus-ring -mb-px h-11 border-b-2 px-4 text-[15px] ${t.id === aktif.id ? 'border-primer font-semibold text-primer' : 'border-transparent text-teks-sekunder hover:text-teks'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div role="tabpanel" id="panel-master-data" aria-labelledby={`tab-${aktif.id}`} className="mt-6">
        <aktif.Isi />
      </div>
    </div>
  )
}

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export type Peran = 'karyawan' | 'atasan' | 'hr' | 'direksi'
export type Profil = { id: string; nama: string; role: Peran; jabatan: string | null }

// undefined = sesi belum diketahui (masih membaca dari storage)
const SesiContext = createContext<Session | null | undefined>(undefined)

export function SesiProvider({ children }: { children: ReactNode }) {
  const [sesi, setSesi] = useState<Session | null | undefined>(undefined)
  const queryClient = useQueryClient()

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSesi(data.session))
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      setSesi(s)
      // Data pengguna sebelumnya tidak boleh terbawa ke sesi berikutnya
      if (event === 'SIGNED_OUT') queryClient.clear()
    })
    return () => data.subscription.unsubscribe()
  }, [queryClient])

  return <SesiContext.Provider value={sesi}>{children}</SesiContext.Provider>
}

export const useSesi = () => useContext(SesiContext)

/** Profil pengguna yang login. null = tidak ada baris (akun nonaktif / belum didaftarkan HR). */
export function useProfil() {
  const uid = useSesi()?.user.id
  return useQuery({
    queryKey: ['profil', uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pengguna')
        .select('id, nama, role, jabatan')
        .eq('id', uid!)
        .maybeSingle()
      if (error) throw error
      return data as Profil | null
    },
  })
}

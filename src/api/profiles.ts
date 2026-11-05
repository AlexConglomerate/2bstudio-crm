import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/auth/AuthProvider'
import { supabase } from '@/lib/supabase'

// Профиль текущего пользователя: имя и роль. Роль берём из таблицы profiles, а не из user_metadata.
export function useProfile() {
  const { session } = useAuth()
  const userId = session?.user.id

  return useQuery({
    queryKey: ['profile', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, role')
        .eq('id', userId!)
        .single()
      if (error) throw error
      return data
    },
  })
}

// Список исполнителей — для выбора в форме задачи.
export function useExecutors() {
  return useQuery({
    queryKey: ['executors'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('role', 'executor')
        .order('full_name')
      if (error) throw error
      return data
    },
  })
}

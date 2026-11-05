import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { assertChanged } from '@/lib/errors'
import { supabase } from '@/lib/supabase'

// Какие объекты вернутся, решает база (RLS): постановщику — все,
// исполнителю — только те, где у него есть задачи. Фильтра по пользователю здесь нет намеренно.
export function useObjects() {
  return useQuery({
    queryKey: ['objects'],
    queryFn: async () => {
      const { data, error } = await supabase.from('objects').select('id, name, address').order('name')
      if (error) throw error
      return data
    },
  })
}

// null — объекта нет или он недоступен этому пользователю (для RLS это одно и то же).
export function useObject(id: string) {
  return useQuery({
    queryKey: ['object', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('objects')
        .select('id, name, address')
        .eq('id', id)
        .maybeSingle()
      if (error) throw error
      return data
    },
  })
}

export type ObjectValues = { name: string; address: string }

// Создание (без id) или редактирование (с id). Возвращает id объекта.
export function useSaveObject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, values }: { id?: string; values: ObjectValues }) => {
      if (!id) {
        const { data, error } = await supabase.from('objects').insert(values).select('id').single()
        if (error) throw error
        return data.id
      }
      const { data, error } = await supabase.from('objects').update(values).eq('id', id).select('id')
      if (error) throw error
      assertChanged({ rows: data, message: 'Не удалось сохранить: объект не найден или нет прав' })
      return id
    },
    // После любой записи перечитываем все данные: приложение маленькое, так проще не ошибиться.
    onSuccess: () => queryClient.invalidateQueries(),
  })
}

export function useDeleteObject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.from('objects').delete().eq('id', id).select('id')
      if (error) throw error
      assertChanged({ rows: data, message: 'Не удалось удалить: объект не найден или нет прав' })
    },
    // Не ждём перечитывания: страница удалённого объекта сейчас закроется.
    onSuccess: () => {
      void queryClient.invalidateQueries()
    },
  })
}

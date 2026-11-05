import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/auth/AuthProvider'
import { assertChanged } from '@/lib/errors'
import type { TaskStatus } from '@/lib/status'
import { supabase } from '@/lib/supabase'

// Колонки для списков задач. object:objects(...) и assignee:profiles!assignee_id(...) — связанные
// записи, которые база подтягивает по внешним ключам. У tasks два ключа на profiles (исполнитель
// и автор), поэтому после ! указываем, по какому из них соединять.
const TASK_LIST_COLUMNS =
  'id, title, status, created_at, object:objects(id, name), assignee:profiles!assignee_id(full_name)'

export function useObjectTasks(objectId: string) {
  return useQuery({
    queryKey: ['tasks', { objectId }],
    queryFn: async () => {
      // Исполнитель получит только свои задачи этого объекта — чужие отрежет RLS.
      const { data, error } = await supabase
        .from('tasks')
        .select(TASK_LIST_COLUMNS)
        .eq('object_id', objectId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

export type TaskListItem = NonNullable<ReturnType<typeof useObjectTasks>['data']>[number]

// «Мои задачи»: назначенные текущему пользователю.
// Фильтр здесь нужен для постановщика (он видит все задачи); исполнителю RLS и так отдаст только его.
export function useMyTasks() {
  const { session } = useAuth()
  const userId = session?.user.id
  return useQuery({
    queryKey: ['tasks', { assigneeId: userId }],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select(TASK_LIST_COLUMNS)
        .eq('assignee_id', userId!)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

// null — задачи нет или она чужая (исполнитель не отличит одно от другого).
export function useTask(id: string) {
  return useQuery({
    queryKey: ['task', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select(
          `id, title, description, status, created_at, object_id, assignee_id,
           object:objects(id, name),
           assignee:profiles!assignee_id(full_name),
           author:profiles!author_id(full_name)`,
        )
        .eq('id', id)
        .maybeSingle()
      if (error) throw error
      return data
    },
  })
}

export function useTaskHistory(taskId: string) {
  return useQuery({
    queryKey: ['task-history', taskId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('task_status_history')
        .select('id, from_status, to_status, comment, changed_at, changed_by:profiles!changed_by(full_name)')
        .eq('task_id', taskId)
        .order('changed_at')
      if (error) throw error
      return data
    },
  })
}

// Поля, которые постановщик может задать или поменять. Статус, автор и дата создания сюда не входят:
// у роли authenticated нет права на эти колонки, их ставит база.
export type TaskValues = { title: string; description: string; object_id: string; assignee_id: string }

// Создание (без id) или редактирование (с id). Возвращает id задачи.
export function useSaveTask() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, values }: { id?: string; values: TaskValues }) => {
      if (!id) {
        const { data, error } = await supabase.from('tasks').insert(values).select('id').single()
        if (error) throw error
        return data.id
      }
      const { data, error } = await supabase.from('tasks').update(values).eq('id', id).select('id')
      if (error) throw error
      assertChanged({ rows: data, message: 'Не удалось сохранить: задача не найдена, уже принята или нет прав' })
      return id
    },
    onSuccess: () => queryClient.invalidateQueries(),
  })
}

export function useDeleteTask() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.from('tasks').delete().eq('id', id).select('id')
      if (error) throw error
      assertChanged({ rows: data, message: 'Не удалось удалить: удалить можно только задачу в статусе «Новая»' })
    },
    // Не ждём перечитывания: страница удалённой задачи сейчас закроется.
    onSuccess: () => {
      void queryClient.invalidateQueries()
    },
  })
}

// Смена статуса — только через SQL-функцию change_task_status: она проверяет права и переход
// и сама пишет историю. Ошибки из неё приходят по-русски.
export function useChangeStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ taskId, to, comment }: { taskId: string; to: TaskStatus; comment: string }) => {
      const { error } = await supabase.rpc('change_task_status', {
        p_task_id: taskId,
        p_to_status: to,
        p_comment: comment,
      })
      if (error) throw error
    },
    // Ждём, пока перечитаются задача и история: до этого кнопки заблокированы,
    // и по старому статусу второй раз не нажать.
    onSuccess: () => queryClient.invalidateQueries(),
  })
}

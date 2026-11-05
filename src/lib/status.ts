import type { Database } from '@/lib/database.types'

export type TaskStatus = Database['public']['Enums']['task_status']
export type UserRole = Database['public']['Enums']['user_role']

export const STATUS_LABEL: Record<TaskStatus, string> = {
  new: 'Новая',
  in_progress: 'В работе',
  review: 'На проверке',
  accepted: 'Принята',
  rework: 'На доработке',
}

export const ROLE_LABEL: Record<UserRole, string> = {
  manager: 'Постановщик',
  executor: 'Исполнитель',
}

export type StatusAction = {
  from: TaskStatus
  to: TaskStatus
  // Кто делает переход: назначенный исполнитель или любой постановщик.
  who: 'assignee' | 'manager'
  label: string
  commentRequired: boolean
}

// Копия правил из SQL-функции change_task_status — только чтобы показать нужные кнопки.
// Защищает не этот список, а база: запрещённый переход она отклонит, даже если кнопку подделать.
const TRANSITIONS: StatusAction[] = [
  { from: 'new', to: 'in_progress', who: 'assignee', label: 'Взять в работу', commentRequired: false },
  { from: 'in_progress', to: 'review', who: 'assignee', label: 'Отправить на проверку', commentRequired: false },
  { from: 'rework', to: 'in_progress', who: 'assignee', label: 'Взять в работу', commentRequired: false },
  { from: 'review', to: 'accepted', who: 'manager', label: 'Принять', commentRequired: false },
  { from: 'review', to: 'rework', who: 'manager', label: 'Вернуть на доработку', commentRequired: true },
]

// Какие переходы доступны текущему пользователю для задачи в данном статусе.
export function availableActions({
  status,
  role,
  isAssignee,
}: {
  status: TaskStatus
  role: UserRole
  isAssignee: boolean
}): StatusAction[] {
  return TRANSITIONS.filter(
    (t) => t.from === status && (t.who === 'manager' ? role === 'manager' : isAssignee),
  )
}

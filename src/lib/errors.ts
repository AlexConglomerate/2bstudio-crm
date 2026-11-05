// Превращает ошибку запроса в текст для пользователя.
// Ошибки из SQL-функций (raise exception) уже по-русски — показываем их как есть.
// Для системных ошибок Postgres по коду подбираем понятный текст.
export function errorMessage(error: unknown): string {
  const { code, message } = (error ?? {}) as { code?: string; message?: string }

  // foreign_key_violation: удаляем запись, на которую ссылаются другие (объект с задачами).
  if (code === '23503') return 'Нельзя удалить: с этой записью связаны другие данные (например, у объекта есть задачи)'
  // insufficient_privilege: нет прав (grant или RLS).
  if (code === '42501') return 'Недостаточно прав для этого действия'
  // check_violation: например, пустое название.
  if (code === '23514') return 'Не заполнено обязательное поле'

  return message || 'Неизвестная ошибка'
}

// UPDATE/DELETE, которому RLS не дал ни одной строки, возвращает не ошибку, а пустой результат.
// Поэтому просим базу вернуть изменённые строки (.select('id')) и проверяем, что они есть.
export function assertChanged({ rows, message }: { rows: unknown[] | null; message: string }): void {
  if (!rows || rows.length === 0) throw new Error(message)
}

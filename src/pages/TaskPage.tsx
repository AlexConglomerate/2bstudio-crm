import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useProfile } from '@/api/profiles'
import { useChangeStatus, useDeleteTask, useTask, useTaskHistory } from '@/api/tasks'
import { ErrorText, Loading, Message } from '@/components/PageState'
import { StatusBadge } from '@/components/StatusBadge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { formatDate } from '@/lib/format'
import { availableActions, type StatusAction } from '@/lib/status'

export function TaskPage() {
  const id = useParams().id!
  const navigate = useNavigate()
  const { data: profile } = useProfile()
  const task = useTask(id)
  const history = useTaskHistory(id)
  const deleteTask = useDeleteTask()

  if (task.isPending || !profile) return <Loading />
  if (task.isError) return <ErrorText error={task.error} />
  if (!task.data) return <Message>Задача не найдена</Message>

  const t = task.data
  const isManager = profile.role === 'manager'
  const actions = availableActions({ status: t.status, role: profile.role, isAssignee: t.assignee_id === profile.id })

  function onDelete() {
    if (!window.confirm(`Удалить задачу «${t.title}»?`)) return
    deleteTask.mutate(t.id, { onSuccess: () => navigate(`/objects/${t.object_id}`) })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <Link to={`/objects/${t.object.id}`} className="text-sm text-muted-foreground hover:underline">
            ← {t.object.name}
          </Link>
          <h1 className="text-xl font-semibold">{t.title}</h1>
        </div>
        {/* Кнопки только прячутся: что разрешено на самом деле, решают политики tasks_update и tasks_delete. */}
        {isManager && (
          <div className="flex gap-2">
            {t.status !== 'accepted' && (
              <Button variant="outline" asChild>
                <Link to={`/tasks/${t.id}/edit`}>Редактировать</Link>
              </Button>
            )}
            {t.status === 'new' && (
              <Button variant="destructive" onClick={onDelete} disabled={deleteTask.isPending}>
                Удалить
              </Button>
            )}
          </div>
        )}
      </div>
      <ErrorText error={deleteTask.error} />

      <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 text-sm">
        <dt className="text-muted-foreground">Статус</dt>
        <dd>
          <StatusBadge status={t.status} />
        </dd>
        <dt className="text-muted-foreground">Исполнитель</dt>
        <dd>{t.assignee.full_name}</dd>
        <dt className="text-muted-foreground">Автор</dt>
        <dd>{t.author.full_name}</dd>
        <dt className="text-muted-foreground">Создана</dt>
        <dd>{formatDate(t.created_at)}</dd>
        <dt className="text-muted-foreground">Описание</dt>
        <dd className="whitespace-pre-wrap">{t.description || '—'}</dd>
      </dl>

      {actions.length > 0 ? (
        <StatusActions taskId={t.id} actions={actions} />
      ) : (
        <Message>Сейчас у вас нет действий по этой задаче.</Message>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">История статусов</h2>
        {history.isPending ? (
          <Loading />
        ) : history.isError ? (
          <ErrorText error={history.error} />
        ) : history.data.length === 0 ? (
          <Message>Статус ещё не менялся</Message>
        ) : (
          <ol className="space-y-3">
            {history.data.map((entry) => (
              <li key={entry.id} className="space-y-1 border-l-2 pl-3">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={entry.from_status} />
                  <span>→</span>
                  <StatusBadge status={entry.to_status} />
                </div>
                <p className="text-sm text-muted-foreground">
                  {entry.changed_by.full_name}, {formatDate(entry.changed_at)}
                </p>
                {entry.comment && <p className="text-sm whitespace-pre-wrap">{entry.comment}</p>}
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  )
}

// Кнопки переходов, доступных пользователю, и поле комментария.
function StatusActions({ taskId, actions }: { taskId: string; actions: StatusAction[] }) {
  const [comment, setComment] = useState('')
  const changeStatus = useChangeStatus()
  const commentRequired = actions.some((a) => a.commentRequired)

  function run(action: StatusAction) {
    // Обязательность комментария здесь не проверяем: это делает функция в базе,
    // и её ошибку «комментарий обязателен» мы покажем под кнопками.
    changeStatus.mutate({ taskId, to: action.to, comment }, { onSuccess: () => setComment('') })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Действия</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor="comment">
            {commentRequired ? 'Комментарий (обязателен при возврате на доработку)' : 'Комментарий (необязательно)'}
          </Label>
          <Textarea id="comment" value={comment} onChange={(e) => setComment(e.target.value)} />
        </div>
        <ErrorText error={changeStatus.error} />
        <div className="flex flex-wrap gap-2">
          {actions.map((action) => (
            <Button
              key={action.to}
              variant={action.to === 'rework' ? 'outline' : 'default'}
              onClick={() => run(action)}
              disabled={changeStatus.isPending}
            >
              {action.label}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

import { Link, useNavigate, useParams } from 'react-router'
import { useDeleteObject, useObject } from '@/api/objects'
import { useProfile } from '@/api/profiles'
import { useObjectTasks } from '@/api/tasks'
import { ErrorText, Loading, Message } from '@/components/PageState'
import { TaskTable } from '@/components/TaskTable'
import { Button } from '@/components/ui/button'

export function ObjectPage() {
  const id = useParams().id!
  const navigate = useNavigate()
  const { data: profile } = useProfile()
  const object = useObject(id)
  const tasks = useObjectTasks(id)
  const deleteObject = useDeleteObject()
  const isManager = profile?.role === 'manager'

  if (object.isPending) return <Loading />
  if (object.isError) return <ErrorText error={object.error} />
  if (!object.data) return <Message>Объект не найден</Message>

  function onDelete() {
    if (!window.confirm(`Удалить объект «${object.data!.name}»?`)) return
    deleteObject.mutate(id, { onSuccess: () => navigate('/') })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">{object.data.name}</h1>
          <p className="text-muted-foreground">{object.data.address}</p>
        </div>
        {isManager && (
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link to={`/objects/${id}/edit`}>Редактировать</Link>
            </Button>
            <Button variant="destructive" onClick={onDelete} disabled={deleteObject.isPending}>
              Удалить
            </Button>
          </div>
        )}
      </div>
      <ErrorText error={deleteObject.error} />

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold">Задачи</h2>
          {isManager && (
            <Button asChild>
              <Link to={`/tasks/new?objectId=${id}`}>Новая задача</Link>
            </Button>
          )}
        </div>
        {tasks.isPending ? (
          <Loading />
        ) : tasks.isError ? (
          <ErrorText error={tasks.error} />
        ) : (
          <TaskTable tasks={tasks.data} column="assignee" />
        )}
      </section>
    </div>
  )
}

import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { z } from 'zod'
import { useObjects } from '@/api/objects'
import { useExecutors, useProfile } from '@/api/profiles'
import { useSaveTask, useTask, type TaskValues } from '@/api/tasks'
import { ErrorText, Loading, Message } from '@/components/PageState'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Textarea } from '@/components/ui/textarea'

const schema = z.object({
  title: z.string().trim().min(1, 'Введите название'),
  description: z.string().trim(),
  object_id: z.string().min(1, 'Выберите объект'),
  assignee_id: z.string().min(1, 'Выберите исполнителя'),
})

// Одна страница для создания (/tasks/new?objectId=…) и редактирования (/tasks/:id/edit).
export function TaskFormPage() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const { data: profile } = useProfile()

  if (profile?.role !== 'manager') return <Message>Задачи создаёт и редактирует только постановщик</Message>
  if (!id) {
    const objectId = searchParams.get('objectId') ?? ''
    return <TaskForm defaultValues={{ title: '', description: '', object_id: objectId, assignee_id: '' }} />
  }
  return <EditTask id={id} />
}

function EditTask({ id }: { id: string }) {
  const task = useTask(id)
  if (task.isPending) return <Loading />
  if (task.isError) return <ErrorText error={task.error} />
  if (!task.data) return <Message>Задача не найдена</Message>
  if (task.data.status === 'accepted') return <Message>Принятую задачу редактировать нельзя</Message>

  const { title, description, object_id, assignee_id } = task.data
  return <TaskForm id={id} defaultValues={{ title, description, object_id, assignee_id }} />
}

function TaskForm({ id, defaultValues }: { id?: string; defaultValues: TaskValues }) {
  const navigate = useNavigate()
  const objects = useObjects()
  const executors = useExecutors()
  const save = useSaveTask()
  const form = useForm<TaskValues>({ resolver: zodResolver(schema), defaultValues })
  const { errors } = form.formState

  // Списки для выпадающих полей грузим до показа формы, иначе выбранное значение не подставится.
  if (objects.isPending || executors.isPending) return <Loading />
  if (objects.isError) return <ErrorText error={objects.error} />
  if (executors.isError) return <ErrorText error={executors.error} />

  function onSubmit(values: TaskValues) {
    save.mutate({ id, values }, { onSuccess: (savedId) => navigate(`/tasks/${savedId}`) })
  }

  return (
    <form className="max-w-lg space-y-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <h1 className="text-xl font-semibold">{id ? 'Редактирование задачи' : 'Новая задача'}</h1>
      <div className="space-y-2">
        <Label htmlFor="title">Название</Label>
        <Input id="title" {...form.register('title')} />
        {errors.title && <p className="text-sm text-destructive">{errors.title.message}</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Описание</Label>
        <Textarea id="description" rows={4} {...form.register('description')} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="object_id">Объект</Label>
        <NativeSelect id="object_id" className="w-full" {...form.register('object_id')}>
          <NativeSelectOption value="">Выберите объект</NativeSelectOption>
          {objects.data.map((object) => (
            <NativeSelectOption key={object.id} value={object.id}>
              {object.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        {errors.object_id && <p className="text-sm text-destructive">{errors.object_id.message}</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="assignee_id">Исполнитель</Label>
        <NativeSelect id="assignee_id" className="w-full" {...form.register('assignee_id')}>
          <NativeSelectOption value="">Выберите исполнителя</NativeSelectOption>
          {executors.data.map((executor) => (
            <NativeSelectOption key={executor.id} value={executor.id}>
              {executor.full_name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        {errors.assignee_id && <p className="text-sm text-destructive">{errors.assignee_id.message}</p>}
      </div>
      <ErrorText error={save.error} />
      <div className="flex gap-2">
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? 'Сохраняем…' : 'Сохранить'}
        </Button>
        <Button type="button" variant="outline" onClick={() => navigate(-1)}>
          Отмена
        </Button>
      </div>
    </form>
  )
}

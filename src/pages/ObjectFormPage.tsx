import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { useNavigate, useParams } from 'react-router'
import { z } from 'zod'
import { useObject, useSaveObject, type ObjectValues } from '@/api/objects'
import { useProfile } from '@/api/profiles'
import { ErrorText, Loading, Message } from '@/components/PageState'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const schema = z.object({
  name: z.string().trim().min(1, 'Введите название'),
  address: z.string().trim().min(1, 'Введите адрес'),
})

// Одна страница для создания (/objects/new) и редактирования (/objects/:id/edit).
export function ObjectFormPage() {
  const { id } = useParams()
  const { data: profile } = useProfile()

  if (profile?.role !== 'manager') return <Message>Объекты создаёт и редактирует только постановщик</Message>
  if (!id) return <ObjectForm defaultValues={{ name: '', address: '' }} />
  return <EditObject id={id} />
}

function EditObject({ id }: { id: string }) {
  const object = useObject(id)
  if (object.isPending) return <Loading />
  if (object.isError) return <ErrorText error={object.error} />
  if (!object.data) return <Message>Объект не найден</Message>
  return <ObjectForm id={id} defaultValues={{ name: object.data.name, address: object.data.address }} />
}

function ObjectForm({ id, defaultValues }: { id?: string; defaultValues: ObjectValues }) {
  const navigate = useNavigate()
  const save = useSaveObject()
  const form = useForm<ObjectValues>({ resolver: zodResolver(schema), defaultValues })
  const { errors } = form.formState

  function onSubmit(values: ObjectValues) {
    save.mutate({ id, values }, { onSuccess: (savedId) => navigate(`/objects/${savedId}`) })
  }

  return (
    <form className="max-w-lg space-y-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <h1 className="text-xl font-semibold">{id ? 'Редактирование объекта' : 'Новый объект'}</h1>
      <div className="space-y-2">
        <Label htmlFor="name">Название</Label>
        <Input id="name" {...form.register('name')} />
        {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="address">Адрес</Label>
        <Input id="address" {...form.register('address')} />
        {errors.address && <p className="text-sm text-destructive">{errors.address.message}</p>}
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

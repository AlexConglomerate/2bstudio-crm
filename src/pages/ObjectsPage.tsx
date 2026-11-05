import { Link } from 'react-router'
import { useObjects } from '@/api/objects'
import { useProfile } from '@/api/profiles'
import { ErrorText, Loading, Message } from '@/components/PageState'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

export function ObjectsPage() {
  const { data: profile } = useProfile()
  const objects = useObjects()
  const isManager = profile?.role === 'manager'

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold">Объекты</h1>
        {isManager && (
          <Button asChild>
            <Link to="/objects/new">Добавить объект</Link>
          </Button>
        )}
      </div>
      {!isManager && <Message>Показаны объекты, в которых у вас есть задачи.</Message>}

      {objects.isPending ? (
        <Loading />
      ) : objects.isError ? (
        <ErrorText error={objects.error} />
      ) : objects.data.length === 0 ? (
        <Message>Объектов нет</Message>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Название</TableHead>
              <TableHead>Адрес</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {objects.data.map((object) => (
              <TableRow key={object.id}>
                <TableCell className="whitespace-normal">
                  <Link to={`/objects/${object.id}`} className="font-medium underline-offset-4 hover:underline">
                    {object.name}
                  </Link>
                </TableCell>
                <TableCell className="whitespace-normal text-muted-foreground">{object.address}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}

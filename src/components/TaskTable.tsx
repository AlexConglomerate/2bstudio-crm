import { Link } from 'react-router'
import type { TaskListItem } from '@/api/tasks'
import { StatusBadge } from '@/components/StatusBadge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDate } from '@/lib/format'

// Таблица задач для карточки объекта (колонка «Исполнитель») и «Моих задач» (колонка «Объект»).
export function TaskTable({ tasks, column }: { tasks: TaskListItem[]; column: 'assignee' | 'object' }) {
  if (tasks.length === 0) {
    return <p className="text-muted-foreground">Задач нет</p>
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Задача</TableHead>
          <TableHead>{column === 'assignee' ? 'Исполнитель' : 'Объект'}</TableHead>
          <TableHead>Статус</TableHead>
          <TableHead>Создана</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {tasks.map((task) => (
          <TableRow key={task.id}>
            <TableCell className="whitespace-normal">
              <Link to={`/tasks/${task.id}`} className="font-medium underline-offset-4 hover:underline">
                {task.title}
              </Link>
            </TableCell>
            <TableCell className="whitespace-normal">
              {column === 'assignee' ? (
                task.assignee.full_name
              ) : (
                <Link to={`/objects/${task.object.id}`} className="underline-offset-4 hover:underline">
                  {task.object.name}
                </Link>
              )}
            </TableCell>
            <TableCell>
              <StatusBadge status={task.status} />
            </TableCell>
            <TableCell className="text-muted-foreground">{formatDate(task.created_at)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

import { useMyTasks } from '@/api/tasks'
import { ErrorText, Loading } from '@/components/PageState'
import { TaskTable } from '@/components/TaskTable'

export function MyTasksPage() {
  const tasks = useMyTasks()

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Мои задачи</h1>
      {tasks.isPending ? (
        <Loading />
      ) : tasks.isError ? (
        <ErrorText error={tasks.error} />
      ) : (
        <TaskTable tasks={tasks.data} column="object" />
      )}
    </div>
  )
}

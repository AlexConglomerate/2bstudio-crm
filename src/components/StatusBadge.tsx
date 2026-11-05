import { Badge } from '@/components/ui/badge'
import { STATUS_LABEL, type TaskStatus } from '@/lib/status'

const STATUS_CLASS: Record<TaskStatus, string> = {
  new: 'bg-slate-100 text-slate-700',
  in_progress: 'bg-blue-100 text-blue-800',
  review: 'bg-amber-100 text-amber-800',
  accepted: 'bg-green-100 text-green-800',
  rework: 'bg-red-100 text-red-800',
}

export function StatusBadge({ status }: { status: TaskStatus }) {
  return <Badge className={STATUS_CLASS[status]}>{STATUS_LABEL[status]}</Badge>
}

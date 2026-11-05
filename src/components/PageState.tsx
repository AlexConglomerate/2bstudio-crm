import type { ReactNode } from 'react'
import { errorMessage } from '@/lib/errors'

export function Loading() {
  return <p className="text-muted-foreground">Загрузка…</p>
}

export function ErrorText({ error }: { error: unknown }) {
  if (!error) return null
  return <p className="text-sm text-destructive">{errorMessage(error)}</p>
}

export function Message({ children }: { children: ReactNode }) {
  return <p className="text-muted-foreground">{children}</p>
}

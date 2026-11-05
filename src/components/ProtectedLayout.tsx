import { useQueryClient } from '@tanstack/react-query'
import { Navigate, Outlet } from 'react-router'
import { useAuth } from '@/auth/AuthProvider'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'

// Обёртка для всех страниц после входа. Это только удобство интерфейса:
// данные защищает база, а не этот редирект.
export function ProtectedLayout() {
  const { session, loading } = useAuth()
  const queryClient = useQueryClient()

  if (loading) {
    return <div className="p-8 text-muted-foreground">Загрузка…</div>
  }
  if (!session) {
    return <Navigate to="/login" replace />
  }

  async function signOut() {
    await supabase.auth.signOut()
    // Чтобы следующий пользователь на этом устройстве не увидел закешированные данные предыдущего.
    queryClient.clear()
  }

  return (
    <div className="min-h-svh">
      <header className="flex items-center justify-between border-b px-6 py-3">
        <span className="font-semibold">Объекты и задачи</span>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-muted-foreground">{session.user.email}</span>
          <Button variant="outline" size="sm" onClick={signOut}>
            Выйти
          </Button>
        </div>
      </header>
      <main className="p-6">
        <Outlet />
      </main>
    </div>
  )
}

import { useQueryClient } from '@tanstack/react-query'
import { Navigate, NavLink, Outlet } from 'react-router'
import { useProfile } from '@/api/profiles'
import { useAuth } from '@/auth/AuthProvider'
import { ErrorText, Loading } from '@/components/PageState'
import { Button } from '@/components/ui/button'
import { ROLE_LABEL } from '@/lib/status'
import { supabase } from '@/lib/supabase'

// Обёртка для всех страниц после входа. Это только удобство интерфейса:
// данные защищает база, а не этот редирект.
export function ProtectedLayout() {
  const { session, loading } = useAuth()
  const profile = useProfile()
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

  const navClass = ({ isActive }: { isActive: boolean }) =>
    isActive ? 'font-medium text-foreground' : 'text-muted-foreground hover:text-foreground'

  return (
    <div className="min-h-svh">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b px-6 py-3">
        <nav className="flex items-center gap-5 text-sm">
          <span className="font-semibold">Объекты и задачи</span>
          <NavLink to="/" end className={navClass}>
            Объекты
          </NavLink>
          {profile.data?.role === 'executor' && (
            <NavLink to="/my-tasks" className={navClass}>
              Мои задачи
            </NavLink>
          )}
        </nav>
        <div className="flex items-center gap-4 text-sm">
          {profile.data && (
            <span className="text-muted-foreground">
              {profile.data.full_name} · {ROLE_LABEL[profile.data.role]}
            </span>
          )}
          <Button variant="outline" size="sm" onClick={signOut}>
            Выйти
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-5xl p-6">
        {/* Страницам нужна роль пользователя, поэтому показываем их только после загрузки профиля. */}
        {profile.isPending ? <Loading /> : profile.isError ? <ErrorText error={profile.error} /> : <Outlet />}
      </main>
    </div>
  )
}

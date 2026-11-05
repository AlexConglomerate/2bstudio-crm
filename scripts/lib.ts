// Общее для scripts/seed.ts и scripts/security-check.ts.
// Скрипты запускаются только на машине автора: им нужен секретный ключ из .env.
import 'dotenv/config'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

function env(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Не задана переменная ${name} в .env (см. .env.example)`)
  return value
}

const url = env('VITE_SUPABASE_URL')
const publishableKey = env('VITE_SUPABASE_ANON_KEY')

// Пароль демо-пользователей. Не хранится в репозитории: он открытый, а пароли раздаются только проверяющим.
export const password = env('SEED_PASSWORD')

export type UserKey = 'manager' | 'ivan' | 'sergey'

export const USERS: Record<UserKey, { email: string; fullName: string; role: 'manager' | 'executor' }> = {
  manager: { email: 'manager@example.com', fullName: 'Ольга Петрова', role: 'manager' },
  ivan: { email: 'executor1@example.com', fullName: 'Иван Кузнецов', role: 'executor' },
  sergey: { email: 'executor2@example.com', fullName: 'Сергей Волков', role: 'executor' },
}

const noSession = { auth: { persistSession: false, autoRefreshToken: false } }

// Клиент с секретным ключом: обходит RLS. Только для создания пользователей и очистки данных.
export const admin = createClient(url, env('SUPABASE_SERVICE_ROLE_KEY'), noSession)

// Клиент «как в браузере»: публичный ключ, без входа.
export function anonClient(): SupabaseClient {
  return createClient(url, publishableKey, noSession)
}

// Клиент «как в браузере» под конкретным пользователем: публичный ключ + вход по паролю.
// Всё, что он делает, проходит через RLS ровно так же, как запросы из приложения.
export async function signIn(key: UserKey): Promise<{ client: SupabaseClient; userId: string }> {
  const client = anonClient()
  const { data, error } = await client.auth.signInWithPassword({ email: USERS[key].email, password })
  if (error) throw new Error(`Не удалось войти как ${USERS[key].email}: ${error.message}`)
  return { client, userId: data.user.id }
}

// Бросает ошибку, если запрос к Supabase вернул ошибку; иначе возвращает data.
export function unwrap<T>({
  data,
  error,
  what,
}: {
  data: T | null
  error: { message: string } | null
  what: string
}): T {
  if (error) throw new Error(`${what}: ${error.message}`)
  return data as T
}

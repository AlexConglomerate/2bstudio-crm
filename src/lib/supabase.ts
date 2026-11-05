import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'

// Во фронт попадают только публичные значения: URL проекта и publishable (anon) ключ.
// Ключ сам по себе ничего не разрешает — все права проверяет база (RLS).
const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !key) {
  throw new Error('Не заданы VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY (см. .env.example)')
}

// Database — типы, сгенерированные из схемы базы (`pnpm gen-types`): запросы проверяются TypeScript.
export const supabase = createClient<Database>(url, key)

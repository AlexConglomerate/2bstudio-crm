# 2BStudio — тестовое задание: мини-CRM «Объекты и задачи»

Тестовое задание от студии 2B Studio (вакансия Fullstack React/TS/Supabase).
Полный текст ТЗ — `private/task.md`, вакансия — `private/vacancy.md` (папка в `.gitignore`, в репозиторий не попадает).

**Перед работой прочитай `docs/plan.md`** — там этапы, галочки и «Где остановились».
В конце сессии обнови блок «Где остановились» в `docs/plan.md`.
Любое решение там, где ТЗ неоднозначно, записывай в `docs/decisions.md` (это часть сдачи).

## Суть

Строительная компания. Постановщик ставит задачи по объектам (стройкам), исполнитель берёт в работу и отдаёт на проверку.
Оценивают **логику, защиту данных и понимание сделанного**, дизайн — нет. После сдачи — созвон, где автора спрашивают про код,
поэтому решения должны быть простыми и объяснимыми.

## Что сдаём (одним сообщением в hh.ru)

1. Ссылка на приложение (Vercel) + доступы: 1 постановщик, 2 исполнителя; в базе 2–3 объекта и задачи в разных статусах.
2. Открытый GitHub-репозиторий с миграциями и `README.md` (как запустить).
3. Объяснение для руководителя-непрограммиста — `docs/for-manager.md` (текст; видео автор снимет сам).
4. Список решений и допущений — `docs/decisions.md`.

## Стек

- Frontend: React + TypeScript + Vite, Tailwind, shadcn/ui, TanStack Query, React Hook Form + Zod, react-router. Интерфейс на русском.
- Backend: Supabase cloud (free tier, регион Frankfurt). Postgres + RLS + SQL-функции. Без своего сервера, без Edge Functions, если не понадобятся.
- Deploy: Vercel (импорт GitHub-репозитория, SPA-rewrite на `index.html`).
- Миграции: `supabase/migrations/*.sql`, применяются `supabase db push`. Настройки Auth — в `supabase/config.toml`, применяются `supabase config push`.
- Пакетный менеджер: pnpm.

## Модель данных (план)

- `profiles` (id = auth.users.id, full_name, role: `manager` | `executor`). Роль меняется только через service_role.
- `objects` (id, name, address, created_at, created_by).
- `tasks` (id, title, description, object_id, assignee_id, status, author_id, created_at).
- `task_status_history` (id, task_id, from_status, to_status, changed_by, comment, changed_at).
- Статусы (enum `task_status`): `new` Новая, `in_progress` В работе, `review` На проверке, `accepted` Принята, `rework` На доработке.

Переходы: new→in_progress (исполнитель), in_progress→review (исполнитель), review→accepted (постановщик),
review→rework (постановщик, комментарий обязателен), rework→in_progress (исполнитель). Остальные запрещены.

## Правила безопасности (не нарушать)

- Все права — на уровне базы (RLS + grants). Интерфейс только прячет кнопки, но ничего не защищает.
- В проекте отключено «Automatically expose new tables»: каждой таблице явно `grant` нужные права роли `authenticated`.
  Роли `anon` ничего не выдаём. RLS включаем явно в каждой миграции (`alter table ... enable row level security`).
- Статус задачи меняется **только** через RPC `change_task_status`. Прямой UPDATE колонки `status` запрещён.
  Функция проверяет роль, исполнителя, допустимость перехода, обязательный комментарий и сама пишет историю.
- `task_status_history`: у `authenticated` только SELECT. Никаких insert/update/delete политик.
- Роль пользователя — в `profiles.role`, **не** в `user_metadata` (его пользователь может менять сам).
- Исполнителем назначается только пользователь с ролью `executor` — проверка в базе.
- Хелперы вроде `is_manager()` — `security definer`, `set search_path = ''`, чтобы не ловить рекурсию RLS.
- Открытая регистрация выключена (`enable_signup = false`). Пользователи создаются скриптом `scripts/seed.ts` с service_role.
- `SUPABASE_SERVICE_ROLE_KEY` и пароль БД — только в `.env` (gitignored). Во фронт попадают только переменные `VITE_*` (URL и anon/publishable key).
- `scripts/security-check.ts` — заходит под исполнителем и пытается делать запрещённое напрямую через supabase-js. Все попытки должны падать.

## Стиль кода

- Функции с больше чем одним параметром принимают объект: `changeStatus({ taskId, status, comment })`, а не `changeStatus(taskId, status, comment)`.
- SQL-функции — с именованными параметрами (`p_task_id`, …); из клиента вызываются `supabase.rpc('fn', { ... })`.
- Простые решения важнее хитрых: автор должен объяснить каждую строку на созвоне.

## Проверка перед сдачей

Пройти сценарии как пользователь за обе роли в браузере (постановщик, оба исполнителя), а не только «собралось».
Прогнать `scripts/security-check.ts` против облачной базы.

# План

Легенда: 👤 — делает автор (браузер, логин), 🤖 — делает агент.

## Этап 0. Подготовка

- [x] 👤 Аккаунт Supabase, проект `2BStudio` (Frankfurt), пароль БД → `.env`
- [x] 👤 Настройки Data API: Data API — вкл, Automatically expose new tables — **выкл**, Automatic RLS — вкл (проверено запросом к базе)
- [x] 🤖 Установлены `supabase` CLI и `gh`
- [x] 👤 `! supabase login` и `! gh auth login`
- [x] 👤 Аккаунт на vercel.com (вход через GitHub)
- [x] 👤 Сообщение в чат hh: когда начал и когда планирую сдать

## Этап 1. Каркас

- [x] 🤖 `git init`, Vite + React + TS + Tailwind + shadcn/ui, react-router, TanStack Query
- [x] 🤖 `supabase init`, `supabase link --project-ref …`, ключи → `.env`, `.env.example`
- [x] 🤖 `config.toml`: `enable_signup = false` → `supabase config push` (проверено: signup → 422 `signup_disabled`)
- [x] 🤖 Страница входа (email + пароль), выход, защищённый layout
- [x] 🤖 Репозиторий на GitHub (открытый), первый push — https://github.com/AlexConglomerate/2bstudio-crm
- [x] 👤 Vercel: Import project из GitHub, env `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` — https://2bstudio-crm.vercel.app
- [x] 👤 ~~Проверить ссылку без VPN~~ — снято: автор не в России, Vercel из России недавно открывался

Готово, когда: ссылка открывается, вход работает.

## Этап 2. База

- [ ] 🤖 Миграция: enum, таблицы, FK, индексы
- [ ] 🤖 Миграция: grants + RLS-политики, хелперы `is_manager()`
- [ ] 🤖 Миграция: `change_task_status` + запрет прямого UPDATE статуса, защита истории, проверка роли исполнителя
- [ ] 🤖 `scripts/seed.ts`: 1 постановщик, 2 исполнителя, 2–3 объекта, задачи в разных статусах (через RPC, чтобы история была настоящей)
- [ ] 🤖 `scripts/security-check.ts`: попытки исполнителя читать/менять чужое, запрещённые переходы, подделка истории, регистрация
- [ ] 🤖 `supabase db push`, прогон seed и security-check

Готово, когда: все атаки падают. **СТОП: агент объясняет автору SQL** (схема, каждая политика, функция статусов) — до этапа 3.

## Этап 3. Экраны

- [ ] 🤖 Список объектов (+ создание/редактирование/удаление для постановщика)
- [ ] 🤖 Карточка объекта со списком задач и статусами
- [ ] 🤖 Карточка задачи: данные, кнопки только доступных действий, комментарий при возврате, история
- [ ] 🤖 Создание/редактирование задачи (постановщик), выбор исполнителя
- [ ] 🤖 «Мои задачи» для исполнителя

Готово, когда: сценарии проходят под всеми тремя пользователями.

## Этап 4. Сдача

- [ ] 🤖 Пройти сценарии в браузере за обе роли
- [ ] 🤖 `README.md`: как запустить, структура, доступы
- [ ] 🤖 `docs/for-manager.md`: объяснение без терминов
- [ ] 🤖 Дочистить `docs/decisions.md`, раздел «Не успел»
- [ ] 👤 Прочитать всё, поправить под свой голос, снять видео
- [ ] 👤 Отправить сообщение в hh

## Где остановились

Этап 1 закрыт. Приложение: https://2bstudio-crm.vercel.app (Vercel, автодеплой из `main`), env-переменные подхватились,
секретного ключа в бандле нет, SPA-rewrite работает. URL прописан в `site_url` и вызван `supabase config push`.
В браузере войти пока некем — пользователей создаст `scripts/seed.ts` на этапе 2.
Ключи: во фронте publishable (`sb_publishable_…`) в переменной `VITE_SUPABASE_ANON_KEY`, в `.env` секретный `sb_secret_…`.
Интеграцию Supabase в Vercel **не** подключали (она создала бы свои переменные, включая секретный ключ).
Дальше — этап 2 (миграции, seed, security-check).

Учесть в этапе 2 (проверено в облачной базе через `pg_default_acl` / `pg_event_trigger`):
- Новые функции в `public` по умолчанию НЕ исполняются `authenticated` → явный `grant execute` на RPC и хелперы.
- Новые таблицы по умолчанию дают `anon`/`authenticated` права `Dxtm` (truncate и др.), без `select/insert/update/delete`
  → в миграции `revoke all on table … from anon, authenticated`, затем выдать только нужное.
- Event trigger `ensure_rls` включает RLS автоматически, но в миграциях всё равно пишем `enable row level security` явно.

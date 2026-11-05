-- Этап 2.1. Схема: типы, таблицы, связи, индексы.
-- Права и RLS — в следующей миграции (…_rls.sql), функция смены статуса — в …_task_status.sql.

-- Роли пользователей и статусы задач — enum: в базу нельзя записать опечатку вроде 'reveiw'.
create type public.user_role as enum ('manager', 'executor');
create type public.task_status as enum ('new', 'in_progress', 'review', 'accepted', 'rework');

-- Профиль = пользователь Supabase Auth + имя и роль.
-- Роль хранится здесь, а не в user_metadata: метаданные пользователь может менять сам.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null check (char_length(trim(full_name)) > 0),
  role public.user_role not null
);

-- Объект (стройка).
create table public.objects (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) > 0),
  address text not null check (char_length(trim(address)) > 0),
  -- Заполняется базой: клиент эту колонку передать не может (нет права на неё).
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now()
);

-- Задача.
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) > 0),
  description text not null default '',
  -- on delete restrict: объект с задачами удалить нельзя.
  object_id uuid not null references public.objects (id) on delete restrict,
  -- То, что это именно исполнитель (role = 'executor'), проверяет триггер в …_task_status.sql.
  assignee_id uuid not null references public.profiles (id),
  -- Новая задача всегда 'new'. Менять статус можно только функцией change_task_status.
  status public.task_status not null default 'new',
  author_id uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now()
);

create index tasks_object_id_idx on public.tasks (object_id);
create index tasks_assignee_id_idx on public.tasks (assignee_id);

-- История смен статуса. Пишет её только функция change_task_status.
create table public.task_status_history (
  id bigint generated always as identity primary key,
  -- on delete restrict: пока у задачи есть история, саму задачу удалить нельзя.
  task_id uuid not null references public.tasks (id) on delete restrict,
  from_status public.task_status not null,
  to_status public.task_status not null,
  changed_by uuid not null references public.profiles (id),
  comment text,
  changed_at timestamptz not null default now()
);

create index task_status_history_task_id_idx on public.task_status_history (task_id);

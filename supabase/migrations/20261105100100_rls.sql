-- Этап 2.2. Права (grants) и политики строк (RLS).
--
-- Два слоя защиты:
--   1. GRANT — какие действия и над какими КОЛОНКАМИ роль вообще может делать с таблицей.
--   2. RLS-политика — над какими СТРОКАМИ (чьи задачи, какие объекты).
-- Запрос проходит, только если разрешают оба слоя.
--
-- Роли Supabase: anon — не вошедший, authenticated — вошедший пользователь,
-- service_role — серверный ключ (только скрипты seed / security-check, обходит RLS).

-- ---------------------------------------------------------------------------
-- 1. Сначала забираем всё, что Supabase выдаёт новым таблицам по умолчанию.
-- ---------------------------------------------------------------------------
revoke all on table public.profiles, public.objects, public.tasks, public.task_status_history
  from anon, authenticated, service_role;

alter table public.profiles enable row level security;
alter table public.objects enable row level security;
alter table public.tasks enable row level security;
alter table public.task_status_history enable row level security;

-- ---------------------------------------------------------------------------
-- 2. Хелпер: текущий пользователь — постановщик?
-- security definer — выполняется с правами владельца, поэтому читает profiles без RLS
-- (нет риска рекурсии политик). search_path = '' — все имена пишем с явной схемой,
-- чтобы нельзя было подменить таблицу через свою схему.
-- ---------------------------------------------------------------------------
create function public.is_manager()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'manager'
  );
$$;

revoke execute on function public.is_manager() from public, anon;
grant execute on function public.is_manager() to authenticated;

-- ---------------------------------------------------------------------------
-- 3. profiles: все вошедшие видят имена и роли (нужно, чтобы показывать автора,
-- исполнителя и кто менял статус). Менять профили через API нельзя никому:
-- нет ни grant на insert/update/delete, ни политик.
-- ---------------------------------------------------------------------------
grant select on public.profiles to authenticated;

create policy profiles_select
  on public.profiles for select to authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- 4. objects: постановщик — всё; исполнитель — только объекты, где у него есть задача.
-- created_by/created_at не входят в grant: их заполняет база, подделать автора нельзя.
-- ---------------------------------------------------------------------------
grant select, delete on public.objects to authenticated;
grant insert (name, address), update (name, address) on public.objects to authenticated;

create policy objects_select
  on public.objects for select to authenticated
  using (
    public.is_manager()
    or exists (
      select 1 from public.tasks t
      where t.object_id = objects.id and t.assignee_id = (select auth.uid())
    )
  );

create policy objects_insert
  on public.objects for insert to authenticated
  with check (public.is_manager());

create policy objects_update
  on public.objects for update to authenticated
  using (public.is_manager())
  with check (public.is_manager());

-- Объект с задачами удалить не получится и постановщику: мешает внешний ключ tasks.object_id.
create policy objects_delete
  on public.objects for delete to authenticated
  using (public.is_manager());

-- ---------------------------------------------------------------------------
-- 5. tasks: постановщик — всё; исполнитель — только читает свои.
-- Колонки status, author_id, created_at не входят в grant на insert/update:
--   * статус меняется только функцией change_task_status (следующая миграция);
--   * автор и дата ставятся базой (default auth.uid(), now()).
-- ---------------------------------------------------------------------------
grant select, delete on public.tasks to authenticated;
grant insert (title, description, object_id, assignee_id),
      update (title, description, object_id, assignee_id)
  on public.tasks to authenticated;

create policy tasks_select
  on public.tasks for select to authenticated
  using (public.is_manager() or assignee_id = (select auth.uid()));

create policy tasks_insert
  on public.tasks for insert to authenticated
  with check (public.is_manager() and author_id = (select auth.uid()));

-- Принятая задача закрыта: её больше не редактируют.
create policy tasks_update
  on public.tasks for update to authenticated
  using (public.is_manager() and status <> 'accepted')
  with check (public.is_manager());

-- Удалить можно только задачу, которую ещё не брали в работу: у неё нет истории.
-- Дальше по задаче есть история, а её стирать нельзя (плюс внешний ключ истории тоже не даст).
create policy tasks_delete
  on public.tasks for delete to authenticated
  using (public.is_manager() and status = 'new');

-- ---------------------------------------------------------------------------
-- 6. task_status_history: только чтение. Видишь задачу — видишь её историю.
-- Подзапрос к tasks сам проходит через политику tasks, поэтому исполнитель
-- увидит историю только своих задач.
-- Записывает историю только change_task_status; insert/update/delete не выдаём никому.
-- ---------------------------------------------------------------------------
grant select on public.task_status_history to authenticated;

create policy history_select
  on public.task_status_history for select to authenticated
  using (exists (select 1 from public.tasks t where t.id = task_status_history.task_id));

-- ---------------------------------------------------------------------------
-- 7. service_role — для scripts/seed.ts и scripts/security-check.ts. RLS эта роль обходит,
-- но без grant таблицы ей недоступны. Выдаём минимум: создать профили и очистить демо-данные.
-- Объекты, задачи и историю seed создаёт от имени настоящих пользователей через обычный API
-- и change_task_status — так история получается настоящей.
-- ---------------------------------------------------------------------------
grant select, insert, update on public.profiles to service_role;
grant select, delete on public.objects, public.tasks, public.task_status_history to service_role;

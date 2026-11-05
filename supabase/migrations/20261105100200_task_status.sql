-- Этап 2.3. Смена статуса задачи и проверка исполнителя.

-- ---------------------------------------------------------------------------
-- 1. Исполнителем можно назначить только пользователя с ролью 'executor'.
-- Триггер, а не политика: срабатывает для любого способа записи (API, seed, SQL)
-- и даёт понятный текст ошибки.
-- ---------------------------------------------------------------------------
create function public.check_task_assignee()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.profiles where id = new.assignee_id and role = 'executor'
  ) then
    raise exception 'Исполнителем можно назначить только пользователя с ролью «исполнитель»';
  end if;
  return new;
end;
$$;

revoke execute on function public.check_task_assignee() from public, anon, authenticated;

create trigger tasks_check_assignee
  before insert or update of assignee_id on public.tasks
  for each row execute function public.check_task_assignee();

-- ---------------------------------------------------------------------------
-- 2. change_task_status — единственный способ сменить статус.
-- Прямой UPDATE колонки status запрещён: в предыдущей миграции её нет в grant.
-- Функция security definer: она сама меняет статус и пишет историю, а все проверки
-- делает внутри. Порядок проверок:
--   вошёл ли пользователь → видит ли он задачу → разрешён ли переход →
--   тот ли человек его делает → есть ли комментарий при возврате.
-- ---------------------------------------------------------------------------
create function public.change_task_status(
  p_task_id uuid,
  p_to_status public.task_status,
  p_comment text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_is_manager boolean := public.is_manager();
  v_comment text := nullif(trim(p_comment), '');
  v_task public.tasks;
  v_transition text;
begin
  if v_user_id is null then
    raise exception 'Нужно войти в систему';
  end if;

  -- for update — блокируем строку, чтобы два одновременных запроса не сменили статус дважды.
  select * into v_task from public.tasks where id = p_task_id for update;

  -- Чужую задачу исполнитель не видит, поэтому и ответ тот же, что для несуществующей.
  if not found or (not v_is_manager and v_task.assignee_id <> v_user_id) then
    raise exception 'Задача не найдена';
  end if;

  v_transition := v_task.status::text || ' -> ' || p_to_status::text;

  if v_transition in ('new -> in_progress', 'in_progress -> review', 'rework -> in_progress') then
    if v_task.assignee_id <> v_user_id then
      raise exception 'Этот переход делает только назначенный исполнитель';
    end if;

  elsif v_transition in ('review -> accepted', 'review -> rework') then
    if not v_is_manager then
      raise exception 'Этот переход делает только постановщик';
    end if;
    if p_to_status = 'rework' and v_comment is null then
      raise exception 'При возврате на доработку комментарий обязателен';
    end if;

  else
    raise exception 'Переход % запрещён', v_transition;
  end if;

  update public.tasks set status = p_to_status where id = p_task_id;

  insert into public.task_status_history (task_id, from_status, to_status, changed_by, comment)
  values (p_task_id, v_task.status, p_to_status, v_user_id, v_comment);
end;
$$;

revoke execute on function public.change_task_status(uuid, public.task_status, text) from public, anon;
grant execute on function public.change_task_status(uuid, public.task_status, text) to authenticated;

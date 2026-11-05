// Проверка защиты: pnpm security-check  (сначала pnpm seed)
//
// Заходит под исполнителями, постановщиком и без входа — с публичным ключом, как браузер, —
// и пытается напрямую через supabase-js сделать то, что запрещено. Каждая попытка должна упасть:
//   * «ошибка»   — база отказала (нет прав, исключение в функции);
//   * «0 строк»  — RLS отфильтровал строки: запрос прошёл, но ничего не прочитал и не изменил.
// Потом сравнивает снимок базы до и после атак: ничего не должно было измениться.
// В конце — контрольный «честный» сценарий, чтобы убедиться, что разрешённое работает
// (иначе все проверки могли бы «пройти», например, из-за сломанного входа).
import type { SupabaseClient } from '@supabase/supabase-js'
import { admin, anonClient, signIn, unwrap } from './lib.ts'

type Result = { data: unknown; error: { message: string } | null }
type Expect = 'error' | 'no-rows'

const results: { name: string; ok: boolean; detail: string }[] = []

function report({ name, ok, detail }: { name: string; ok: boolean; detail: string }) {
  results.push({ name, ok, detail })
  console.log(`${ok ? '  ✓' : '  ✗ FAIL'}  ${name}  — ${detail}`)
}

// Попытка запрещённого действия. ok = база не дала это сделать.
async function attack({ name, expect, run }: { name: string; expect: Expect; run: () => PromiseLike<Result> }) {
  const { data, error } = await run()
  if (error) {
    report({ name, ok: true, detail: `ошибка: ${error.message}` })
    return
  }
  const noRows = data == null || (Array.isArray(data) && data.length === 0)
  if (expect === 'no-rows' && noRows) {
    report({ name, ok: true, detail: '0 строк' })
    return
  }
  report({ name, ok: false, detail: `запрос прошёл: ${JSON.stringify(data)}` })
}

// Разрешённое действие из контрольного сценария. ok = прошло без ошибки и, если запрос
// возвращает строки (update/delete с .select()), затронуло хотя бы одну.
async function allowed({ name, run }: { name: string; run: () => PromiseLike<Result> }) {
  const { data, error } = await run()
  if (error) {
    report({ name, ok: false, detail: `ошибка: ${error.message}` })
    return
  }
  const touchedNothing = Array.isArray(data) && data.length === 0
  report({ name, ok: !touchedNothing, detail: touchedNothing ? '0 строк' : 'прошло' })
}

async function snapshot(): Promise<string> {
  const tables = ['profiles', 'objects', 'tasks', 'task_status_history'] as const
  const parts = await Promise.all(
    tables.map(async (table) =>
      unwrap({ ...(await admin.from(table).select('*').order('id')), what: `Снимок ${table}` }),
    ),
  )
  return JSON.stringify(parts)
}

function rpc({ client, taskId, to, comment }: { client: SupabaseClient; taskId: string; to: string; comment?: string }) {
  return client.rpc('change_task_status', { p_task_id: taskId, p_to_status: to, p_comment: comment ?? null })
}

async function findTask({ title }: { title: string }) {
  return unwrap({
    ...(await admin.from('tasks').select('*').eq('title', title).single()),
    what: `Задача «${title}» (запустите pnpm seed)`,
  })
}

async function main() {
  const manager = await signIn('manager')
  const ivan = await signIn('ivan')
  const sergey = await signIn('sergey')
  const anon = anonClient()

  // Задачи из scripts/seed.ts.
  const ivanNew = await findTask({ title: 'Подвести электричество' })
  const ivanReview = await findTask({ title: 'Смонтировать опалубку перекрытия 5 этажа' })
  const ivanAccepted = await findTask({ title: 'Залить фундамент секции 3' })
  const sergeyNew = await findTask({ title: 'Вывезти строительный мусор' })
  const sergeyRework = await findTask({ title: 'Проверить армирование колонн' })
  const warehouse = unwrap({
    ...(await admin.from('objects').select('*').eq('name', 'Склад на Промышленной').single()),
    what: 'Объект «Склад» (только у Сергея)',
  })

  const before = await snapshot()

  console.log('\nИсполнитель (Иван) — чужие данные:')
  await attack({
    name: 'прочитать задачу Сергея',
    expect: 'no-rows',
    run: () => ivan.client.from('tasks').select('*').eq('id', sergeyRework.id),
  })
  await attack({
    name: 'прочитать объект, где у Ивана нет задач',
    expect: 'no-rows',
    run: () => ivan.client.from('objects').select('*').eq('id', warehouse.id),
  })
  await attack({
    name: 'прочитать историю задачи Сергея',
    expect: 'no-rows',
    run: () => ivan.client.from('task_status_history').select('*').eq('task_id', sergeyRework.id),
  })
  await attack({
    name: 'изменить задачу Сергея',
    expect: 'no-rows',
    run: () => ivan.client.from('tasks').update({ title: 'взлом' }).eq('id', sergeyRework.id).select(),
  })
  await attack({
    name: 'взять в работу задачу Сергея через RPC',
    expect: 'error',
    run: () => rpc({ client: ivan.client, taskId: sergeyNew.id, to: 'in_progress' }),
  })

  console.log('\nИсполнитель (Иван) — свои задачи в обход правил:')
  await attack({
    name: 'сменить статус своей задачи UPDATE-ом (new → accepted)',
    expect: 'error',
    run: () => ivan.client.from('tasks').update({ status: 'accepted' }).eq('id', ivanNew.id).select(),
  })
  await attack({
    name: 'отредактировать свою задачу',
    expect: 'no-rows',
    run: () => ivan.client.from('tasks').update({ title: 'взлом' }).eq('id', ivanNew.id).select(),
  })
  await attack({
    name: 'переназначить свою задачу на Сергея',
    expect: 'no-rows',
    run: () => ivan.client.from('tasks').update({ assignee_id: sergey.userId }).eq('id', ivanNew.id).select(),
  })
  await attack({
    name: 'удалить свою задачу',
    expect: 'no-rows',
    run: () => ivan.client.from('tasks').delete().eq('id', ivanNew.id).select(),
  })
  await attack({
    name: 'RPC: перескочить new → review',
    expect: 'error',
    run: () => rpc({ client: ivan.client, taskId: ivanNew.id, to: 'review' }),
  })
  await attack({
    name: 'RPC: new → accepted',
    expect: 'error',
    run: () => rpc({ client: ivan.client, taskId: ivanNew.id, to: 'accepted' }),
  })
  await attack({
    name: 'RPC: принять свою задачу review → accepted',
    expect: 'error',
    run: () => rpc({ client: ivan.client, taskId: ivanReview.id, to: 'accepted' }),
  })
  await attack({
    name: 'RPC: вернуть принятую задачу в работу accepted → in_progress',
    expect: 'error',
    run: () => rpc({ client: ivan.client, taskId: ivanAccepted.id, to: 'in_progress' }),
  })

  console.log('\nИсполнитель (Иван) — права постановщика:')
  await attack({
    name: 'создать задачу',
    expect: 'error',
    run: () =>
      ivan.client
        .from('tasks')
        .insert({ title: 'взлом', object_id: warehouse.id, assignee_id: ivan.userId })
        .select(),
  })
  await attack({
    name: 'создать объект',
    expect: 'error',
    run: () => ivan.client.from('objects').insert({ name: 'взлом', address: 'взлом' }).select(),
  })
  await attack({
    name: 'удалить объект',
    expect: 'no-rows',
    run: () => ivan.client.from('objects').delete().eq('id', ivanNew.object_id).select(),
  })
  await attack({
    name: 'сделать себя постановщиком (profiles.role)',
    expect: 'error',
    run: () => ivan.client.from('profiles').update({ role: 'manager' }).eq('id', ivan.userId).select(),
  })
  await attack({
    name: 'роль в user_metadata не даёт прав постановщика',
    expect: 'no-rows',
    run: async () => {
      await ivan.client.auth.updateUser({ data: { role: 'manager' } })
      await ivan.client.auth.refreshSession()
      const result = await ivan.client.from('tasks').select('*').eq('id', sergeyRework.id)
      await ivan.client.auth.updateUser({ data: { role: null } })
      return result
    },
  })

  console.log('\nИстория статусов — подделать, изменить, удалить:')
  await attack({
    name: 'исполнитель: вставить запись в историю',
    expect: 'error',
    run: () =>
      ivan.client
        .from('task_status_history')
        .insert({ task_id: ivanReview.id, from_status: 'review', to_status: 'accepted', changed_by: manager.userId })
        .select(),
  })
  await attack({
    name: 'исполнитель: изменить запись истории',
    expect: 'error',
    run: () => ivan.client.from('task_status_history').update({ comment: 'взлом' }).eq('task_id', ivanReview.id).select(),
  })
  await attack({
    name: 'исполнитель: удалить историю своей задачи',
    expect: 'error',
    run: () => ivan.client.from('task_status_history').delete().eq('task_id', ivanReview.id).select(),
  })
  await attack({
    name: 'постановщик: вставить запись в историю',
    expect: 'error',
    run: () =>
      manager.client
        .from('task_status_history')
        .insert({ task_id: ivanNew.id, from_status: 'new', to_status: 'accepted', changed_by: manager.userId })
        .select(),
  })
  await attack({
    name: 'постановщик: удалить историю',
    expect: 'error',
    run: () => manager.client.from('task_status_history').delete().eq('task_id', sergeyRework.id).select(),
  })

  console.log('\nПостановщик — в обход правил:')
  await attack({
    name: 'сменить статус UPDATE-ом (review → accepted)',
    expect: 'error',
    run: () => manager.client.from('tasks').update({ status: 'accepted' }).eq('id', ivanReview.id).select(),
  })
  await attack({
    name: 'RPC: вернуть на доработку без комментария',
    expect: 'error',
    run: () => rpc({ client: manager.client, taskId: ivanReview.id, to: 'rework' }),
  })
  await attack({
    name: 'RPC: вернуть на доработку с комментарием из пробелов',
    expect: 'error',
    run: () => rpc({ client: manager.client, taskId: ivanReview.id, to: 'rework', comment: '   ' }),
  })
  await attack({
    name: 'RPC: взять задачу в работу за исполнителя',
    expect: 'error',
    run: () => rpc({ client: manager.client, taskId: ivanNew.id, to: 'in_progress' }),
  })
  await attack({
    name: 'назначить исполнителем постановщика (создание)',
    expect: 'error',
    run: () =>
      manager.client
        .from('tasks')
        .insert({ title: 'тест', object_id: warehouse.id, assignee_id: manager.userId })
        .select(),
  })
  await attack({
    name: 'назначить исполнителем постановщика (редактирование)',
    expect: 'error',
    run: () => manager.client.from('tasks').update({ assignee_id: manager.userId }).eq('id', ivanNew.id).select(),
  })
  await attack({
    name: 'подменить автора задачи',
    expect: 'error',
    run: () => manager.client.from('tasks').update({ author_id: ivan.userId }).eq('id', ivanNew.id).select(),
  })
  await attack({
    name: 'отредактировать принятую задачу',
    expect: 'no-rows',
    run: () => manager.client.from('tasks').update({ title: 'взлом' }).eq('id', ivanAccepted.id).select(),
  })
  await attack({
    name: 'удалить задачу с историей',
    expect: 'no-rows',
    run: () => manager.client.from('tasks').delete().eq('id', sergeyRework.id).select(),
  })
  await attack({
    name: 'удалить объект, в котором есть задачи',
    expect: 'error',
    run: () => manager.client.from('objects').delete().eq('id', warehouse.id).select(),
  })
  await attack({
    name: 'сменить себе роль',
    expect: 'error',
    run: () => manager.client.from('profiles').update({ role: 'executor' }).eq('id', manager.userId).select(),
  })

  console.log('\nБез входа (только публичный ключ из фронтенда):')
  await attack({
    name: 'прочитать задачи',
    expect: 'error',
    run: () => anon.from('tasks').select('*'),
  })
  await attack({
    name: 'прочитать профили',
    expect: 'error',
    run: () => anon.from('profiles').select('*'),
  })
  await attack({
    name: 'вызвать change_task_status',
    expect: 'error',
    run: () => rpc({ client: anon, taskId: ivanReview.id, to: 'accepted' }),
  })
  await attack({
    name: 'зарегистрироваться',
    expect: 'error',
    run: async () => {
      const { data, error } = await anon.auth.signUp({ email: 'hacker@example.com', password: 'hacker-password-123' })
      return { data: data.user ? [data.user] : null, error }
    },
  })

  console.log('\nВидимость — каждый видит только своё:')
  for (const { label, who } of [
    { label: 'Иван', who: ivan },
    { label: 'Сергей', who: sergey },
  ]) {
    const tasks = unwrap({ ...(await who.client.from('tasks').select('assignee_id')), what: label })
    report({
      name: `${label} видит только свои задачи`,
      ok: tasks.length > 0 && tasks.every((t) => t.assignee_id === who.userId),
      detail: `задач видно: ${tasks.length}, все свои: ${tasks.every((t) => t.assignee_id === who.userId)}`,
    })
  }
  const allTasks = unwrap({ ...(await manager.client.from('tasks').select('id')), what: 'manager' })
  const realCount = unwrap({ ...(await admin.from('tasks').select('id')), what: 'admin' }).length
  report({
    name: 'постановщик видит все задачи',
    ok: allTasks.length === realCount,
    detail: `${allTasks.length} из ${realCount}`,
  })

  console.log('\nДанные после атак:')
  const after = await snapshot()
  report({
    name: 'в базе ничего не изменилось',
    ok: before === after,
    detail: before === after ? 'снимки совпадают' : 'снимки РАЗЛИЧАЮТСЯ',
  })

  // Контрольный сценарий на временной задаче: всё разрешённое должно проходить.
  console.log('\nКонтроль: разрешённый жизненный цикл задачи')
  const temp = unwrap({
    ...(await manager.client
      .from('tasks')
      .insert({ title: '[security-check] временная', object_id: ivanNew.object_id, assignee_id: ivan.userId })
      .select()
      .single()),
    what: 'Создание временной задачи постановщиком',
  })
  try {
    await allowed({
      name: 'постановщик: отредактировать задачу',
      run: () => manager.client.from('tasks').update({ description: 'проверка' }).eq('id', temp.id).select(),
    })
    const step = ({ who, to, comment }: { who: SupabaseClient; to: string; comment?: string }) =>
      allowed({
        name: `${who === manager.client ? 'постановщик' : 'Иван'}: → ${to}`,
        run: () => rpc({ client: who, taskId: temp.id, to, comment }),
      })
    await step({ who: ivan.client, to: 'in_progress' })
    await step({ who: ivan.client, to: 'review' })
    await step({ who: manager.client, to: 'rework', comment: 'Переделать' })
    await step({ who: ivan.client, to: 'in_progress' })
    await step({ who: ivan.client, to: 'review' })
    await step({ who: manager.client, to: 'accepted' })

    const history = unwrap({
      ...(await ivan.client.from('task_status_history').select('*').eq('task_id', temp.id)),
      what: 'История временной задачи',
    })
    report({
      name: 'Иван видит историю своей задачи с комментарием постановщика',
      ok: history.length === 6 && history.some((h) => h.comment === 'Переделать' && h.changed_by === manager.userId),
      detail: `записей: ${history.length}`,
    })
  } finally {
    // Временную задачу убирает admin: через API её историю удалить нельзя (что мы и проверили).
    await admin.from('task_status_history').delete().eq('task_id', temp.id)
    await admin.from('tasks').delete().eq('id', temp.id)
  }

  console.log('\nКонтроль: постановщик удаляет новую задачу и пустой объект')
  const emptyObject = unwrap({
    ...(await manager.client.from('objects').insert({ name: '[security-check]', address: '—' }).select().single()),
    what: 'Создание временного объекта',
  })
  const newTask = unwrap({
    ...(await manager.client
      .from('tasks')
      .insert({ title: '[security-check] новая', object_id: emptyObject.id, assignee_id: sergey.userId })
      .select()
      .single()),
    what: 'Создание новой задачи',
  })
  await allowed({
    name: 'постановщик: удалить задачу в статусе «Новая»',
    run: () => manager.client.from('tasks').delete().eq('id', newTask.id).select(),
  })
  await allowed({
    name: 'постановщик: удалить объект без задач',
    run: () => manager.client.from('objects').delete().eq('id', emptyObject.id).select(),
  })

  const failed = results.filter((r) => !r.ok)
  console.log(`\nИтого: ${results.length - failed.length} из ${results.length} проверок пройдено.`)
  if (failed.length > 0) {
    console.log('Провалены:')
    for (const r of failed) console.log(`  ✗ ${r.name} — ${r.detail}`)
    process.exit(1)
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})

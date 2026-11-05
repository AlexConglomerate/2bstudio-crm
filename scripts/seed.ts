// Наполнение облачной базы демо-данными: pnpm seed
//
// 1. Создаёт (или обновляет) трёх пользователей и их профили — это делает admin-клиент
//    с секретным ключом, потому что открытая регистрация выключена, а роль через API не меняется.
// 2. Удаляет старые объекты, задачи и историю (скрипт можно запускать повторно).
// 3. Объекты и задачи создаёт постановщик, статусы меняют исполнители и постановщик
//    через change_task_status — так же, как в приложении. Поэтому история настоящая.
import type { SupabaseClient } from '@supabase/supabase-js'
import { admin, password, signIn, unwrap, USERS, type UserKey } from './lib.ts'

type Status = 'in_progress' | 'review' | 'accepted' | 'rework'

const OBJECTS = {
  north: { name: 'ЖК «Северный», корпус 2', address: 'г. Москва, ул. Северная, 12' },
  warehouse: { name: 'Склад на Промышленной', address: 'г. Подольск, Промышленная ул., 7' },
  cottage: { name: 'Коттедж в Сосновке', address: 'Московская обл., пос. Сосновка, д. 3' },
}

// steps — цепочка переходов от статуса «Новая». Комментарий обязателен при возврате на доработку.
const TASKS: {
  title: string
  description: string
  object: keyof typeof OBJECTS
  assignee: 'ivan' | 'sergey'
  steps: { to: Status; comment?: string }[]
}[] = [
  {
    title: 'Залить фундамент секции 3',
    description: 'Бетон М300, после заливки — уход за бетоном 7 дней.',
    object: 'north',
    assignee: 'ivan',
    steps: [{ to: 'in_progress' }, { to: 'review' }, { to: 'accepted', comment: 'Принято, спасибо' }],
  },
  {
    title: 'Смонтировать опалубку перекрытия 5 этажа',
    description: 'По проекту КЖ-5, лист 3.',
    object: 'north',
    assignee: 'ivan',
    steps: [{ to: 'in_progress' }, { to: 'review' }],
  },
  {
    title: 'Проверить армирование колонн',
    description: 'Колонны 1–12 по оси А, приложить фото.',
    object: 'north',
    assignee: 'sergey',
    steps: [
      { to: 'in_progress' },
      { to: 'review' },
      { to: 'rework', comment: 'Шаг хомутов не по проекту на колоннах 4 и 5, переделать' },
    ],
  },
  {
    title: 'Вывезти строительный мусор',
    description: 'Два контейнера по 8 м³.',
    object: 'north',
    assignee: 'sergey',
    steps: [],
  },
  {
    title: 'Утеплить кровлю',
    description: 'Минвата 200 мм, пароизоляция снизу.',
    object: 'warehouse',
    assignee: 'sergey',
    steps: [{ to: 'in_progress' }],
  },
  {
    title: 'Установить секционные ворота',
    description: 'Ворота 4×4 м, проём по оси 1.',
    object: 'warehouse',
    assignee: 'sergey',
    steps: [
      { to: 'in_progress' },
      { to: 'review' },
      { to: 'rework', comment: 'Ворота не закрываются до конца, отрегулировать' },
      { to: 'in_progress', comment: 'Взял в работу, приеду завтра' },
    ],
  },
  {
    title: 'Подвести электричество',
    description: 'Ввод 15 кВт, щит в техпомещении.',
    object: 'cottage',
    assignee: 'ivan',
    steps: [],
  },
]

async function upsertUser(key: UserKey): Promise<string> {
  const { email, fullName, role } = USERS[key]

  const list = await admin.auth.admin.listUsers()
  if (list.error) throw new Error(`Список пользователей: ${list.error.message}`)
  let id = list.data.users.find((u) => u.email === email)?.id

  if (id) {
    const { error } = await admin.auth.admin.updateUserById(id, { password, email_confirm: true })
    if (error) throw new Error(`${email}: ${error.message}`)
  } else {
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
    if (error) throw new Error(`${email}: ${error.message}`)
    id = data.user.id
  }

  unwrap({
    ...(await admin.from('profiles').upsert({ id, full_name: fullName, role })),
    what: `Профиль ${email}`,
  })
  return id
}

async function clearData() {
  // Порядок важен: история держит задачи, задачи держат объекты (внешние ключи on delete restrict).
  unwrap({ ...(await admin.from('task_status_history').delete().gte('id', 0)), what: 'Очистка истории' })
  unwrap({ ...(await admin.from('tasks').delete().not('id', 'is', null)), what: 'Очистка задач' })
  unwrap({ ...(await admin.from('objects').delete().not('id', 'is', null)), what: 'Очистка объектов' })
}

async function main() {
  const ids = {
    manager: await upsertUser('manager'),
    ivan: await upsertUser('ivan'),
    sergey: await upsertUser('sergey'),
  }
  console.log('Пользователи готовы')

  await clearData()

  const clients: Record<UserKey, SupabaseClient> = {
    manager: (await signIn('manager')).client,
    ivan: (await signIn('ivan')).client,
    sergey: (await signIn('sergey')).client,
  }

  const objectIds = {} as Record<keyof typeof OBJECTS, string>
  for (const [key, object] of Object.entries(OBJECTS) as [keyof typeof OBJECTS, (typeof OBJECTS)['north']][]) {
    const row = unwrap({
      ...(await clients.manager.from('objects').insert(object).select('id').single()),
      what: `Объект ${object.name}`,
    })
    objectIds[key] = row.id
  }
  console.log(`Объектов: ${Object.keys(objectIds).length}`)

  for (const task of TASKS) {
    const row = unwrap({
      ...(await clients.manager
        .from('tasks')
        .insert({
          title: task.title,
          description: task.description,
          object_id: objectIds[task.object],
          assignee_id: ids[task.assignee],
        })
        .select('id')
        .single()),
      what: `Задача ${task.title}`,
    })

    for (const step of task.steps) {
      // Принять и вернуть на доработку может постановщик, остальное — назначенный исполнитель.
      const actor = step.to === 'accepted' || step.to === 'rework' ? 'manager' : task.assignee
      unwrap({
        ...(await clients[actor].rpc('change_task_status', {
          p_task_id: row.id,
          p_to_status: step.to,
          p_comment: step.comment ?? null,
        })),
        what: `${task.title} → ${step.to}`,
      })
    }
  }
  console.log(`Задач: ${TASKS.length}`)

  console.log('\nДоступы (пароль у всех — SEED_PASSWORD из .env):')
  for (const { email, fullName, role } of Object.values(USERS)) {
    console.log(`  ${role === 'manager' ? 'постановщик' : 'исполнитель'}  ${email}  ${fullName}`)
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})

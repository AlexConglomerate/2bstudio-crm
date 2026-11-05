import { createBrowserRouter, Navigate } from 'react-router'
import { ProtectedLayout } from '@/components/ProtectedLayout'
import { LoginPage } from '@/pages/LoginPage'
import { MyTasksPage } from '@/pages/MyTasksPage'
import { ObjectFormPage } from '@/pages/ObjectFormPage'
import { ObjectPage } from '@/pages/ObjectPage'
import { ObjectsPage } from '@/pages/ObjectsPage'
import { TaskFormPage } from '@/pages/TaskFormPage'
import { TaskPage } from '@/pages/TaskPage'

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: <ProtectedLayout />,
    children: [
      { path: '/', element: <ObjectsPage /> },
      { path: '/objects/new', element: <ObjectFormPage /> },
      { path: '/objects/:id', element: <ObjectPage /> },
      { path: '/objects/:id/edit', element: <ObjectFormPage /> },
      { path: '/tasks/new', element: <TaskFormPage /> },
      { path: '/tasks/:id', element: <TaskPage /> },
      { path: '/tasks/:id/edit', element: <TaskFormPage /> },
      { path: '/my-tasks', element: <MyTasksPage /> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
])

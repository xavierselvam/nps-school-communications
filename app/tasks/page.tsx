'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useCallback } from 'react'
import { format, isPast, isToday } from 'date-fns'
import Link from 'next/link'

interface Task {
  id: string
  title: string
  dueAt: string | null
  status: 'OPEN' | 'DONE'
  createdAt: string
  email?: {
    subject: string
    fromName?: string
    fromAddress: string
  } | null
  emailId?: string | null
}

export default function Tasks() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [tasks, setTasks] = useState<Task[]>([])
  const [tab, setTab] = useState<'OPEN' | 'DONE'>('OPEN')
  const [loading, setLoading] = useState(true)
  const [updatingTask, setUpdatingTask] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/')
  }, [status, router])

  const fetchTasks = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/tasks?status=${tab}`)
      const data = await res.json() as { tasks: Task[] }
      setTasks(data.tasks ?? [])
    } finally {
      setLoading(false)
    }
  }, [tab])

  useEffect(() => {
    if (session) fetchTasks()
  }, [session, tab, fetchTasks])

  const toggleTask = async (task: Task) => {
    setUpdatingTask(task.id)
    const newStatus = task.status === 'OPEN' ? 'DONE' : 'OPEN'
    const res = await fetch(`/api/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    if (res.ok) {
      setTasks(prev => prev.filter(t => t.id !== task.id))
    }
    setUpdatingTask(null)
  }

  const getDueBadge = (dueAt: string | null) => {
    if (!dueAt) return null
    const date = new Date(dueAt)
    if (isPast(date) && !isToday(date)) {
      return <span className="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded-full border border-red-200">Overdue</span>
    }
    if (isToday(date)) {
      return <span className="text-xs bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full border border-amber-200">Today</span>
    }
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/inbox" className="text-blue-600 p-1 -ml-1">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-lg font-semibold text-gray-900">✅ Tasks</h1>
        </div>

        <div className="max-w-2xl mx-auto px-4 pb-3 flex gap-2">
          <button
            onClick={() => setTab('OPEN')}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              tab === 'OPEN' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'
            }`}
          >
            Open
          </button>
          <button
            onClick={() => setTab('DONE')}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              tab === 'DONE' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'
            }`}
          >
            Done
          </button>
        </div>
      </header>

      <div className="max-w-2xl mx-auto p-4">
        {loading ? (
          <div className="py-12 text-center text-gray-400">Loading tasks...</div>
        ) : tasks.length === 0 ? (
          <div className="py-12 text-center">
            <div className="text-4xl mb-3">{tab === 'OPEN' ? '🎉' : '📋'}</div>
            <p className="text-gray-500">
              {tab === 'OPEN' ? 'No open tasks! All caught up.' : 'No completed tasks yet.'}
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {tasks.map(task => (
              <li key={task.id} className="bg-white rounded-xl shadow-sm p-4">
                <div className="flex items-start gap-3">
                  <button
                    onClick={() => toggleTask(task)}
                    disabled={updatingTask === task.id}
                    className={`mt-0.5 w-5 h-5 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${
                      task.status === 'DONE'
                        ? 'bg-green-500 border-green-500 text-white'
                        : 'border-gray-300 hover:border-blue-400'
                    }`}
                  >
                    {task.status === 'DONE' && (
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${task.status === 'DONE' ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                      {task.title}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      {task.dueAt && (
                        <span className="text-xs text-gray-500">
                          📅 {format(new Date(task.dueAt), 'PP')}
                        </span>
                      )}
                      {getDueBadge(task.dueAt)}
                    </div>
                    {task.email && task.emailId && (
                      <Link
                        href={`/inbox/${task.emailId}`}
                        className="mt-1.5 text-xs text-blue-500 flex items-center gap-1 hover:underline"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        {task.email.subject}
                      </Link>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

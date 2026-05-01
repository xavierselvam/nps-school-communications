'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { format } from 'date-fns'

interface Task {
  id: string
  title: string
  dueAt: string | null
  status: 'OPEN' | 'DONE'
}

interface EmailDetail {
  id: string
  subject: string
  fromName?: string
  fromAddress: string
  toAddress?: string
  snippet?: string
  bodyText?: string
  receivedAt: string
  isRead: boolean
  permalink?: string
  tasks: Task[]
}

export default function EmailDetail({ params }: { params: { id: string } }) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [email, setEmail] = useState<EmailDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [updatingTask, setUpdatingTask] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/')
  }, [status, router])

  useEffect(() => {
    if (session) {
      fetch(`/api/emails/${params.id}`)
        .then(r => r.json())
        .then(setEmail)
        .finally(() => setLoading(false))
    }
  }, [session, params.id])

  const toggleTask = async (task: Task) => {
    setUpdatingTask(task.id)
    const newStatus = task.status === 'OPEN' ? 'DONE' : 'OPEN'
    const res = await fetch(`/api/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    if (res.ok) {
      const updated = await res.json()
      setEmail(prev => prev ? {
        ...prev,
        tasks: prev.tasks.map(t => t.id === task.id ? { ...t, status: updated.status } : t),
      } : prev)
    }
    setUpdatingTask(null)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    )
  }

  if (!email) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">Email not found</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => router.back()} className="text-blue-600 p-1 -ml-1">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-base font-semibold text-gray-900 flex-1 truncate">Email</h1>
          {email.permalink && (
            <a href={email.permalink} target="_blank" rel="noopener noreferrer" className="text-blue-600 text-sm">
              Open in Gmail
            </a>
          )}
        </div>
      </header>

      <div className="max-w-2xl mx-auto p-4 space-y-4">
        <div className="bg-white rounded-xl shadow-sm p-4 space-y-2">
          <h2 className="text-lg font-semibold text-gray-900">{email.subject}</h2>
          <div className="text-sm text-gray-600 space-y-1">
            <div className="flex gap-2">
              <span className="text-gray-400 w-8">From</span>
              <span>{email.fromName ? `${email.fromName} <${email.fromAddress}>` : email.fromAddress}</span>
            </div>
            {email.toAddress && (
              <div className="flex gap-2">
                <span className="text-gray-400 w-8">To</span>
                <span className="truncate">{email.toAddress}</span>
              </div>
            )}
            <div className="flex gap-2">
              <span className="text-gray-400 w-8">Date</span>
              <span>{format(new Date(email.receivedAt), 'PPpp')}</span>
            </div>
          </div>
        </div>

        {email.tasks.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              ✅ Extracted Actions ({email.tasks.length})
            </h3>
            <ul className="space-y-2">
              {email.tasks.map(task => (
                <li key={task.id} className="flex items-start gap-3">
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
                  <div className="flex-1">
                    <p className={`text-sm ${task.status === 'DONE' ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                      {task.title}
                    </p>
                    {task.dueAt && (
                      <p className="text-xs text-amber-600 mt-0.5">
                        Due: {format(new Date(task.dueAt), 'PP')}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Message</h3>
          <div className="text-sm text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">
            {email.bodyText || email.snippet || 'No content available'}
          </div>
        </div>
      </div>
    </div>
  )
}


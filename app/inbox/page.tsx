'use client'

import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useCallback } from 'react'
import { formatDistanceToNow } from 'date-fns'
import Link from 'next/link'

interface Email {
  id: string
  subject: string
  fromName?: string
  fromAddress: string
  snippet?: string
  receivedAt: string
  isRead: boolean
  _count: { tasks: number }
}

interface ApiResponse {
  emails: Email[]
  total: number
  page: number
  limit: number
}

export default function Inbox() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [emails, setEmails] = useState<Email[]>([])
  const [filter, setFilter] = useState<'all' | 'needs_action'>('all')
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<string | null>(null)
  const [total, setTotal] = useState(0)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/')
  }, [status, router])

  const fetchEmails = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/emails?filter=${filter}`)
      const data: ApiResponse = await res.json()
      setEmails(data.emails ?? [])
      setTotal(data.total ?? 0)
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    if (session) fetchEmails()
  }, [session, filter, fetchEmails])

  const handleSync = async () => {
    setSyncing(true)
    setSyncResult(null)
    try {
      const res = await fetch('/api/sync', { method: 'POST' })
      const data = await res.json()
      if (data.error) {
        setSyncResult(`Error: ${data.error}`)
      } else {
        setSyncResult(`Synced ${data.synced} new email(s)`)
        await fetchEmails()
      }
    } catch {
      setSyncResult('Sync failed')
    } finally {
      setSyncing(false)
    }
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-gray-900">📬 School Inbox</h1>
          <div className="flex items-center gap-2">
            <Link href="/tasks" className="text-sm text-blue-600 font-medium px-2 py-1">
              Tasks
            </Link>
            <button
              onClick={() => signOut({ callbackUrl: '/' })}
              className="text-sm text-gray-500 px-2 py-1"
            >
              Sign out
            </button>
          </div>
        </div>

        <div className="max-w-2xl mx-auto px-4 pb-3 flex gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              filter === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter('needs_action')}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              filter === 'needs_action'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600'
            }`}
          >
            Needs Action
          </button>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
        <span className="text-sm text-gray-500">{total} email(s)</span>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="flex items-center gap-1.5 text-sm bg-blue-600 text-white px-4 py-2 rounded-lg disabled:opacity-60 active:bg-blue-700"
        >
          {syncing ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              Syncing...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Sync Now
            </>
          )}
        </button>
      </div>

      {syncResult && (
        <div className="max-w-2xl mx-auto px-4 pb-2">
          <div className={`text-sm px-3 py-2 rounded-lg ${syncResult.startsWith('Error') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
            {syncResult}
          </div>
        </div>
      )}

      <div className="max-w-2xl mx-auto">
        {loading ? (
          <div className="px-4 py-12 text-center text-gray-400">Loading emails...</div>
        ) : emails.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <div className="text-4xl mb-3">📭</div>
            <p className="text-gray-500">No emails yet. Tap &quot;Sync Now&quot; to fetch emails.</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {emails.map((email) => (
              <li key={email.id}>
                <Link
                  href={`/inbox/${email.id}`}
                  className={`block px-4 py-4 hover:bg-gray-50 active:bg-gray-100 ${!email.isRead ? 'bg-white' : 'bg-gray-50/50'}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-sm truncate ${!email.isRead ? 'font-semibold text-gray-900' : 'text-gray-600'}`}>
                          {email.fromName ?? email.fromAddress.split('@')[0]}
                        </span>
                        <span className="text-xs text-gray-400 flex-shrink-0">
                          {formatDistanceToNow(new Date(email.receivedAt), { addSuffix: true })}
                        </span>
                      </div>
                      <p className={`text-sm mt-0.5 truncate ${!email.isRead ? 'text-gray-800 font-medium' : 'text-gray-600'}`}>
                        {email.subject}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5 truncate">{email.snippet}</p>
                      {email._count.tasks > 0 && (
                        <span className="mt-1.5 inline-flex items-center gap-1 text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full border border-amber-200">
                          ✅ {email._count.tasks} action{email._count.tasks !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    {!email.isRead && (
                      <div className="w-2 h-2 bg-blue-500 rounded-full mt-1.5 flex-shrink-0" />
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

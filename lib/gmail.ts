import { google } from 'googleapis'
import { OAuth2Client } from 'google-auth-library'
import { prisma } from './prisma'
import { extractTasks } from './taskExtractor'
import { parse } from 'node-html-parser'

export function getOAuth2Client(): OAuth2Client {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXTAUTH_URL}/api/auth/callback/google`
  )
}

export function getAuthUrl(): string {
  const oauth2Client = getOAuth2Client()
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
    ],
    prompt: 'consent',
  })
}

async function getGmailClient(userId: string) {
  const account = await prisma.gmailAccount.findUnique({
    where: { userId },
  })
  if (!account) throw new Error('No Gmail account found')

  const oauth2Client = getOAuth2Client()
  oauth2Client.setCredentials({
    access_token: account.accessToken,
    refresh_token: account.refreshToken ?? undefined,
    expiry_date: account.tokenExpiry?.getTime(),
  })

  oauth2Client.on('tokens', async (tokens) => {
    const update: Record<string, unknown> = {}
    if (tokens.access_token) update.accessToken = tokens.access_token
    if (tokens.expiry_date) update.tokenExpiry = new Date(tokens.expiry_date)
    if (Object.keys(update).length > 0) {
      await prisma.gmailAccount.update({
        where: { userId },
        data: update,
      })
    }
  })

  return google.gmail({ version: 'v1', auth: oauth2Client })
}

function decodeBase64Url(data: string): string {
  return Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8')
}

function htmlToText(html: string): string {
  const root = parse(html)
  return root.text.replace(/\s+/g, ' ').trim()
}

function extractBody(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return ''
  const p = payload as Record<string, unknown>

  if (typeof p.body === 'object' && p.body !== null) {
    const body = p.body as Record<string, unknown>
    if (typeof body.data === 'string') {
      const decoded = decodeBase64Url(body.data)
      if (p.mimeType === 'text/plain') return decoded
      if (p.mimeType === 'text/html') return htmlToText(decoded)
    }
  }

  if (!Array.isArray(p.parts)) return ''

  for (const part of p.parts) {
    if (typeof part === 'object' && part !== null) {
      const pt = part as Record<string, unknown>
      if (pt.mimeType === 'text/plain' && typeof pt.body === 'object' && pt.body !== null) {
        const body = pt.body as Record<string, unknown>
        if (typeof body.data === 'string') {
          return decodeBase64Url(body.data)
        }
      }
    }
  }

  for (const part of p.parts) {
    if (typeof part === 'object' && part !== null) {
      const pt = part as Record<string, unknown>
      if (pt.mimeType === 'text/html' && typeof pt.body === 'object' && pt.body !== null) {
        const body = pt.body as Record<string, unknown>
        if (typeof body.data === 'string') {
          return htmlToText(decodeBase64Url(body.data))
        }
      }
    }
  }

  for (const part of p.parts) {
    const text = extractBody(part)
    if (text) return text
  }

  return ''
}

export async function syncEmails(userId: string): Promise<{ synced: number; errors: number }> {
  const gmail = await getGmailClient(userId)

  let synced = 0
  let errors = 0
  let pageToken: string | undefined
  
  const query = 'from:@npsis.edu.sg'

  do {
    const listRes = await gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults: 50,
      pageToken,
    })

    const messages = listRes.data.messages ?? []
    pageToken = listRes.data.nextPageToken ?? undefined

    for (const msg of messages) {
      if (!msg.id) continue

      const existing = await prisma.email.findUnique({
        where: { gmailMessageId: msg.id },
      })
      if (existing) continue

      try {
        const detail = await gmail.users.messages.get({
          userId: 'me',
          id: msg.id,
          format: 'full',
        })

        const headers = detail.data.payload?.headers ?? []
        const getHeader = (name: string) =>
          headers.find((h: { name?: string | null; value?: string | null }) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? ''

        const fromRaw = getHeader('From')
        const fromMatch = fromRaw.match(/^(.*?)\s*<(.+)>$/)
        const fromName = fromMatch ? fromMatch[1].trim().replace(/^["']|["']$/g, '') : undefined
        const fromAddress = fromMatch ? fromMatch[2] : fromRaw

        const subject = getHeader('Subject') || '(No Subject)'
        const toAddress = getHeader('To') || undefined
        const dateStr = getHeader('Date')
        const receivedAt = dateStr ? new Date(dateStr) : new Date(Number(detail.data.internalDate))

        const bodyText = extractBody(detail.data.payload)

        const email = await prisma.email.create({
          data: {
            gmailMessageId: msg.id,
            gmailThreadId: detail.data.threadId ?? msg.id,
            fromAddress,
            fromName,
            toAddress,
            subject,
            snippet: detail.data.snippet ?? undefined,
            bodyText,
            receivedAt,
            permalink: `https://mail.google.com/mail/u/0/#inbox/${detail.data.threadId}`,
          },
        })

        const tasks = extractTasks(email.id, userId, subject, bodyText ?? '', receivedAt)
        if (tasks.length > 0) {
          await prisma.task.createMany({ data: tasks })
        }

        synced++
      } catch (err) {
        console.error(`Error syncing message ${msg.id}:`, err)
        errors++
      }
    }

    if (!listRes.data.nextPageToken) break
    if (synced > 500) break
  } while (pageToken)

  const profileRes = await gmail.users.getProfile({ userId: 'me' }).catch(() => null)
  await prisma.gmailAccount.update({
    where: { userId },
    data: {
      lastSyncAt: new Date(),
      historyId: profileRes?.data.historyId ?? undefined,
    },
  })

  return { synced, errors }
}

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: { tasks: { select: { emailId: true } } },
  })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const { searchParams } = new URL(req.url)
  const filter = searchParams.get('filter') ?? 'all'
  const page = Number(searchParams.get('page') ?? 1)
  const limit = 20

  const emailsWithTaskIds = user.tasks.map(t => t.emailId).filter(Boolean) as string[]

  const where =
    filter === 'needs_action'
      ? { id: { in: emailsWithTaskIds } }
      : {}

  const [emails, total] = await Promise.all([
    prisma.email.findMany({
      where,
      orderBy: { receivedAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: { _count: { select: { tasks: true } } },
    }),
    prisma.email.count({ where }),
  ])

  return NextResponse.json({ emails, total, page, limit })
}

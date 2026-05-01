import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') ?? 'OPEN'

  const tasks = await prisma.task.findMany({
    where: { userId: user.id, status: status as 'OPEN' | 'DONE' },
    orderBy: [{ dueAt: 'asc' }, { createdAt: 'asc' }],
    include: { email: { select: { subject: true, fromName: true, fromAddress: true } } },
  })

  return NextResponse.json({ tasks })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const body = await req.json() as { emailId?: string; title: string; dueAt?: string }
  const task = await prisma.task.create({
    data: {
      userId: user.id,
      emailId: body.emailId ?? undefined,
      title: body.title,
      dueAt: body.dueAt ? new Date(body.dueAt) : undefined,
    },
  })

  return NextResponse.json(task, { status: 201 })
}

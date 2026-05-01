import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { prisma } from '@/lib/prisma'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const { id } = await params
  const task = await prisma.task.findFirst({ where: { id, userId: user.id } })
  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const updated = await prisma.task.update({
    where: { id },
    data: {
      title: body.title ?? task.title,
      dueAt: body.dueAt !== undefined ? (body.dueAt ? new Date(body.dueAt) : null) : task.dueAt,
      status: body.status ?? task.status,
      completedAt: body.status === 'DONE' ? new Date() : body.status === 'OPEN' ? null : task.completedAt,
    },
  })

  return NextResponse.json(updated)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const { id } = await params
  const task = await prisma.task.findFirst({ where: { id, userId: user.id } })
  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.task.delete({ where: { id } })
  return NextResponse.json({ success: true })
}

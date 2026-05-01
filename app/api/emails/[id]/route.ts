import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession()
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const email = await prisma.email.findUnique({
    where: { id: params.id },
    include: { tasks: true },
  })
  if (!email) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.email.update({ where: { id: params.id }, data: { isRead: true } })

  return NextResponse.json(email)
}

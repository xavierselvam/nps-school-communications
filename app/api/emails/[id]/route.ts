import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const email = await prisma.email.findUnique({
    where: { id: params.id },
    include: { tasks: true },
  })
  if (!email) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Verify the email is from the NPS domain that the user has access to
  if (!email.fromAddress.toLowerCase().endsWith('@npsis.edu.sg')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await prisma.email.update({ where: { id: params.id }, data: { isRead: true } })

  return NextResponse.json(email)
}

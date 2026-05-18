import { auth } from '@clerk/nextjs'
import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/db/client'

interface RouteParams {
  params: { id: string }
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { userId } = auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const workflow = await prisma.workflow.findFirst({
      where: { id: params.id, userId },
      select: { id: true },
    })
    if (!workflow) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const runs = await prisma.run.findMany({
      where: { workflowId: params.id },
      orderBy: { startedAt: 'desc' },
      include: {
        nodeRuns: {
          orderBy: { startedAt: 'asc' },
        },
      },
    })

    return NextResponse.json({ runs })
  } catch (err) {
    console.error('[GET /api/workflows/[id]/runs]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

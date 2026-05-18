import { auth } from '@clerk/nextjs'
import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/db/client'

interface RouteParams {
  params: { runId: string }
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { userId } = auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const run = await prisma.run.findFirst({
      where: {
        id: params.runId,
        workflow: { userId },
      },
      include: {
        nodeRuns: {
          orderBy: { startedAt: 'asc' },
        },
      },
    })

    if (!run) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    return NextResponse.json({ run })
  } catch (err) {
    console.error('[GET /api/runs/[runId]]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

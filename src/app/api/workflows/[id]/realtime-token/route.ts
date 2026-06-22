import { auth as clerkAuth } from '@clerk/nextjs'
import { auth as triggerAuth } from '@trigger.dev/sdk'
import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/db/client'
import { workflowTag } from '../../../../../lib/trigger/tags'

interface RouteParams {
  params: { id: string }
}

export async function GET(_req: Request, { params }: RouteParams) {
  try {
    const { userId } = clerkAuth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const wf = await prisma.workflow.findFirst({
      where: { id: params.id, userId },
      select: { id: true },
    })
    if (!wf) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const token = await triggerAuth.createPublicToken({
      scopes: {
        read: {
          tags: [workflowTag(params.id)],
        },
      },
      expirationTime: '1h',
    })

    return NextResponse.json({ token })
  } catch (err) {
    console.error('[GET /api/workflows/[id]/realtime-token]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

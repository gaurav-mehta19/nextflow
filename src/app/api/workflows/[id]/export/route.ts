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
    })
    if (!workflow) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const exportData = {
      name: workflow.name,
      nodes: workflow.nodes,
      edges: workflow.edges,
    }

    return new NextResponse(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${workflow.name.replace(/[^a-z0-9]/gi, '_')}.json"`,
      },
    })
  } catch (err) {
    console.error('[GET /api/workflows/[id]/export]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
